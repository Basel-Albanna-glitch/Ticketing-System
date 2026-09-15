from datetime import timedelta

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


class TodoFolder(models.Model):
    """A named group of to-dos, living on one side of the shared/private divide.

    A folder is not a filter: putting an item in one settles which list it belongs to,
    so a folder's contents read the same for everyone entitled to see the folder at all.
    """

    name = models.CharField(max_length=100)
    # Fixed at creation. Shared folders are the team's; a private folder is its
    # creator's alone, and so are the items inside it.
    is_private = models.BooleanField(default=False)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name='todo_folders', on_delete=models.PROTECT
    )
    position = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['position', 'name', 'id']
        constraints = [
            # One "Renewals" on the shared board; but two people may each keep a private
            # folder of the same name, since neither can see the other's.
            models.UniqueConstraint(
                fields=['name'],
                condition=models.Q(is_private=False),
                name='unique_shared_todo_folder_name',
            ),
            models.UniqueConstraint(
                fields=['name', 'created_by'],
                condition=models.Q(is_private=True),
                name='unique_private_todo_folder_name_per_user',
            ),
        ]

    def __str__(self):
        return self.name


class TodoItem(models.Model):
    """An internal to-do, tied to nothing else.

    Deliberately separate from Task: a Task belongs to a project and moves through
    delivery stages, while these are the small internal jobs that belong nowhere —
    renew a certificate, order hardware, chase a supplier.

    Two lists in one table, split by `is_private`: a shared board the whole team reads,
    and each person's own list that nobody else sees — admins included.
    """

    class Priority(models.TextChoices):
        LOW = 'low', 'Low'
        MEDIUM = 'medium', 'Medium'
        HIGH = 'high', 'High'
        URGENT = 'urgent', 'Urgent'

    title = models.CharField(max_length=200)
    notes = models.TextField(blank=True)
    done = models.BooleanField(default=False)
    # Private items are visible only to created_by — not to other agents, not to admins.
    # Defaults to False so the shared board stays the norm and every existing row keeps
    # the behaviour it had before this field existed.
    is_private = models.BooleanField(default=False)
    # Optional grouping. Null means loose — the "Ungrouped" pile at the foot of its
    # section. A folder decides the item's privacy, so the two can never disagree;
    # SET_NULL means deleting a folder loosens its items rather than destroying work.
    folder = models.ForeignKey(
        TodoFolder, related_name='items', null=True, blank=True, on_delete=models.SET_NULL
    )
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
        indexes = [
            models.Index(fields=['done', 'position']),
            # Every list read filters on visibility first.
            models.Index(fields=['is_private', 'created_by']),
        ]

    def __str__(self):
        return self.title

    # --- Reminders ---------------------------------------------------------------------

    def sync_reminders(self, wanted=None):
        """Bring this to-do's reminders in line with its due date, and with `wanted` if given.

        `wanted` is the list a save sent — dicts holding `offset_minutes` or `remind_at` —
        and replaces what is stored. A reminder the list keeps, same kind and same moment,
        keeps its row and so its `sent_at`: re-saving a to-do must not re-send reminders
        that have already gone out. Repeats in the list collapse into one.

        With no list, only the reminders measured from the due date are re-derived, since
        the save may have moved it: one whose moment changes is armed again, and one with
        no due date left to hang on is dropped rather than blocking the edit.
        """
        existing = list(self.reminders.all())
        if wanted is None:
            for reminder in existing:
                if reminder.offset_minutes is None:
                    continue
                if self.due_at is None:
                    reminder.delete()
                    continue
                moment = self.due_at - timedelta(minutes=reminder.offset_minutes)
                if moment != reminder.remind_at:
                    reminder.remind_at = moment
                    reminder.sent_at = None
                    reminder.save(update_fields=['remind_at', 'sent_at'])
            return

        rows = list(existing)
        kept = set()
        for item in wanted:
            offset = item.get('offset_minutes')
            moment = (
                self.due_at - timedelta(minutes=offset) if offset is not None else item['remind_at']
            )
            match = next(
                (r for r in rows if r.offset_minutes == offset and r.remind_at == moment), None
            )
            if match is None:
                match = TodoReminder.objects.create(
                    todo=self, offset_minutes=offset, remind_at=moment
                )
                rows.append(match)
            kept.add(match.pk)
        self.reminders.exclude(pk__in=kept).delete()

    # --- Per-assignee completion -------------------------------------------------
    #
    # `done` is the state of the whole job. On an item three people are carrying, two of
    # them being finished is real information a single boolean cannot hold, so each
    # assignee's own share is tracked separately in TodoAssigneeCompletion. The three
    # methods below are the only places the two representations are reconciled, and
    # between them they hold one invariant: a done item has every assignee ticked, and an
    # open item does not.

    def sync_done_from_assignees(self):
        """Close the item once every assignee has finished, reopen it if one is taken
        back. Unassigned work is left alone — there is nobody to wait for.
        """
        assignee_ids = set(self.assignees.values_list('id', flat=True))
        if not assignee_ids:
            return
        completed = set(self.assignee_completions.values_list('user_id', flat=True))
        all_done = assignee_ids <= completed
        if all_done == self.done:
            return
        self.done = all_done
        self.completed_at = timezone.now() if all_done else None
        self.save(update_fields=['done', 'completed_at', 'updated_at'])

    def apply_done_to_assignees(self, actor=None):
        """The same rule read the other way: closing the whole to-do finishes everybody's
        part, and reopening it hands every part back.
        """
        if self.done:
            already = set(self.assignee_completions.values_list('user_id', flat=True))
            TodoAssigneeCompletion.objects.bulk_create(
                TodoAssigneeCompletion(todo=self, user_id=user_id, marked_by=actor)
                for user_id in self.assignees.values_list('id', flat=True)
                if user_id not in already
            )
        else:
            self.assignee_completions.all().delete()

    def reconcile_assignee_completions(self, actor=None):
        """After the assignee list changes: drop ticks belonging to people no longer on
        the item, and — on an item already closed — tick whoever has just been added, so
        "done" never sits alongside an unfinished part.
        """
        assignee_ids = set(self.assignees.values_list('id', flat=True))
        self.assignee_completions.exclude(user_id__in=assignee_ids).delete()
        if self.done:
            self.apply_done_to_assignees(actor)


