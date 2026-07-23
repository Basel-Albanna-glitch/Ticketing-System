import re

from django.conf import settings
from django.db import models, transaction
from django.utils import timezone


def normalize_phone(value):
    """Reduce a phone number to its digits (dropping spaces, dashes, parens, a leading +)
    so guest tracking matches regardless of how the number was typed."""
    return re.sub(r'\D', '', value or '')


class TicketSettings(models.Model):
    allow_agent_self_assign = models.BooleanField(default=False)
    allow_agent_reassign = models.BooleanField(default=False)
    # A closed ticket is locked (no status/deadline/comment changes) for everyone
    # except admins, who can always reopen it. When this is on, agents who may normally
    # edit the ticket can also keep editing it after it's closed; customers never can.
    allow_agent_edit_after_close = models.BooleanField(default=False)
    # When on, agents may edit customer records. Creating and deleting customers
    # always stays admin-only.
    allow_agent_edit_customers = models.BooleanField(default=False)
    # When on, the agent a ticket is assigned to may delete it. When off, only admins can.
    allow_agent_delete = models.BooleanField(default=False)
    # When on, agents may link, change, or remove the customer on a guest ticket.
    allow_agent_link_customer = models.BooleanField(default=False)

    class Meta:
        verbose_name = 'Ticket settings'
        verbose_name_plural = 'Ticket settings'

    def __str__(self):
        return 'Ticket settings'

    @classmethod
    def get_solo(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


class Category(models.Model):
    class Priority(models.TextChoices):
        LOW = 'low', 'Low'
        MEDIUM = 'medium', 'Medium'
        HIGH = 'high', 'High'
        URGENT = 'urgent', 'Urgent'

    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    priority = models.CharField(max_length=10, choices=Priority.choices, default=Priority.MEDIUM)
    parent = models.ForeignKey(
        'self', null=True, blank=True, related_name='children', on_delete=models.PROTECT
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']
        verbose_name_plural = 'Categories'

    def __str__(self):
        return self.name


class Ticket(models.Model):
    class Priority(models.TextChoices):
        LOW = 'low', 'Low'
        MEDIUM = 'medium', 'Medium'
        HIGH = 'high', 'High'
        URGENT = 'urgent', 'Urgent'

    class Status(models.TextChoices):
        OPEN = 'open', 'Unassigned'
        IN_PROGRESS = 'in_progress', 'In Progress'
        ON_HOLD = 'on_hold', 'On Hold'
        RESOLVED = 'resolved', 'Resolved'
        CLOSED = 'closed', 'Closed'

    # Registered customer who owns the ticket. Null for guest submissions, which instead
    # carry the guest_* contact fields below and are tracked by phone + ticket id.
    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name='tickets_created',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
    )
    guest_name = models.CharField(max_length=150, blank=True)
    guest_company = models.CharField(max_length=200, blank=True)
    guest_phone = models.CharField(max_length=30, blank=True)
    guest_email = models.EmailField(blank=True)
    assigned_agent = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name='tickets_assigned',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )
    assigned_at = models.DateTimeField(null=True, blank=True)
    collaborators = models.ManyToManyField(
        settings.AUTH_USER_MODEL, related_name='tickets_collaborating', blank=True
    )
    # Human-facing serial, e.g. HERMES-TKT-26-000123. Assigned on first save; the numeric
    # part is a per-year sequence that restarts at 1 each calendar year (see save()).
    reference = models.CharField(max_length=30, unique=True, blank=True)
    category = models.ForeignKey(Category, related_name='tickets', on_delete=models.PROTECT)
    # Optional branch of the customer this ticket relates to (only customers can have branches).
    branch = models.ForeignKey(
        'accounts.CustomerBranch', related_name='tickets', null=True, blank=True,
        on_delete=models.SET_NULL,
    )
    subject = models.CharField(max_length=200)
    description = models.TextField()
    priority = models.CharField(max_length=10, choices=Priority.choices, default=Priority.MEDIUM)
    status = models.CharField(max_length=15, choices=Status.choices, default=Status.OPEN)
    hold_reason = models.TextField(blank=True)
    # The day work on the ticket starts; defaults to the creation day on the form.
    start_date = models.DateField(null=True, blank=True)
    due_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['priority']),
            models.Index(fields=['assigned_agent']),
            models.Index(fields=['customer']),
        ]

    def save(self, *args, **kwargs):
        if not self.reference:
            with transaction.atomic():
                year = timezone.now().year
                counter, _ = TicketCounter.objects.select_for_update().get_or_create(year=year)
                counter.last_number += 1
                counter.save()
                self.reference = f'HERMES-TKT-{year % 100:02d}-{counter.last_number:06d}'
                super().save(*args, **kwargs)
        else:
            super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.reference or f"#{self.id}"} {self.subject}'


class TicketCounter(models.Model):
    """Per-year sequence source for ticket reference numbers."""

    year = models.PositiveIntegerField(unique=True)
    last_number = models.PositiveIntegerField(default=0)

    def __str__(self):
        return f'{self.year}: {self.last_number}'


class Comment(models.Model):
    ticket = models.ForeignKey(Ticket, related_name='comments', on_delete=models.CASCADE)
    # Null when posted by a guest (via the public tracking page); guest_name holds their name.
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name='comments', on_delete=models.CASCADE,
        null=True, blank=True,
    )
    guest_name = models.CharField(max_length=150, blank=True)
    body = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f'Comment by {self.author} on ticket #{self.ticket_id}'


def attachment_upload_path(instance, filename):
    return f'attachments/ticket_{instance.ticket_id}/{filename}'


class Attachment(models.Model):
    ticket = models.ForeignKey(Ticket, related_name='attachments', on_delete=models.CASCADE)
    comment = models.ForeignKey(
        Comment, related_name='attachments', null=True, blank=True, on_delete=models.CASCADE
    )
    # Null when uploaded by a guest via the public form/tracking page.
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.CASCADE
    )
    file = models.FileField(upload_to=attachment_upload_path)
    original_filename = models.CharField(max_length=255)
    content_type = models.CharField(max_length=100, blank=True)
    size = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return self.original_filename


class TicketActivity(models.Model):
    class ActivityType(models.TextChoices):
        CREATED = 'created', 'Created'
        STATUS_CHANGED = 'status_changed', 'Status changed'
        PRIORITY_CHANGED = 'priority_changed', 'Priority changed'
        ASSIGNED = 'assigned', 'Assigned'
        REASSIGNED = 'reassigned', 'Reassigned'
        COMMENTED = 'commented', 'Commented'
        ATTACHMENT_ADDED = 'attachment_added', 'Attachment added'
        DEADLINE_SET = 'deadline_set', 'Deadline set'
        CUSTOMER_LINKED = 'customer_linked', 'Customer linked'

    ticket = models.ForeignKey(Ticket, related_name='activities', on_delete=models.CASCADE)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL
    )
    activity_type = models.CharField(max_length=20, choices=ActivityType.choices)
    description = models.CharField(max_length=255)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']
        verbose_name_plural = 'Ticket activities'

    def __str__(self):
        return self.description
