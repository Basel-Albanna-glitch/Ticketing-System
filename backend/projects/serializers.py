from accounts.models import CustomerBranch, User
from accounts.serializers import CustomerBranchSerializer, UserSerializer
from notifications.models import Notification, notify
from django.utils import timezone
from rest_framework import serializers

from .models import Project, Task, TodoAttachment, TodoFolder, TodoItem, TodoReminder


def _can_edit(request, obj):
    """Mirror of CanEditAssignedWork, so the UI can hide what it may not use."""
    user = getattr(request, 'user', None)
    role = getattr(user, 'role', None)
    if request is None or role == User.Role.ADMIN:
        return True
    if role != User.Role.AGENT:
        return False
    # Mirrors the closed-project freeze in CanEditAssignedWork.
    project = getattr(obj, 'project', None)
    if (project or obj).status == Project.Status.CLOSED:
        return False
    owners = {u.id for u in obj.assignees.all()}
    if project is not None:
        owners |= {u.id for u in project.assignees.all()}
    return not owners or user.id in owners


def _assignment_allowed(request, kind, instance=None, requested=None):
    """Whether this requester may set these assignees on a project or a task.

    Admins always may. For an agent the rule turns on *who* the change involves:
    putting themselves on or off needs no permission — that is claiming work, and
    only ever affects them — while involving anyone else needs the matching
    switch. The two switches are separate so a team can divide tasks between
    themselves inside a project without also being able to hand the whole
    project to someone else. Absent request (shell, tests) is trusted.
    """
    user = getattr(request, 'user', None)
    role = getattr(user, 'role', None)
    if request is None or role == User.Role.ADMIN:
        return True
    if role != User.Role.AGENT:
        return False

    # Only-myself changes are always allowed. Compare against what is stored so
    # resending an unchanged list never counts as involving other people.
    if requested is not None:
        current = {u.id for u in instance.assignees.all()} if instance else set()
        touched = current.symmetric_difference({u.id for u in requested})
        if touched <= {user.id}:
            return True

    return user.has_staff_permission(
        'allow_agent_assign_tasks' if kind == 'task' else 'allow_agent_assign_projects'
    )


