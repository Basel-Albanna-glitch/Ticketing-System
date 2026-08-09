"""Firebase Cloud Messaging (HTTP v1) delivery for the mobile app.

The in-app alerts are *local* notifications driven by polling, which Android will not
wake a killed app to do. Push is what makes an alert land on a phone whose app is
closed — see ``mobile/lib/core/notifications_service.dart``.

Configured with a service-account key from the Firebase console
(Project settings → Service accounts → Generate new private key):

    FCM_SERVICE_ACCOUNT_FILE   absolute path to that JSON file
    FCM_PROJECT_ID             optional; defaults to the project_id inside the file

Leave the path blank to disable push entirely — every function here then becomes a
no-op, exactly like WhatsApp without an access token.

Auth is the OAuth2 JWT-bearer flow: sign a short-lived assertion with the service
account's private key and swap it for an access token. That is a dozen lines with
PyJWT (already a dependency for the app's own auth), so it avoids pulling in
google-auth and requests just for this.
"""

import json
import logging
import threading
import time
import urllib.error
import urllib.parse
import urllib.request

import jwt
from django.conf import settings

logger = logging.getLogger(__name__)

SCOPE = 'https://www.googleapis.com/auth/firebase.messaging'
FCM_ENDPOINT = 'https://fcm.googleapis.com/v1/projects/{project}/messages:send'

# The Android channel the app creates in NotificationsService. It must match, or a
# pushed alert arrives silently: a channel_id Android does not know falls back to a
# default channel with no sound or heads-up banner.
ANDROID_CHANNEL = 'ticket_updates'

# Guards the cached access token — pushes are sent from background threads, and
# without this each concurrent sender would mint a token of its own.
_lock = threading.Lock()
_cached_token = None
_cached_expiry = 0.0
_cached_account = None


def is_configured():
    """True when a service-account file is set and readable."""
    return _service_account() is not None


def _service_account():
    """Load and cache the service-account JSON. Returns None when unset or unusable."""
    global _cached_account
    if _cached_account is not None:
        return _cached_account

    path = getattr(settings, 'FCM_SERVICE_ACCOUNT_FILE', '')
    if not path:
        return None
    try:
        with open(path, encoding='utf-8') as fh:
            account = json.load(fh)
    except OSError as exc:
        logger.warning('FCM service account file unreadable (%s): %s', path, exc)
        return None
    except json.JSONDecodeError as exc:
        logger.warning('FCM service account file is not valid JSON (%s): %s', path, exc)
        return None

    missing = [k for k in ('client_email', 'private_key') if not account.get(k)]
    if missing:
        logger.warning('FCM service account file is missing %s', ', '.join(missing))
        return None

    _cached_account = account
    return account


def project_id():
    account = _service_account() or {}
    return getattr(settings, 'FCM_PROJECT_ID', '') or account.get('project_id', '')


def _access_token():
    """A cached OAuth2 access token for the FCM scope, or None if it cannot be minted."""
    global _cached_token, _cached_expiry

    account = _service_account()
    if account is None:
        return None

    with _lock:
        # Refresh a minute early: a token that expires in transit reads as a 401 and
        # loses the notification.
        if _cached_token and time.time() < _cached_expiry - 60:
            return _cached_token

        token_uri = account.get('token_uri', 'https://oauth2.googleapis.com/token')
        now = int(time.time())
        # Google caps assertion lifetime at an hour; the access token it returns
        # carries its own (also an hour) expiry, which is what we cache against.
        assertion = jwt.encode(
            {
                'iss': account['client_email'],
                'scope': SCOPE,
                'aud': token_uri,
                'iat': now,
                'exp': now + 3600,
            },
            account['private_key'],
            algorithm='RS256',
        )
        body = urllib.parse.urlencode({
            'grant_type': 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            'assertion': assertion,
        }).encode()
        request = urllib.request.Request(
            token_uri,
            data=body,
            method='POST',
            headers={'Content-Type': 'application/x-www-form-urlencoded'},
        )
        try:
            with urllib.request.urlopen(request, timeout=10) as response:
                payload = json.loads(response.read().decode())
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode(errors='replace')[:500]
            logger.warning('FCM token request failed (%s): %s', exc.code, detail)
            return None
        except Exception as exc:  # noqa: BLE001 - push must never break its caller
            logger.warning('FCM token request error: %s', exc)
            return None

        _cached_token = payload.get('access_token')
        _cached_expiry = time.time() + int(payload.get('expires_in', 3600))
        return _cached_token


