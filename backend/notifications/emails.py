from django.conf import settings
from django.core.mail import send_mail

from accounts.models import NotificationPreference


def email_users(recipients, subject, body, preference_field):
    """Send a plain-text email to each recipient that has an email address and whose
    notification preference ``preference_field`` is enabled.

    A user with no preference row yet is treated as opted-in, matching the model
    defaults. Sending is best-effort: mail errors are swallowed (``fail_silently``) so a
    mail-server problem never breaks the request. Returns the number of emails sent.
    """
    recipients = [r for r in recipients if r and r.email]
    if not recipients:
        return 0

    prefs = {
        p.user_id: p
        for p in NotificationPreference.objects.filter(user__in=[r.id for r in recipients])
    }

    sent = 0
    for user in recipients:
        pref = prefs.get(user.id)
        if pref is not None and not getattr(pref, preference_field):
            continue
        send_mail(subject, body, settings.DEFAULT_FROM_EMAIL, [user.email], fail_silently=True)
        sent += 1
    return sent