class ProjectSerializer(serializers.ModelSerializer):
    created_by = UserSerializer(read_only=True)
    customer = UserSerializer(read_only=True)
    # Writable counterpart to the read-only nested `customer`.
    customer_id = serializers.PrimaryKeyRelatedField(
        source='customer', queryset=User.objects.all(),
        allow_null=True, required=False, write_only=True,
    )
    assignees = UserSerializer(many=True, read_only=True)
    assignee_ids = serializers.PrimaryKeyRelatedField(
        source='assignees', queryset=User.objects.all(),
        many=True, required=False, write_only=True,
    )
    branch = CustomerBranchSerializer(read_only=True)
    branch_id = serializers.PrimaryKeyRelatedField(
        source='branch', queryset=CustomerBranch.objects.all(),
        allow_null=True, required=False, write_only=True,
    )
    task_count = serializers.IntegerField(read_only=True)
    # Tasks in the Done column — the numerator behind the progress bar.
    done_task_count = serializers.IntegerField(read_only=True)
    # Latest due date across the project's tasks; null when no task carries one.
    last_task_due = serializers.DateField(read_only=True)
    # The creation *day*, in the server's timezone. Derived here rather than in the
    # browser so the calendar filter and the chip can never disagree by a day.
    created_date = serializers.SerializerMethodField()
    can_edit = serializers.SerializerMethodField()
    can_delete = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = [
            'id', 'name', 'description', 'status', 'customer', 'customer_id',
            'assignees', 'assignee_ids', 'branch', 'branch_id', 'remark',
            'start_date', 'end_date',
            'created_by', 'task_count', 'done_task_count', 'last_task_due',
            'created_at', 'created_date', 'updated_at', 'can_edit', 'can_delete',
        ]

    def get_can_edit(self, obj):
        return _can_edit(self.context.get('request'), obj)

    def get_can_delete(self, obj):
        """Mirror of ProjectViewSet.destroy, so the UI never offers a delete that
        is certain to fail. A closed project is off limits to everyone, admins
        included — it has to be reopened first."""
        if obj.status == Project.Status.CLOSED:
            return False
        return _can_edit(self.context.get('request'), obj)

    def get_created_date(self, obj):
        return timezone.localdate(obj.created_at).isoformat() if obj.created_at else None

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # `remark` is admin-only, so it is dropped from the serializer entirely for
        # everyone else: agents neither see it in responses nor can set it by posting
        # one. Absent request (shell, tests) is treated as trusted.
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if request is not None and getattr(user, 'role', None) != User.Role.ADMIN:
            self.fields.pop('remark', None)

    def validate_customer_id(self, value):
        if value is not None and value.role != User.Role.CUSTOMER:
            raise serializers.ValidationError('customer must be a user with role=customer.')
        return value

    def validate_assignee_ids(self, value):
        if not _assignment_allowed(
            self.context.get('request'), 'project', self.instance, value
        ):
            raise serializers.ValidationError(
                'You can put yourself on this, but only admins may assign anyone else.'
            )
        for user in value:
            if user.role not in (User.Role.AGENT, User.Role.ADMIN):
                raise serializers.ValidationError(
                    f'{user.username}: assignees must be users with role=agent or role=admin.'
                )
        return value

    def validate(self, attrs):
        # Fall back to the stored value so a PATCH of one date is still checked
        # against the other.
        start = attrs.get('start_date', getattr(self.instance, 'start_date', None))
        end = attrs.get('end_date', getattr(self.instance, 'end_date', None))
        if start and end and start > end:
            raise serializers.ValidationError(
                {'start_date': 'Start date must be on or before the end date.'}
            )

        # Closing is a claim that the work is finished, so it has to be true: a
        # project with tasks still open cannot be closed until they are done or
        # removed. Reopening is always allowed.
        status = attrs.get('status')
        if status == Project.Status.CLOSED and self.instance is not None:
            unfinished = self.instance.tasks.exclude(status=Task.Status.DONE)
            count = unfinished.count()
            if count:
                titles = ', '.join(t.title for t in unfinished[:3])
                if count > 3:
                    titles += f', +{count - 3} more'
                raise serializers.ValidationError(
                    {
                        'status': (
                            f'{count} task(s) are not done yet, so this project '
                            f'cannot be closed: {titles}.'
                        )
                    }
                )

        # A branch belongs to exactly one customer, so it must match the project's own
        # customer — otherwise a project could be filed against a stranger's branch.
        if 'branch' in attrs:
            branch = attrs['branch']
            customer = attrs.get('customer', getattr(self.instance, 'customer', None))
            if branch is not None:
                if customer is None:
                    raise serializers.ValidationError(
                        {'branch_id': 'Link a customer before choosing a branch.'}
                    )
                if branch.customer_id != customer.id:
                    raise serializers.ValidationError(
                        {'branch_id': 'Branch does not belong to this customer.'}
                    )
        return attrs


