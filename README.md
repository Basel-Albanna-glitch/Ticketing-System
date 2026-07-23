# Ticketing System

- `backend/` — Django + Django REST Framework, JWT auth (simplejwt), PostgreSQL
- `frontend/` — React (Vite) + Tailwind CSS v4

## Run with Docker (recommended)

Requires Docker Desktop.

```
cp .env.example .env
docker compose up --build
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000/api/health/
- Django admin: http://localhost:8000/admin/

On first run, apply migrations and create a superuser in another terminal:

```
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py createsuperuser
```

## Run natively (no Docker)

### Backend

Requires a local PostgreSQL instance and a database matching `backend/.env`.

```
cd backend
cp .env.example .env      # adjust POSTGRES_* to match your local Postgres
.venv\Scripts\activate
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

### Frontend

```
cd frontend
npm install
npm run dev
```

Vite dev server proxies `/api` to `http://localhost:8000`, so the frontend can call
the Django API with relative paths (e.g. `fetch('/api/health/')`).

## Auth

`POST /api/token/` — obtain access/refresh JWT pair (username + password)
`POST /api/token/refresh/` — refresh an access token

All other API endpoints require an `Authorization: Bearer <access_token>` header
by default (see `REST_FRAMEWORK` in `backend/config/settings.py`).
