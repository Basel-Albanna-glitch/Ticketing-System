# Deploying to a single AWS EC2 instance

The whole stack runs on one host via `docker-compose.prod.yml`: nginx serves the
built SPA and reverse-proxies `/api`, `/admin`, `/media` and `/static` to gunicorn,
with Postgres alongside. Only port 80 is published.

```
        :80
client ------> nginx ---- /            -> built SPA (dist/)
                     |--- /api, /admin -> gunicorn :8000 -> postgres :5432
                     |--- /media       -> media_data volume
                     '--- /static      -> static_data volume
```

Because the SPA calls the API at a relative `/api` path, the server's address is
never compiled into the JavaScript bundle. The same image works on any IP.

## 1. Instance

- **Type:** `t3.small` or larger. `t3.micro` (1 GB) will OOM when Postgres,
  gunicorn and an `npm run build` share it. If you must use `t3.micro`, build the
  images elsewhere and pull them.
- **AMI:** Ubuntu 24.04 LTS or Amazon Linux 2023.
- **Storage:** 20 GB gp3.
- **Elastic IP:** allocate and associate one. Without it the public IP changes on
  every stop/start, and `DJANGO_ALLOWED_HOSTS` has to be edited each time.

**Security group inbound:**

| Port | Source | Why |
|------|--------|-----|
| 80 | `0.0.0.0/0`, or your office CIDR | the app |
| 22 | your IP only | SSH |

Do **not** open 5432. Postgres has no published port in the prod compose file and
is reachable only from the backend container.

## 2. Install Docker

Ubuntu 24.04:

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl git
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER
newgrp docker
```

## 3. Get the code and configure

```bash
git clone <your-repo-url> ticketing
cd ticketing
cp .env.prod.example .env.prod
python3 -c "import secrets; print(secrets.token_urlsafe(64))"   # DJANGO_SECRET_KEY
python3 -c "import secrets; print(secrets.token_urlsafe(32))"   # POSTGRES_PASSWORD
nano .env.prod
```

Replace every `YOUR.EC2.IP.HERE` with the Elastic IP. Note the format differs per
variable — `DJANGO_ALLOWED_HOSTS` takes a bare host, the other two need a scheme:

```
DJANGO_ALLOWED_HOSTS=127.0.0.1,localhost,203.0.113.10
CSRF_TRUSTED_ORIGINS=http://203.0.113.10
FRONTEND_URL=http://203.0.113.10
```

If push notifications are enabled, put the Firebase key at `secrets/firebase.json`
and set `FCM_SERVICE_ACCOUNT_FILE=/app/secrets/firebase.json`. Otherwise create the
empty directory so the bind mount has a source: `mkdir -p secrets`.

## 4. Start

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

The backend entrypoint waits for Postgres, runs `migrate`, runs `collectstatic`,
then starts gunicorn. Watch it come up:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod logs -f backend
```

Create the first admin user:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod \
  exec backend python manage.py createsuperuser
```

Then open `http://<elastic-ip>/`.

## 5. Updating

```bash
git pull
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

Migrations and `collectstatic` run automatically on each backend start.

## Backups

The Postgres data lives in the `postgres_data` volume and uploads in `media_data`;
both survive container restarts but **die with the instance**.

```bash
# Database
docker compose -f docker-compose.prod.yml --env-file .env.prod \
  exec -T db pg_dump -U ticketing ticketing | gzip > backup-$(date +%F).sql.gz

# Uploads
docker run --rm -v ticketing_media_data:/media -v "$PWD":/backup alpine \
  tar czf /backup/media-$(date +%F).tar.gz -C /media .
```

Copy both off the instance, and take EBS snapshots.

## Known limitations of an IP-only deploy

- **No HTTPS.** Let's Encrypt will not issue a certificate for a bare IP, so
  logins, JWTs and ticket contents travel in cleartext. Acceptable for an internal
  pilot behind a restricted security group; not for production customer data.
  Point a domain at the Elastic IP and add certbot to fix this — at that point also
  set `SESSION_COOKIE_SECURE`, `CSRF_COOKIE_SECURE` and `SECURE_SSL_REDIRECT` to
  `True`, which are deliberately left off here because they would break login over
  plain HTTP.
- **Single host.** No redundancy; a stopped instance is an outage.
- **Local uploads.** `media/` is instance-local. Moving to S3 (`django-storages`)
  is the next step if you need durability or more than one host.