class TaskSerializer(serializers.ModelSerializer):
    assignees = UserSerializer(many=True, read_only=True)
    assignee_ids = serializers.PrimaryKeyRelatedField(
        source='assignees', queryset=User.objects.all(),
        many=True, required=False, write_only=True,
    )
    created_by = UserSerializer(read_only=True)
    can_edit = serializers.SerializerMethodField()

    class Meta:
        model = Task
        fields = [
            'id', 'project', 'title', 'description', 'status', 'priority',
            'assignees', 'assignee_ids', 'start_date', 'due_date', 'position',
            'created_by', 'created_at', 'updated_at', 'can_edit',
        ]
        # Order is owned by the reorder endpoint, not by individual task edits.
        read_only_fields = ['position']

    def get_can_edit(self, obj):
        return _can_edit(self.context.get('request'), obj)

    def validate_assignee_ids(self, value):
        if not _assignment_allowed(
            self.context.get('request'), 'task', self.instance, value
        ):
            raise serializers.ValidationError(
                'You can put yourself on this, but only admins may assign anyone else.'
            )
        for user in value:
            if user.role not in (User.Role.AGENT, User.Role.ADMIN):
                raise serializers.ValidationError(
                    f'{user.username}: assignees must be users with role=agent or role=admin.'
                )
        return value

    def validate(self, attrs):
        # Creating has no object for the permission layer to inspect, so the
        # closed-project freeze is enforced here as well.
        project = attrs.get('project', getattr(self.instance, 'project', None))
        request = self.context.get('request')
        role = getattr(getattr(request, 'user', None), 'role', None)
        if (
            project is not None
            and project.status == Project.Status.CLOSED
            and role == User.Role.AGENT
        ):
            raise serializers.ValidationError(
                {'project': 'This project is closed. Only admins can change it.'}
            )

        start_date = attrs.get('start_date', getattr(self.instance, 'start_date', None))
        due_date = attrs.get('due_date', getattr(self.instance, 'due_date', None))
        if start_date and due_date and start_date > due_date:
            raise serializers.ValidationError({'start_date': 'Start date must be on or before the due date.'})

        # Work cannot progress before the day it is scheduled to begin. Only an
        # actual change is blocked — resaving the same status, or editing other
        # fields, stays possible while the task waits for its start date.
        new_status = attrs.get('status')
        old_status = getattr(self.instance, 'status', Task.Status.TODO)
        if (
            new_status is not None
            and new_status != old_status
            and start_date
            and start_date > timezone.localdate()
        ):
            raise serializers.ValidationError(
                {
                    'status': (
                        f'This task starts on {start_date.isoformat()}; its status '
                        'cannot change before then.'
                    )
                }
            )
        return attrs


class TodoAttachmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = TodoAttachment
        fields = ['id', 'file', 'original_filename', 'content_type', 'size', 'created_at']
        read_only_fields = fields


class TodoFolderSerializer(serializers.ModelSerializer):
    created_by = UserSerializer(read_only=True)
    item_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = TodoFolder
        fields = ['id', 'name', 'is_private', 'created_by', 'position', 'item_count', 'created_at']
        read_only_fields = ['position']

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('A folder needs a name.')
        return value

    def validate_is_private(self, value):
        # Which side a folder sits on is fixed once it holds anything: flipping it would
        # silently drag every item across the divide with it.
        if self.instance and value != self.instance.is_private:
            raise serializers.ValidationError(
                'A folder cannot move between shared and private. '
                'Make a new folder on the other side and move the to-dos across.'
            )
        return value


# Room for a week's, a day's and an hour's warning plus a fixed time or two, without letting
# one to-do turn into a mailing list. The form offers no more than this either.
MAX_REMINDERS_PER_TODO = 10


class TodoReminderSerializer(serializers.ModelSerializer):
    """One reminder, written as either `offset_minutes` (that long before the due date) or
    `remind_at` (an exact moment). `remind_at` is reported for both, so a client can show
    when each will actually land."""

    offset_minutes = serializers.IntegerField(
        required=False, allow_null=True, min_value=0, max_value=366 * 24 * 60
    )
    remind_at = serializers.DateTimeField(required=False, allow_null=True)

    class Meta:
        model = TodoReminder
        fields = ['id', 'offset_minutes', 'remind_at', 'sent_at']
        read_only_fields = ['id', 'sent_at']

    def validate(self, attrs):
        if attrs.get('offset_minutes') is None and attrs.get('remind_at') is None:
            raise serializers.ValidationError(
                'Give each reminder either an exact time or an amount before the due date.'
            )
        # A relative reminder's moment is worked out from the due date when it is saved, so
        # a remind_at echoed back from a previous read is ignored rather than trusted.
        if attrs.get('offset_minutes') is not None:
            attrs['remind_at'] = None
        return attrs


