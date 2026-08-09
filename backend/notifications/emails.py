from django.conf import settings
from django.core.mail import EmailMessage, get_connection

from accounts.models import NotificationPreference

from .background import run_in_background


def _deliver(messages):
    """Send every message over a single SMTP connection.

    Django's ``send_mail`` opens, TLS-negotiates, authenticates and tears down a
    fresh connection per call, so mailing four participants meant four full
    handshakes. Opening the connection once turns that into one.

    Runs on a background thread and touches no database, so there is no ORM
    connection to clean up here.
    """
    connection = get_connection(fail_silently=True)
    connection.open()
    try:
        for subject, body, recipient in messages:
            EmailMessage(
                subject, body, settings.DEFAULT_FROM_EMAIL, [recipient],
                connection=connection,
            ).send(fail_silently=True)
    finally:
        connection.close()


def send_mail_async(subject, body, recipient):
    """Queue a single plain-text email. Returns immediately."""
    if not recipient:
        return
    run_in_background(_deliver, [(subject, body, recipient)])


def email_users(recipients, subject, body, preference_field):
    """Queue a plain-text email to each recipient that has an email address and
    whose notification preference ``preference_field`` is enabled.

    A user with no preference row yet is treated as opted-in, matching the model
    defaults.

    Delivery happens on a background thread, so this returns as soon as the
    recipient list is worked out — the return value is the number of emails
    *queued*, not confirmed sent. The preference lookup deliberately stays on
    the calling thread: it is a single fast query, and doing it here keeps the
    background thread free of any database access.
    """
    recipients = [r for r in recipients if r and r.email]
    if not recipients:
        return 0

    prefs = {
        p.user_id: p
        for p in NotificationPreference.objects.filter(user__in=[r.id for r in recipients])
    }

    messages = []
    for user in recipients:
        pref = prefs.get(user.id)
        if pref is not None and not getattr(pref, preference_field):
            continue
        messages.append((subject, body, user.email))

    if messages:
        run_in_background(_deliver, messages)
    return len(messages)
