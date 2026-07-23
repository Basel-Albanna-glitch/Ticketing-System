from django.conf import settings
from django.db import models


class Notification(models.Model):
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name='notifications', on_delete=models.CASCADE
    )
    message = models.CharField(max_length=255)
    ticket = models.ForeignKey(
        'tickets.Ticket', null=True, blank=True, on_delete=models.CASCADE, related_name='+'
    )
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [models.Index(fields=['recipient', 'is_read'])]

    def __str__(self):
        return f'To {self.recipient}: {self.message}'


def notify(recipients, message, ticket=None):
    """Create a notification for each recipient (a queryset or iterable of users)."""
    Notification.objects.bulk_create(
        [Notification(recipient=r, message=message, ticket=ticket) for r in recipients]
    )
