from django.conf import settings
from django.db import models
from django.utils import timezone


class Project(models.Model):
    class Status(models.TextChoices):
        OPEN = 'open', 'Open'
        CLOSED = 'closed', 'Closed'

    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.OPEN)
    # The customer this project is delivered for. Optional: internal projects have none.
    # SET_NULL rather than CASCADE so removing a customer never destroys delivery history.
    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name='projects',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )
    # Which of the customer's branches the work is for. Only meaningful alongside
    # `customer`, and validated against it in the serializer.
    branch = models.ForeignKey(
        'accounts.CustomerBranch',
        related_name='projects',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )
    # Delivery window. Optional: a project can be tracked before its dates are agreed,
    # and only dated projects appear on the calendar.
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    # Private note for admins: commercial terms, risks, anything not for wider eyes.
    # The serializer withholds it from everyone else — see ProjectSerializer.
    remark = models.TextField(blank=True)
    # Staff responsible for the project as a whole, independent of who holds each task.
    assignees = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name='projects_assigned',
        blank=True,
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name='projects_created', on_delete=models.PROTECT
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.name


class Task(models.Model):
    class Priority(models.TextChoices):
        LOW = 'low', 'Low'
        MEDIUM = 'medium', 'Medium'
        HIGH = 'high', 'High'
        URGENT = 'urgent', 'Urgent'

    class Status(models.TextChoices):
        TODO = 'todo', 'To Do'
        IN_PROGRESS = 'in_progress', 'In Progress'
        IN_REVIEW = 'in_review', 'In Review'
        DONE = 'done', 'Done'

    project = models.ForeignKey(Project, related_name='tasks', on_delete=models.CASCADE)
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    status = models.CharField(max_length=15, choices=Status.choices, default=Status.TODO)
    priority = models.CharField(max_length=10, choices=Priority.choices, default=Priority.MEDIUM)
    # A task can be shared by several people. Empty means unassigned.
    assignees = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name='tasks_assigned',
        blank=True,
    )
    start_date = models.DateField(null=True, blank=True)
    due_date = models.DateField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name='tasks_created', on_delete=models.PROTECT
    )
    # Manual rank within its project, set by dragging. Ties break on id so the order
    # is total and stable even if two rows share a position.
    position = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['position', 'id']
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['project']),
            models.Index(fields=['project', 'position']),
        ]

    def save(self, *args, **kwargs):
        # A task finished without a due date gets today's date as its "to", so the
        # board still shows when the work actually landed. Only ever filled in when
        # empty — a date someone chose is never overwritten.
        if self.status == self.Status.DONE and self.due_date is None:
            self.due_date = timezone.localdate()
            if 'update_fields' in kwargs and kwargs['update_fields'] is not None:
                kwargs['update_fields'] = set(kwargs['update_fields']) | {'due_date'}
        super().save(*args, **kwargs)

    def __str__(self):
        return self.title


class TodoItem(models.Model):
    """An internal to-do, shared across staff and tied to nothing else.

    Deliberately separate from Task: a Task belongs to a project and moves through
    delivery stages, while these are the small internal jobs that belong nowhere —
    renew a certificate, order hardware, chase a supplier.
    """

    class Priority(models.TextChoices):
        LOW = 'low', 'Low'
        MEDIUM = 'medium', 'Medium'
        HIGH = 'high', 'High'
        URGENT = 'urgent', 'Urgent'

    title = models.CharField(max_length=200)
    notes = models.TextField(blank=True)
    done = models.BooleanField(default=False)
    priority = models.CharField(max_length=10, choices=Priority.choices, default=Priority.MEDIUM)
    # Optional window, to the minute. `duration_minutes` is derived from the pair
    # rather than stored, so the two can never drift apart.
    start_at = models.DateTimeField(null=True, blank=True)
    due_at = models.DateTimeField(null=True, blank=True)
    # Optional customer this internal job relates to — chasing a renewal, preparing a
    # visit. Most to-dos have none, which is why it is nullable.
    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name='todo_items_about',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )
    assignees = models.ManyToManyField(
        settings.AUTH_USER_MODEL, related_name='todo_items', blank=True
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name='todo_items_created', on_delete=models.PROTECT
    )
    # Manual rank, same idea as Task.position — the list is drag-ordered.
    position = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        # Open work first, then manual order; ties break on id so it is total.
        ordering = ['done', 'position', 'id']
        indexes = [models.Index(fields=['done', 'position'])]

    def __str__(self):
        return self.title