class TodoReminder(models.Model):
    """One reminder on a to-do; a to-do can carry several.

    Each is either an exact moment, or an amount of time before the to-do's due date —
    "three days before" rather than a fixed moment, so moving the deadline carries it
    along. `remind_at` holds the moment either way: derived for a relative reminder (see
    TodoItem.sync_reminders), and stored rather than computed on read so the sweep can
    find what is due with an indexed query.
    """

    todo = models.ForeignKey(TodoItem, related_name='reminders', on_delete=models.CASCADE)
    # Null for an exact-time reminder; otherwise minutes before due_at (0 = at the deadline).
    offset_minutes = models.PositiveIntegerField(null=True, blank=True)
    remind_at = models.DateTimeField()
    # Stamped when the reminder goes out. Doubles as the guard that stops a second one —
    # there is no task queue here, so the sweep can run more than once.
    sent_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['remind_at', 'id']
        indexes = [
            # The sweep asks exactly this: what is still unsent and has come due.
            models.Index(fields=['sent_at', 'remind_at'], name='projects_todoreminder_due_idx'),
        ]

    def __str__(self):
        return f'{self.todo} @ {self.remind_at}'


class TodoAssigneeCompletion(models.Model):
    """One assignee's "my share is finished" on a to-do carried by several people.

    A row means that person is done; no row means they are not. Modelled as presence
    rather than a flag so the pair (todo, user) can be unique, and so removing somebody
    from an item removes their tick with them.
    """

    todo = models.ForeignKey(
        TodoItem, related_name='assignee_completions', on_delete=models.CASCADE
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name='todo_shares_completed', on_delete=models.CASCADE
    )
    # An admin may close a part on someone's behalf, and that is worth recording: it is
    # the difference between a person saying they finished and somebody saying it for them.
    marked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
        related_name='+',
    )
    completed_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['completed_at']
        constraints = [
            models.UniqueConstraint(
                fields=['todo', 'user'], name='unique_todo_assignee_completion'
            )
        ]

    def __str__(self):
        return f'{self.user} finished {self.todo}'


def todo_attachment_upload_path(instance, filename):
    return f'todos/todo_{instance.todo_id}/{filename}'


class TodoAttachment(models.Model):
    """A file kept with a to-do — a quote to chase, a photo of the serial plate.

    It inherits the to-do's audience rather than carrying its own: a file on a private
    item is as private as the item, and deleting the item takes its files with it.
    """

    todo = models.ForeignKey(TodoItem, related_name='attachments', on_delete=models.CASCADE)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
        related_name='+',
    )
    file = models.FileField(upload_to=todo_attachment_upload_path)
    original_filename = models.CharField(max_length=255)
    content_type = models.CharField(max_length=100, blank=True)
    size = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return self.original_filename
