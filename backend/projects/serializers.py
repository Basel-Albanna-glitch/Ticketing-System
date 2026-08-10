from accounts.models import CustomerBranch, User
from accounts.serializers import CustomerBranchSerializer, UserSerializer
from django.utils import timezone
from rest_framework import serializers

from .models import Project, Task, TodoItem


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

    class Meta:
        model = TodoItem
        fields = [
            'id', 'title', 'notes', 'done', 'priority',
            'start_at', 'due_at', 'duration_minutes',
            'customer', 'customer_id',
            'assignees', 'assignee_ids', 'created_by', 'position',
            'completed_at', 'created_at', 'updated_at',
        ]
        # Order belongs to the reorder endpoint; completion is stamped on save.
        read_only_fields = ['position', 'completed_at']

    def get_duration_minutes(self, obj):
        if not obj.start_at or not obj.due_at:
            return None
        return int((obj.due_at - obj.start_at).total_seconds() // 60)

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
        return attrs

    def validate_assignee_ids(self, value):
        for user in value:
            if user.role not in (User.Role.AGENT, User.Role.ADMIN):
                raise serializers.ValidationError(
                    f'{user.username}: to-dos can only be assigned to staff.'
                )
        return value

    def update(self, instance, validated_data):
        # Stamp the moment work was finished, and clear it if the box is unticked.
        if 'done' in validated_data and validated_data['done'] != instance.done:
            validated_data['completed_at'] = timezone.now() if validated_data['done'] else None
        return super().update(instance, validated_data)
