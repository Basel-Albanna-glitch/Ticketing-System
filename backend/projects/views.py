from accounts.models import User
from accounts.permissions import CanViewSection, IsAdminOrAgent
from django.db import transaction
from django.db.models import Count, Max, Q
from django.utils.dateparse import parse_date
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import SAFE_METHODS, BasePermission, IsAuthenticated
from rest_framework.response import Response


from .models import Project, Task, TodoFolder, TodoItem
from .serializers import (
    ProjectSerializer,
    TaskSerializer,
    TodoFolderSerializer,
    TodoItemSerializer,
)

# Upper bound on rows from the calendar endpoint — far above any real month, but it
# keeps a bad date range from returning the whole table.
CALENDAR_MAX_PROJECTS = 300


class CanEditAssignedWork(BasePermission):
    """An agent may only change work that is theirs.

    Reading is unrestricted (the queryset already scopes customers). For writes:
    admins always pass; an agent passes when the object has no assignees yet —
    so unclaimed work can still be picked up — or when they are one of them. A
    task also counts as theirs when they are on its parent project, since owning
    the project means owning its tasks.
    """

    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True
        user = request.user
        if getattr(user, 'role', None) == User.Role.ADMIN:
            return True
        if getattr(user, 'role', None) != User.Role.AGENT:
            return False

        # A closed project is frozen for agents — its tasks included. Admins can
        # still edit it, which is also how it gets reopened.
        project = getattr(obj, 'project', None)
        if (project or obj).status == Project.Status.CLOSED:
            return False

        owners = {u.id for u in obj.assignees.all()}
        if project is not None:
            owners |= {u.id for u in project.assignees.all()}
        return not owners or user.id in owners


class IsStaffOrReadOnlyCustomer(IsAdminOrAgent):
    """Staff get full access; a customer may only read (their own, per get_queryset)."""

    def has_permission(self, request, view):
        if super().has_permission(request, view):
            return True
        user = request.user
        return bool(
            request.method in SAFE_METHODS
            and user
            and user.is_authenticated
            and user.role == User.Role.CUSTOMER
        )