def send_to_token(token, title, body, data=None):
    """Send one message. Returns True on success, False otherwise; never raises.

    A False return says nothing about whether the token is still valid — see
    ``send_to_users``, which is what acts on the distinction.
    """
    return _send(token, title, body, data)[0]


def _send(token, title, body, data):
    """Post one message. Returns ``(ok, token_is_dead)``."""
    access_token = _access_token()
    project = project_id()
    if not access_token or not project:
        return False, False

    message = {
        'message': {
            'token': token,
            'notification': {'title': title, 'body': body},
            'android': {
                # 'high' is what lets the message wake a dozing device; the default
                # ('normal') can be held back for minutes under Doze, which defeats
                # the point of push for a support alert.
                'priority': 'high',
                'notification': {
                    'channel_id': ANDROID_CHANNEL,
                    'sound': 'default',
                },
            },
            # FCM rejects non-string data values, so everything is stringified.
            'data': {k: str(v) for k, v in (data or {}).items() if v is not None},
        }
    }
    request = urllib.request.Request(
        FCM_ENDPOINT.format(project=project),
        data=json.dumps(message).encode(),
        method='POST',
        headers={
            'Authorization': f'Bearer {access_token}',
            'Content-Type': 'application/json',
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            response.read()
        return True, False
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode(errors='replace')[:500]
        # 404 UNREGISTERED means the app was uninstalled or the token rotated; 400
        # INVALID_ARGUMENT on a token field means it was never valid. Both are
        # permanent, so the row should go rather than be retried forever.
        dead = exc.code == 404 or (exc.code == 400 and 'INVALID_ARGUMENT' in detail)
        if not dead:
            logger.warning('FCM send failed (%s): %s', exc.code, detail)
        return False, dead
    except Exception as exc:  # noqa: BLE001 - push must never break its caller
        logger.warning('FCM send error: %s', exc)
        return False, False


def send_alerts(targets, title, body, data=None):
    """Push one alert per target to every device that target has registered.

    ``targets`` is an iterable of ``(user_id, notification_id)`` pairs; the id may be
    None on backends whose bulk_create cannot return primary keys. It travels in the
    payload so the app can draw the pushed alert under the same shade entry id the
    poller would use for that notification — otherwise a push and the poll behind it
    show the same thing twice.

    Returns the number of messages accepted by FCM. Tokens reported as permanently
    dead are deleted: nothing else tells us an app was uninstalled, so this is the
    only thing keeping the table from filling with tokens that can never receive.
    """
    # Imported here rather than at module scope: models.py imports this module for
    # dispatch, and a top-level import back into it would be circular.
    from .models import DeviceToken

    if not is_configured():
        return 0

    targets = list(targets)
    tokens_by_user = {}
    rows = DeviceToken.objects.filter(
        user_id__in={user_id for user_id, _ in targets}
    ).values_list('id', 'user_id', 'token')
    for row_id, user_id, token in rows:
        tokens_by_user.setdefault(user_id, []).append((row_id, token))
    if not tokens_by_user:
        return 0

    sent = 0
    dead_ids = []
    for user_id, notification_id in targets:
        for row_id, token in tokens_by_user.get(user_id, ()):
            payload = dict(data or {})
            if notification_id is not None:
                payload['notification_id'] = notification_id
            ok, dead = _send(token, title, body, payload)
            if ok:
                sent += 1
            elif dead:
                dead_ids.append(row_id)

    if dead_ids:
        DeviceToken.objects.filter(id__in=dead_ids).delete()
        logger.info('Pruned %d dead FCM token(s)', len(dead_ids))
    return sent


def reset_cache():
    """Forget the cached credentials and access token. For tests and key rotation."""
    global _cached_token, _cached_expiry, _cached_account
    with _lock:
        _cached_token = None
        _cached_expiry = 0.0
        _cached_account = None
