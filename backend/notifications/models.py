from django.conf import settings
from django.db import models

from . import push
from .background import run_in_background


class Notification(models.Model):
    class Kind(models.TextChoices):
        GENERAL = 'general', 'General'
        NEW_TICKET = 'new_ticket', 'New ticket'
        LICENSE_EXPIRY = 'license_expiry', 'License expiry'
        # A ticket handed to its recipient by someone else. The web app interrupts them
        # with it (confirm / view ticket) rather than leaving it as a line in the bell.
        ASSIGNED = 'assigned', 'Ticket assigned'
        # Its recipient was added to a ticket as a collaborator; raised the same way.
        COLLABORATOR_ADDED = 'collaborator_added', 'Added as collaborator'
        # A to-do handed to its recipient by someone else; raised the same way.
        TODO_ASSIGNED = 'todo_assigned', 'To-do assigned'

    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name='notifications', on_delete=models.CASCADE
    )
    message = models.CharField(max_length=255)
    # The client alerts differently per kind (a new ticket beeps), so the reason a
    # notification exists has to survive as data instead of being parsed back out of `message`.
    kind = models.CharField(max_length=20, choices=Kind.choices, default=Kind.GENERAL)
    ticket = models.ForeignKey(
        'tickets.Ticket', null=True, blank=True, on_delete=models.CASCADE, related_name='+'
    )
    # Subject of the notification when it is about a customer rather than a ticket (license
    # expiry). Drives where the client navigates on click.
    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.CASCADE,
        related_name='+',
    )
    # The to-do it is about, when a to-do is assigned to its recipient. Like `ticket` and
    # `customer`, it is what the client opens when the notification is followed.
    todo = models.ForeignKey(
        'projects.TodoItem', null=True, blank=True, on_delete=models.CASCADE, related_name='+'
    )
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [models.Index(fields=['recipient', 'is_read'])]

    def __str__(self):
        return f'To {self.recipient}: {self.message}'


# Shown as the heading of the pushed alert; the notification's own message is the body.
# A bare message with no title reads as an anonymous beep on the lock screen.
PUSH_TITLES = {
    Notification.Kind.NEW_TICKET: 'New ticket',
    Notification.Kind.LICENSE_EXPIRY: 'Licence expiry',
    Notification.Kind.ASSIGNED: 'Ticket assigned to you',
    Notification.Kind.COLLABORATOR_ADDED: 'Added as a collaborator',
    Notification.Kind.TODO_ASSIGNED: 'To-do assigned to you',
    Notification.Kind.GENERAL: 'Ticket update',
}


def notify(
    recipients, message, ticket=None, kind=Notification.Kind.GENERAL, customer=None, todo=None
):
    """Create a notification for each recipient (a queryset or iterable of users).

    Also pushes to those recipients' registered devices, so the alert arrives even
    with the app closed. The push is best-effort and off-thread: the in-app
    notification row is the source of truth, and FCM being slow or down must not
    hold up (or fail) whatever action triggered this.
    """
    # Materialised once: `recipients` may be a queryset, and it is walked twice below.
    people = list(recipients)
    created = Notification.objects.bulk_create(
        [
            Notification(
                recipient=r, message=message, ticket=ticket, kind=kind, customer=customer,
                todo=todo,
            )
            for r in people
        ]
    )

    if created and push.is_configured():
        # bulk_create fills in primary keys on PostgreSQL and SQLite (both used here)
        # but not on every backend, so a missing pk is tolerated rather than assumed:
        # the push still goes out, just without collapsing onto the poller's entry.
        run_in_background(
            push.send_alerts,
            [(n.recipient_id, n.pk) for n in created],
            PUSH_TITLES.get(kind, PUSH_TITLES[Notification.Kind.GENERAL]),
            message,
            # Mirrors the fields the notification list returns, so a tap can open the
            # same screen the in-app notification would.
            {
                'kind': kind,
                'ticket_id': ticket.pk if ticket is not None else None,
                'customer_id': customer.pk if customer is not None else None,
                'todo_id': todo.pk if todo is not None else None,
            },
        )


class DeviceToken(models.Model):
    """An FCM registration token for one install of the mobile app.

    Keyed on the token rather than the user: a token identifies a *device*, and the
    same device changes hands when someone logs out and a colleague logs in. Registering
    an existing token therefore moves it to the new user instead of creating a second
    row, which is what stops the previous user's alerts following them onto a phone that
    is no longer theirs.
    """

    class Platform(models.TextChoices):
        ANDROID = 'android', 'Android'
        IOS = 'ios', 'iOS'
        WEB = 'web', 'Web'

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name='device_tokens', on_delete=models.CASCADE
    )
    token = models.CharField(max_length=255, unique=True)
    platform = models.CharField(
        max_length=10, choices=Platform.choices, default=Platform.ANDROID
    )
    created_at = models.DateTimeField(auto_now_add=True)
    # Touched on every re-registration (the app does so at each launch), which is the
    # only signal available for spotting tokens that have quietly gone stale.
    last_seen_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [models.Index(fields=['user'])]

    def __str__(self):
        return f'{self.user} / {self.platform} / {self.token[:12]}…'


class LicenseExpiryReminder(models.Model):
    """Record that one expiry reminder went out, so the sweep never sends it twice.

    The state cannot live on ``CustomerLicense``: saving a customer replaces that whole
    row set, which would wipe it and re-send every reminder on the next sweep. Keying on
    the licence's identifying values instead survives those rebuilds, and moving an end
    date genuinely is a new deadline that deserves its own reminders.
    """

    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name='license_expiry_reminders',
        on_delete=models.CASCADE,
    )
    license_name = models.CharField(max_length=200, blank=True)
    end_date = models.DateField()
    # Days before ``end_date`` this reminder covered; 0 is the day itself.
    days_before = models.IntegerField()
    sent_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['customer', 'license_name', 'end_date', 'days_before'],
                name='unique_license_expiry_reminder',
            )
        ]

    def __str__(self):
        return f'{self.license_name} ({self.end_date}) -{self.days_before}d'