class ProjectViewSet(viewsets.ModelViewSet):
    serializer_class = ProjectSerializer
    permission_classes = [
        IsAuthenticated,
        CanViewSection('allow_agent_view_projects'),
        IsStaffOrReadOnlyCustomer,
        CanEditAssignedWork,
    ]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['status', 'customer', 'assignees', 'branch']
    search_fields = ['name', 'description']

    def get_queryset(self):
        # customer and created_by are both serialized nested, so join them in one query.
        # Both counts ride the same tasks join, so this stays a single query per page.
        queryset = (
            Project.objects.select_related('customer', 'created_by', 'branch')
            .prefetch_related('assignees')
            .annotate(
                task_count=Count('tasks'),
                done_task_count=Count('tasks', filter=Q(tasks__status=Task.Status.DONE)),
                # The furthest a task reaches — the project's real finish line, which
                # can run past the end date someone typed in.
                last_task_due=Max('tasks__due_date'),
            )
            .order_by('-created_at')
        )
        # A customer sees only what is filed against them — never another customer's
        # work, and never one with no customer at all.
        if self.request.user.role == User.Role.CUSTOMER:
            queryset = queryset.filter(customer=self.request.user)
        return queryset

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def destroy(self, request, *args, **kwargs):
        """A closed project cannot be deleted.

        Closing is how finished work is archived, and deleting takes its tasks and
        history with it — so the two must not be one click apart. This is not a
        dead end: an admin can reopen the project and then delete it, which makes
        discarding a delivery record a deliberate two-step act rather than an
        accident.
        """
        project = self.get_object()
        if project.status == Project.Status.CLOSED:
            return Response(
                {
                    'detail': (
                        'This project is closed and cannot be deleted. Reopen it '
                        'first if you really mean to remove it.'
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['post'])
    def claim(self, request, pk=None):
        """Add or remove yourself from a project's assignees.

        Separate from a full assignee edit on purpose: taking work on is not the
        same as handing it to someone else, so this needs no assignment
        permission. The object permission still applies, which means an agent can
        claim unassigned work or step off their own, but cannot muscle into a
        project that already belongs to another agent.
        """
        project = self.get_object()
        user = request.user
        already_on = project.assignees.filter(pk=user.pk).exists()
        if already_on:
            # Stepping off is its own permission: taking work on is always fine,
            # but dropping it can leave a project quietly unowned.
            if (
                user.role == User.Role.AGENT
                and not user.has_staff_permission('allow_agent_unassign_projects')
            ):
                return Response(
                    {'detail': 'Only admins may remove you from a project.'},
                    status=status.HTTP_403_FORBIDDEN,
                )
            project.assignees.remove(user)
        else:
            project.assignees.add(user)
        serializer = self.get_serializer(self.get_queryset().get(pk=project.pk))
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='calendar', pagination_class=None)
    def calendar(self, request):
        """Projects touching [from, to], for the calendar month view.

        A project shows on the day it was created, on its start day, and on its end
        day, so it is returned when any of those falls inside the window — and also
        when the window sits wholly inside a long project, which would otherwise show
        nothing that month. Matching on creation means a project with no dates set
        still appears somewhere.
        Unpaginated: a calendar needs the whole window, not the first page.
        """
        start = parse_date(request.query_params.get('from') or '')
        end = parse_date(request.query_params.get('to') or '')
        if start is None or end is None:
            return Response(
                {'detail': 'Both `from` and `to` are required (YYYY-MM-DD).'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        starts_in = Q(start_date__gte=start, start_date__lte=end)
        ends_in = Q(end_date__gte=start, end_date__lte=end)
        spans = Q(start_date__lte=start, end_date__gte=end)
        created_in = Q(created_at__date__gte=start, created_at__date__lte=end)
        queryset = self.filter_queryset(self.get_queryset()).filter(
            starts_in | ends_in | spans | created_in
        )
        # Same rule as the ticket calendar: an agent's calendar is their own work.
        # The projects *list* still shows everything, so nothing becomes invisible.
        if request.user.role == User.Role.AGENT:
            queryset = queryset.filter(assignees=request.user).distinct()
        queryset = queryset.order_by('start_date', 'id')[:CALENDAR_MAX_PROJECTS]
        return Response(self.get_serializer(queryset, many=True).data)


class TaskViewSet(viewsets.ModelViewSet):
    serializer_class = TaskSerializer
    permission_classes = [
        IsAuthenticated,
        CanViewSection('allow_agent_view_projects'),
        IsAdminOrAgent,
        CanEditAssignedWork,
    ]
    pagination_class = None
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['project', 'status', 'priority', 'assignees']

    def get_queryset(self):
        return Task.objects.select_related('project', 'created_by').prefetch_related('assignees')

    def perform_create(self, serializer):
        # New tasks land at the bottom of their project rather than silently sharing
        # position 0 with whatever is already first.
        last = Task.objects.filter(project=serializer.validated_data['project']).order_by('-position').first()
        serializer.save(created_by=self.request.user, position=(last.position + 1) if last else 0)

    @action(detail=False, methods=['post'])
    def reorder(self, request):
        """Apply a whole new order for one project's tasks in a single write.

        Body: ``{"project": <id>, "ids": [<task id>, …]}`` — ids in their new order.
        Sending the full list (rather than a from/to pair) keeps the result the same
        no matter how the drag was performed, and makes the request idempotent.
        """
        project_id = request.data.get('project')
        ids = request.data.get('ids')
        if not project_id or not isinstance(ids, list):
            return Response(
                {'detail': 'project and ids are required.'}, status=status.HTTP_400_BAD_REQUEST
            )

        # A list-level action skips has_object_permission, so ownership of the
        # project is checked here — otherwise an agent could reorder another
        # agent's board.
        project = Project.objects.filter(pk=project_id).first()
        if project is None:
            return Response({'project': 'Unknown project.'}, status=status.HTTP_400_BAD_REQUEST)
        if not CanEditAssignedWork().has_object_permission(request, self, project):
            return Response(
                {'detail': 'This project is assigned to someone else.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        tasks = {t.id: t for t in Task.objects.filter(project_id=project_id)}
        # Reject ids from another project (or ones that no longer exist) rather than
        # reordering a partial list and leaving the rest at stale positions.
        unknown = [i for i in ids if i not in tasks]
        if unknown:
            return Response(
                {'ids': f'Not tasks of this project: {unknown}'}, status=status.HTTP_400_BAD_REQUEST
            )

        ordered = [tasks[i] for i in ids]
        for index, task in enumerate(ordered):
            task.position = index
        with transaction.atomic():
            Task.objects.bulk_update(ordered, ['position'])
        return Response({'updated': len(ordered)})


def visible_todo_q(user, prefix=''):
    """Which to-dos `user` may see, as a Q.

    One definition, used both to scope the list and to count a folder's contents, so a
    folder can never advertise "4" and then open onto three. `prefix` re-roots the field
    paths when filtering across a relation (``'items'`` from a folder).
    """
    p = f'{prefix}__' if prefix else ''
    mine = Q(**{f'{p}created_by': user})
    shared = Q(**{f'{p}is_private': False})
    if user.role == User.Role.ADMIN:
        return shared | mine
    # Assigning narrows a shared item to the people it went to; unassigned work stays
    # on the board for anyone to pick up.
    for_me = Q(**{f'{p}assignees': user}) | Q(**{f'{p}assignees__isnull': True})
    return mine | (shared & for_me)


class TodoFolderViewSet(viewsets.ModelViewSet):
    """Named groups for to-dos. Shared folders are the team's — any staff member may add
    or rename one. A private folder is its creator's alone, invisible to everyone else.
    """

    serializer_class = TodoFolderSerializer
    permission_classes = [IsAuthenticated, IsAdminOrAgent]
    pagination_class = None

    def get_queryset(self):
        return (
            TodoFolder.objects.filter(
                Q(is_private=False) | Q(created_by=self.request.user)
            )
            .select_related('created_by')
            # The count each viewer is entitled to: a shared folder holding someone's
            # work assigned elsewhere should not advertise items they cannot open.
            # distinct: the assignees join multiplies rows on a multi-assignee item.
            .annotate(
                item_count=Count(
                    'items',
                    filter=visible_todo_q(self.request.user, 'items'),
                    distinct=True,
                )
            )
        )

    def perform_create(self, serializer):
        last = self.get_queryset().order_by('-position').first()
        serializer.save(
            created_by=self.request.user,
            position=(last.position + 1) if last else 0,
        )

    def perform_destroy(self, instance):
        # SET_NULL on the FK loosens the items rather than deleting them; say so, since
        # "delete folder" reads like it might take the work with it.
        instance.delete()


class TodoItemViewSet(viewsets.ModelViewSet):
    """The internal to-do list, staff only. Two lists in one:

    - **Shared** — the team board. An admin reads all of it. An agent reads the items
      assigned to them, the ones nobody has picked up yet, and anything they wrote
      themselves: handing a job to a colleague should not delete it from your own view.
    - **Private** — items only their author reads. Withheld from everyone else,
      admins included, so "private" means what it says.
    """

    serializer_class = TodoItemSerializer
    permission_classes = [IsAuthenticated, IsAdminOrAgent]
    pagination_class = None
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['done', 'priority', 'assignees', 'customer', 'is_private']
    search_fields = ['title', 'notes']

    def get_queryset(self):
        # The one place visibility is enforced. Every list read, detail read, write and
        # delete goes through here, so an item you cannot see is unreachable by id too —
        # not merely hidden from the list.
        base = TodoItem.objects.prefetch_related('assignees').select_related(
            'created_by', 'customer', 'folder'
        )
        # distinct(): the assignees join inside the rule multiplies rows.
        return base.filter(visible_todo_q(self.request.user)).distinct()

    def perform_create(self, serializer):
        # New items land at the top of the open list, where they will be seen. Ranked
        # against what this user can see, so another person's private item can't nudge it.
        first = self.get_queryset().order_by('position').first()
        serializer.save(
            created_by=self.request.user,
            position=(first.position - 1) if first and first.position > 0 else 0,
        )

    @action(detail=False, methods=['get'], url_path='calendar', pagination_class=None)
    def calendar(self, request):
        """To-dos whose window touches [from, to], for the calendar.

        Only dated items appear — an undated to-do belongs on the list, not on a
        day. Who sees what is decided by get_queryset(), the same as the list: this
        view used to carry its own narrower copy of the rule, so the calendar and the
        list disagreed about which to-dos an agent had.
        """
        start = parse_date(request.query_params.get('from') or '')
        end = parse_date(request.query_params.get('to') or '')
        if start is None or end is None:
            return Response(
                {'detail': 'Both `from` and `to` are required (YYYY-MM-DD).'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        starts_in = Q(start_at__date__gte=start, start_at__date__lte=end)
        ends_in = Q(due_at__date__gte=start, due_at__date__lte=end)
        spans = Q(start_at__date__lte=start, due_at__date__gte=end)
        queryset = self.filter_queryset(self.get_queryset()).filter(
            starts_in | ends_in | spans
        )
        return Response(
            self.get_serializer(queryset.order_by('due_at', 'id')[:CALENDAR_MAX_PROJECTS], many=True).data
        )

    @action(detail=False, methods=['post'])
    def reorder(self, request):
        """Apply a whole new order in one write. Body: ``{"ids": [...]}``."""
        ids = request.data.get('ids')
        if not isinstance(ids, list):
            return Response({'detail': 'ids is required.'}, status=status.HTTP_400_BAD_REQUEST)
        # Through get_queryset(), not TodoItem.objects — otherwise this would reposition
        # (and so confirm the existence of) another person's private items.
        items = {i.id: i for i in self.get_queryset().filter(id__in=ids)}
        unknown = [i for i in ids if i not in items]
        if unknown:
            return Response({'ids': f'Unknown to-dos: {unknown}'}, status=status.HTTP_400_BAD_REQUEST)
        ordered = [items[i] for i in ids]
        for index, item in enumerate(ordered):
            item.position = index
        with transaction.atomic():
            TodoItem.objects.bulk_update(ordered, ['position'])
        return Response({'updated': len(ordered)})