class TodoItemSerializer(serializers.ModelSerializer):
    customer = UserSerializer(read_only=True)
    customer_id = serializers.PrimaryKeyRelatedField(
        source='customer', queryset=User.objects.all(),
        allow_null=True, required=False, write_only=True,
    )
    # Length of the window in minutes. Derived, never stored, so it cannot
    # contradict the times it comes from.
    duration_minutes = serializers.SerializerMethodField()
    assignees = UserSerializer(many=True, read_only=True)
    assignee_ids = serializers.PrimaryKeyRelatedField(
        source='assignees', queryset=User.objects.all(),
        many=True, required=False, write_only=True,
    )
    created_by = UserSerializer(read_only=True)
    attachments = TodoAttachmentSerializer(many=True, read_only=True)
    # Who among the assignees has finished their share. Written through its own endpoint
    # rather than here: it is one person's statement about their own work, not a field of
    # the to-do that anyone editing the item may set.
    assignee_completions = serializers.SerializerMethodField()
    folder = TodoFolderSerializer(read_only=True)
    folder_id = serializers.PrimaryKeyRelatedField(
        source='folder', queryset=TodoFolder.objects.all(),
        allow_null=True, required=False, write_only=True,
    )
    # Sent, the list replaces the to-do's reminders; left out, they stay as they are (bar
    # re-deriving the ones measured from a due date this save moves).
    reminders = TodoReminderSerializer(many=True, required=False)

    class Meta:
        model = TodoItem
        fields = [
            'id', 'title', 'notes', 'done', 'is_private', 'priority',
            'folder', 'folder_id', 'attachments',
            'start_at', 'due_at', 'reminders',
            'duration_minutes',
            'customer', 'customer_id',
            'assignees', 'assignee_ids', 'assignee_completions', 'created_by', 'position',
            'completed_at', 'created_at', 'updated_at',
        ]
        # Order belongs to the reorder endpoint; completion is stamped by the server.
        read_only_fields = ['position', 'completed_at']

    def get_duration_minutes(self, obj):
        if not obj.start_at or not obj.due_at:
            return None
        return int((obj.due_at - obj.start_at).total_seconds() // 60)

    def get_assignee_completions(self, obj):
        return [
            {
                'user_id': c.user_id,
                'completed_at': c.completed_at,
                'marked_by_id': c.marked_by_id,
            }
            for c in obj.assignee_completions.all()
        ]

    def validate_title(self, value):
        if not value.strip():
            raise serializers.ValidationError('A to-do needs a title.')
        return value.strip()

    def validate_customer_id(self, value):
        if value is not None and value.role != User.Role.CUSTOMER:
            raise serializers.ValidationError('customer must be a user with role=customer.')
        return value

    def validate(self, attrs):
        # Compare against stored values so patching one end still checks the pair.
        start = attrs.get('start_at', getattr(self.instance, 'start_at', None))
        due = attrs.get('due_at', getattr(self.instance, 'due_at', None))
        if start and due and start > due:
            raise serializers.ValidationError(
                {'start_at': 'Start must be at or before the due time.'}
            )

        # A reminder measured from the due date needs one. Checked against the due date this
        # save leaves behind, so a due date and its reminders can arrive in one request.
        if 'reminders' in attrs:
            reminders = attrs['reminders']
            if len(reminders) > MAX_REMINDERS_PER_TODO:
                raise serializers.ValidationError(
                    {'reminders': f'A to-do can have at most {MAX_REMINDERS_PER_TODO} reminders.'}
                )
            if due is None and any(r.get('offset_minutes') is not None for r in reminders):
                raise serializers.ValidationError(
                    {'reminders': 'Set a due date before adding a reminder relative to it.'}
                )

        # A folder settles which side its items sit on, so the folder wins over any
        # is_private in the same payload — the two can never end up disagreeing.
        if 'folder' in attrs and attrs['folder'] is not None:
            folder = attrs['folder']
            request = self.context.get('request')
            user = request.user if request else None
            if folder.is_private:
                # Someone else's private folder is not a place you can put work: you
                # would be hiding the item somewhere even you cannot look.
                if user and folder.created_by_id != user.id:
                    raise serializers.ValidationError(
                        {'folder_id': 'That private folder belongs to someone else.'}
                    )
                author_id = getattr(self.instance, 'created_by_id', None) or (
                    user.id if user else None
                )
                if user and author_id != user.id:
                    raise serializers.ValidationError(
                        {'folder_id': 'Only the person who created a to-do can make it private.'}
                    )
            attrs['is_private'] = folder.is_private

        # A private to-do is its author's alone. Nobody else can read it, so assigning
        # one would hand somebody work they cannot open — and would put a name on the
        # board against an item that is not on the board. Checked after the folder rule
        # above, which can be what made the item private in the first place.
        is_private = attrs.get('is_private', getattr(self.instance, 'is_private', False))
        if is_private:
            if 'assignees' in attrs:
                assignees = attrs['assignees']
            elif self.instance is not None:
                assignees = list(self.instance.assignees.all())
            else:
                assignees = []
            if assignees:
                raise serializers.ValidationError(
                    {
                        'assignee_ids': (
                            'A private to-do is yours alone and cannot be assigned to '
                            'anyone. Remove the assignees, or keep it on the shared board.'
                        )
                    }
                )
        return attrs

    def validate_is_private(self, value):
        # Whose item it is decides who may hide it. Without this, anyone could flip a
        # colleague's item to private and quietly pull it off the shared board — where it
        # would then be readable only by an author who never chose to hide it.
        instance = self.instance
        if instance is None or value == instance.is_private:
            return value
        request = self.context.get('request')
        if request and instance.created_by_id != request.user.id:
            raise serializers.ValidationError(
                'Only the person who created a to-do can change whether it is private.'
            )
        return value

    def validate_assignee_ids(self, value):
        for user in value:
            if user.role not in (User.Role.AGENT, User.Role.ADMIN):
                raise serializers.ValidationError(
                    f'{user.username}: to-dos can only be assigned to staff.'
                )
        return value

    def _alert_new_assignees(self, todo, previous):
        """Tell people a to-do was just handed to them: only those newly on it, and never
        whoever made the change. The web app raises it as an alert with a way to open it."""
        request = self.context.get('request')
        actor = request.user if request else None
        added = todo.assignees.exclude(pk__in=previous)
        if actor is not None:
            added = added.exclude(pk=actor.pk)
        if not added.exists():
            return
        by = f' by {actor.full_name}' if actor is not None else ''
        notify(
            added,
            f'To-do "{todo.title}" was assigned to you{by}'[:255],
            kind=Notification.Kind.TODO_ASSIGNED,
            todo=todo,
        )

    def create(self, validated_data):
        reminders = validated_data.pop('reminders', None)
        instance = super().create(validated_data)
        if reminders:
            instance.sync_reminders(reminders)
        self._alert_new_assignees(instance, previous=set())
        return instance

    def update(self, instance, validated_data):
        was_done = instance.done
        # Stamp the moment work was finished, and clear it if the box is unticked.
        if 'done' in validated_data and validated_data['done'] != instance.done:
            validated_data['completed_at'] = timezone.now() if validated_data['done'] else None
        reminders = validated_data.pop('reminders', None)
        # Who was on it before this save, so only people it adds are alerted.
        previous = (
            set(instance.assignees.values_list('pk', flat=True))
            if 'assignees' in validated_data
            else None
        )
        instance = super().update(instance, validated_data)
        # Always, not only when reminders were sent: a moved due date takes the reminders
        # measured from it along, and re-arms any whose moment changed.
        instance.sync_reminders(reminders)

        # Both after the save, since each reads the assignee list this update just wrote.
        # Order matters: clear out ticks for people who have left before deciding whether
        # everyone remaining is finished.
        request = self.context.get('request')
        actor = request.user if request else None
        if 'assignees' in validated_data:
            instance.reconcile_assignee_completions(actor)
        if instance.done != was_done:
            instance.apply_done_to_assignees(actor)
        if previous is not None:
            self._alert_new_assignees(instance, previous)
        return instance
