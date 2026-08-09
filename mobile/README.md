# Hermes Tickets — mobile app

Flutter client for the Django backend in `../backend`. One app serves both
audiences; the UI branches on the signed-in user's role.

| | Customer | Agent / Admin |
|---|---|---|
| Ticket list | own tickets only (server-scoped) | full queue + "Assigned to me" |
| Create | yes, via the FAB | — |
| Comment | yes | yes |
| Claim / reassign | — | yes |
| Change status | — | yes (once assigned) |
| Log work phase | — | yes |

Scoping is not enforced in the app: `get_scoped_tickets` in
`backend/tickets/views.py` already restricts the queryset per role, and every
staff-only action is permission-checked server-side. The role flags here only
decide what to *draw*.

## First run

The Flutter SDK is not yet installed on this machine — install it plus Android
Studio, then:

```bash
cd mobile
flutter create .          # generates android/, ios/, web/ around the existing lib/
flutter pub get
flutter run
```

`flutter create .` will not overwrite `lib/`, `pubspec.yaml`, or this README.

Start the backend in another terminal:

```bash
cd backend
../.venv/Scripts/python manage.py runserver
```

## Pointing the app at the backend

`lib/core/config.dart` picks a host per platform, because `localhost` means
something different on each:

| Target | Host used |
|---|---|
| Android emulator | `http://10.0.2.2:8000` (fixed alias for the host machine) |
| iOS simulator / desktop | `http://127.0.0.1:8000` |
| Physical phone | must be given explicitly |

For a real device on the same Wi-Fi:

```bash
flutter run --dart-define=API_BASE_URL=http://192.168.1.20:8000
```

and on the backend side:

1. add that IP to `DJANGO_ALLOWED_HOSTS` in `backend/.env`
2. start with `manage.py runserver 0.0.0.0:8000`

The login screen prints the resolved base URL underneath the button — a wrong
host is the most common first-run failure and is otherwise invisible.

### Android blocks plain HTTP

Release-mode Android refuses cleartext traffic. For local development against
`http://`, add to `android/app/src/main/AndroidManifest.xml` (after
`flutter create .` generates it):

```xml
<application android:usesCleartextTraffic="true" ... >
```

Drop this once the backend is behind HTTPS.

CORS does **not** apply to a native app — `CORS_ALLOWED_ORIGINS` only matters if
you also build Flutter web.

## Layout

```
lib/
  core/       config (base URL), token storage, Dio client + JWT refresh
  models/     plain fromJson classes mirroring the DRF serializers
  data/       repositories — one method per endpoint
  state/      Riverpod providers, auth + ticket list controllers
  ui/         screens and shared widgets
```

### Auth

`POST /api/token/` takes a **username**, not an email (`USERNAME_FIELD` in
`backend/accounts/models.py`). Access tokens last 30 minutes, so
`ApiClient` refreshes on any 401 and replays the request. `ROTATE_REFRESH_TOKENS`
is on, so the new refresh token returned by `/api/token/refresh/` is written back
to secure storage — concurrent 401s are collapsed into a single refresh so the
rotating token is never spent twice.

## Push notifications (Firebase)

Alerts come from two places, deliberately:

- **polling** (`NotificationWatcher`) raises a local notification every 30s while
  the app is open. Works with no Firebase setup at all.
- **push** (FCM) is what reaches the phone when the app is backgrounded or
  killed — Android will not wake a dead app to poll.

Both draw on the same `ticket_updates` channel, and the server sends the
`Notification` row's id in the payload so whichever arrives second *replaces*
the first in the shade rather than showing the alert twice.

### Setup

Two files, from two different pages of the Firebase console, for two different
halves of the system:

| File | Console location | Goes | Lets |
|---|---|---|---|
| `google-services.json` | Project settings → Your apps → Android | `android/app/` | the phone receive |
| service-account key | Project settings → Service accounts → Generate new private key | anywhere **outside the repo** | Django send |

Then point the backend at the key in `backend/.env`:

```
FCM_SERVICE_ACCOUNT_FILE=C:/Users/basel/.secrets/hermes-firebase-adminsdk.json
```

Leave that blank and push turns into a silent no-op — the app still registers
its token, nothing is ever delivered, and no error is raised. That is the same
"unconfigured means disabled" rule WhatsApp and SMTP follow.

The `applicationId` in `android/app/build.gradle.kts` **must** equal the Android
package registered in the Firebase project (`com.hermes.hermesticketing`); the
google-services Gradle plugin looks up its config by that value and fails the
build on a mismatch. The build also fails outright if `google-services.json` is
absent — that is preferable to a silent misconfiguration.

The service-account key is a real private key that can push to every install of
the app. Keep it out of git; `.gitignore` covers the obvious names, but the
console's own filename (`…-firebase-adminsdk-…json`) is not one of them, which
is why the recommendation is to store it outside the repo entirely.

## Not built yet

> Stale — most of the list below has since been built (attachments, the
> notification list and badge, guest tracking, ratings, reports, KB articles and
> Arabic/RTL all exist). Treat it as unverified.

- attachments (upload/download), notifications list and unread badge
- guest ticket tracking (`/api/tickets/guest/…`) — public, no login
- ratings, dashboard/reports, KB articles
- Arabic/RTL, which the web app has via `frontend/src/i18n`
- tests
