import secrets

from accounts.models import CustomerBranch, User
from accounts.permissions import (
    CanViewSection,
    HasStaffPermission,
    IsAdmin,
    IsAdminOrAgent,
)
from django.conf import settings
from django.http import HttpResponse
from openpyxl import Workbook
from openpyxl.utils import get_column_letter
from django.db import transaction
from django.db.models import Case, CharField, Count, F, IntegerField, Q, Value, When
from django.db.models.functions import Coalesce
from django.utils import timezone
from django.utils.dateparse import parse_date
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, generics, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    Article,
    ArticleAttachment,
    Attachment,
    Category,
    Comment,
    Ticket,
    TicketActivity,
    TicketPhase,
    TicketSettings,
    normalize_phone,
)
from .filters import TicketFilterSet
from .permissions import CanDeleteTicket, CanEditTicket, CanViewTicket
from .serializers import (
    ArticleAttachmentSerializer,
    ArticleListSerializer,
    ArticleSerializer,
    CategorySerializer,
    CommentSerializer,
    GuestCommentSerializer,
    GuestTicketCreateSerializer,
    GuestTicketPublicSerializer,
    PublicCategorySerializer,
    TicketActivitySerializer,
    TicketArticlesSerializer,
    TicketAssignSerializer,
    TicketCalendarSerializer,
    TicketCollaboratorsSerializer,
    TicketCreateSerializer,
    TicketDeadlineSerializer,
    TicketDetailSerializer,
    TicketListSerializer,
    TicketPhaseSerializer,
    TicketSettingsSerializer,
    TicketStatusUpdateSerializer,
)
from .services import log_activity
from notifications.background import run_in_background
from notifications.emails import email_users, send_mail_async
from notifications.models import Notification, notify
from notifications.whatsapp import notify_staff_new_ticket, send_whatsapp_template


# Upper bound on rows returned by the calendar endpoint — a month of tickets is far below
# this; the cap only guards against a caller asking for a multi-year window.
CALENDAR_MAX_TICKETS = 1000

# Opens the activity entry written when a work phase is logged. Phases are staff-only, and
# older entries carry nothing else to recognise them by, so the activity feed filters a
# customer's view on this.
PHASE_ACTIVITY_PREFIX = 'Phase logged: '


def get_scoped_tickets(user):
    base = Ticket.objects.select_related('customer', 'assigned_agent', 'category')
    # Admins and agents can view every ticket; agents are read-only unless assigned
    # (enforced by the CanEditTicket permission on write actions). Customers see only
    # their own.
    if user.role in (User.Role.ADMIN, User.Role.AGENT):
        return base.all()
    return base.filter(customer=user)


def _ticket_participants(ticket, exclude=None):
    """The ticket's customer, assigned agent, and collaborators — de-duplicated, skipping
    `exclude` (normally whoever triggered the event) and anyone missing."""
    people, seen = [], {exclude.id} if exclude else set()
    for user in [ticket.customer, ticket.assigned_agent, *ticket.collaborators.all()]:
        if user and user.id not in seen:
            seen.add(user.id)
            people.append(user)
    return people


def create_attachments(ticket, files, uploaded_by, comment=None):
    created = []
    for f in files:
        created.append(
            Attachment.objects.create(
                ticket=ticket,
                comment=comment,
                uploaded_by=uploaded_by,
                file=f,
                original_filename=f.name,
                content_type=f.content_type or '',
                size=f.size,
            )
        )
    return created


class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [IsAuthenticated(), IsAdmin()]
        return [IsAuthenticated()]

    def destroy(self, request, *args, **kwargs):
        category = self.get_object()
        if category.children.exists():
            return Response(
                {'detail': 'Remove or move its sub-categories before deleting this category.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if category.tickets.exists():
            return Response(
                {'detail': 'This category is used by existing tickets and cannot be deleted.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)


class ArticleViewSet(viewsets.ModelViewSet):
    """Knowledge-base articles. Published articles are public (readable by anyone incl.
    guests); drafts are visible to staff. Creating/editing/deleting is admin-only."""
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['category', 'is_published']
    search_fields = ['title', 'body']
    ordering_fields = ['title', 'updated_at']
    ordering = ['title']
    pagination_class = None

    def get_queryset(self):
        qs = Article.objects.select_related('category').prefetch_related('attachments')
        user = self.request.user
        is_staff = user.is_authenticated and user.role in (User.Role.ADMIN, User.Role.AGENT)
        if not is_staff:
            qs = qs.filter(is_published=True)
        return qs

    def get_serializer_class(self):
        return ArticleListSerializer if self.action == 'list' else ArticleSerializer

    def get_permissions(self):
        # Reading is public. Managing (create/update/delete) is admin-only unless the
        # "manage knowledge base" permission has been granted to agents in settings.
        if self.action in ('list', 'retrieve'):
            return [AllowAny()]
        return [IsAuthenticated(), HasStaffPermission('allow_agent_manage_kb')]

    def perform_create(self, serializer):
        serializer.save(author=self.request.user if self.request.user.is_authenticated else None)

    @action(detail=True, methods=['post'], url_path='attachments',
            parser_classes=[MultiPartParser, FormParser])
    def add_attachments(self, request, pk=None):
        """Attach one or more files to an article. Kept off create/update so those stay
        JSON — the form uploads files in a second step once the article has an id."""
        article = self.get_object()
        files = request.FILES.getlist('attachments')
        if not files:
            return Response({'attachments': 'No files were uploaded.'},
                            status=status.HTTP_400_BAD_REQUEST)
        for f in files:
            ArticleAttachment.objects.create(
                article=article,
                uploaded_by=request.user if request.user.is_authenticated else None,
                file=f,
                original_filename=f.name,
                content_type=f.content_type or '',
                size=f.size,
            )
        # Query afresh: the list on `article` was prefetched before these files existed.
        return Response(
            ArticleAttachmentSerializer(
                ArticleAttachment.objects.filter(article=article), many=True
            ).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['delete'],
            url_path=r'attachments/(?P<attachment_id>[^/.]+)')
    def remove_attachment(self, request, pk=None, attachment_id=None):
        article = self.get_object()
        attachment = article.attachments.filter(pk=attachment_id).first()
        if attachment is None:
            return Response({'detail': 'Attachment not found.'}, status=status.HTTP_404_NOT_FOUND)
        attachment.file.delete(save=False)
        attachment.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class StableOrderingFilter(filters.OrderingFilter):
    """OrderingFilter with ties broken by id.

    Sorting by a column many tickets share — a priority, a status, an agent — leaves their
    order to the database, which may shuffle them between one page's query and the next;
    paging through the sort would then repeat some tickets and skip others.
    """

    def get_ordering(self, request, queryset, view):
        ordering = super().get_ordering(request, queryset, view)
        if ordering and not any(field.lstrip('-') == 'id' for field in ordering):
            ordering = [*ordering, '-id']
        return ordering


def _priority_rank(field):
    """A priority as a number, low to urgent, so sorting follows importance rather than
    the alphabet (which would put High before Low and Urgent last). Unset ranks lowest."""
    return Case(
        When(**{field: Ticket.Priority.LOW}, then=Value(1)),
        When(**{field: Ticket.Priority.MEDIUM}, then=Value(2)),
        When(**{field: Ticket.Priority.HIGH}, then=Value(3)),
        When(**{field: Ticket.Priority.URGENT}, then=Value(4)),
        default=Value(0),
        output_field=IntegerField(),
    )


class TicketViewSet(viewsets.ModelViewSet):
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, StableOrderingFilter]
    filterset_class = TicketFilterSet
    # Every ticket-table column can be sorted. The *_rank and *_name fields are annotated in
    # get_queryset; `priority` and `customer__customer_priority` stay for older clients.
    ordering_fields = [
        'id', 'subject', 'priority', 'status', 'created_at', 'start_date', 'due_at',
        'assigned_at', 'closed_at', 'customer__customer_priority',
        'priority_rank', 'customer_priority_rank', 'predefined_priority_rank',
        'customer_name', 'parent_category_name', 'sub_category_name', 'assigned_agent_name',
    ]
    ordering = ['-created_at']

    @property
    def search_fields(self):
        # Customers only see their own tickets, so search by subject alone; staff can also
        # search by the customer's name/email.
        if self.request.user.role == User.Role.CUSTOMER:
            return ['subject']
        return ['subject', 'customer__full_name', 'customer__email']

    def get_queryset(self):
        # The sortable values the table shows but the ticket doesn't store as such. The
        # pre-defined priority in force — this ticket's override, else its category's — is
        # worked out first, in its own step, so it can then be ranked like the others.
        return get_scoped_tickets(self.request.user).annotate(
            predefined_priority=Coalesce('category_priority_override', 'category__priority'),
        ).annotate(
            priority_rank=_priority_rank('priority'),
            customer_priority_rank=_priority_rank('customer__customer_priority'),
            predefined_priority_rank=_priority_rank('predefined_priority'),
            # A guest ticket has no customer, so it sorts by the name the guest gave.
            customer_name=Coalesce('customer__full_name', 'guest_name'),
            # The table splits a category into parent and child: a top-level category is
            # its own parent and has no child.
            parent_category_name=Coalesce('category__parent__name', 'category__name'),
            sub_category_name=Case(
                When(category__parent__isnull=False, then=F('category__name')),
                default=Value(''),
                output_field=CharField(),
            ),
            assigned_agent_name=F('assigned_agent__full_name'),
        )

    def get_serializer_class(self):
        if self.action == 'list':
            return TicketListSerializer
        if self.action == 'create':
            return TicketCreateSerializer
        return TicketDetailSerializer

    def get_permissions(self):
        # Staff who cannot see the tickets section are refused every action on
        # it; customers pass this and are then held to the per-object rules,
        # which is what keeps them to their own tickets.
        return [
            CanViewSection('allow_agent_view_tickets'),
            *self._action_permissions(),
        ]

    def _action_permissions(self):
        # Read/watch: any agent, admin, or the ticket's own customer.
        if self.action in ('retrieve', 'comments', 'activity'):
            return [IsAuthenticated(), CanViewTicket()]
        # Delete a ticket: admin or the assigned agent.
        if self.action == 'destroy':
            return [IsAuthenticated(), CanDeleteTicket()]
        # Edit the ticket's own fields: admin or the assigned agent only.
        if self.action in ('status_action', 'set_deadline', 'update', 'partial_update'):
            return [IsAuthenticated(), CanEditTicket()]
        # Assign has its own detailed in-action rules (self-assign / reassign / admin).
        if self.action == 'assign':
            return [IsAuthenticated(), IsAdminOrAgent(), CanViewTicket()]
        # Linking a guest ticket to a customer: any staff member (admin or agent).
        if self.action == 'set_customer':
            return [IsAuthenticated(), IsAdminOrAgent(), CanViewTicket()]
        # Managing collaborators is admin-only.
        if self.action == 'set_collaborators':
            return [IsAuthenticated(), IsAdmin()]
        # Attaching related help articles: any staff member.
        if self.action == 'set_articles':
            return [IsAuthenticated(), IsAdminOrAgent(), CanViewTicket()]
        return [IsAuthenticated()]

    def _closed_lock_response(self, ticket):
        """Return a 403 Response when this ticket is closed and locked for the current
        user, otherwise None. Admins are never locked (they can always reopen). Agents
        are locked unless 'allow_agent_edit_after_close' is on; customers are always
        locked once a ticket is closed."""
        user = self.request.user
        if ticket.status != Ticket.Status.CLOSED:
            return None
        # Admins are held to the same flag rather than waved through: one with no
        # role holds every permission and is unaffected, while a role that
        # withholds this genuinely withholds it from a limited admin.
        if user.has_staff_permission('allow_agent_edit_after_close'):
            return None
        return Response(
            {'detail': 'This ticket is closed. Ask an admin to reopen it or enable '
                       'editing of closed tickets for agents in settings.'},
            status=status.HTTP_403_FORBIDDEN,
        )

    def update(self, request, *args, **kwargs):
        ticket = self.get_object()
        locked = self._closed_lock_response(ticket)
        if locked:
            return locked
        old_priority = ticket.priority
        old_category_priority = ticket.effective_category_priority
        response = super().update(request, *args, **kwargs)
        if response.status_code >= 400:
            return response
        # Priority steers the queue, so raising or lowering one ticket belongs in the
        # timeline the way status and assignment changes do. The other detail edits
        # (subject, description, category, start date) stay unlogged, as before.
        new_priority = response.data.get('priority')
        if new_priority and new_priority != old_priority:
            log_activity(
                ticket, request.user, TicketActivity.ActivityType.PRIORITY_CHANGED,
                f'Requested priority changed from {old_priority} to {new_priority}',
                metadata={'old': old_priority, 'new': new_priority},
            )
        new_category_priority = response.data.get('category_priority')
        if new_category_priority != old_category_priority:
            log_activity(
                ticket, request.user, TicketActivity.ActivityType.PRIORITY_CHANGED,
                f'Pre-defined priority for this ticket changed from '
                f'{old_category_priority or "—"} to {new_category_priority or "—"}',
                metadata={
                    'field': 'category_priority',
                    'old': old_category_priority,
                    'new': new_category_priority,
                },
            )
        return response

    def destroy(self, request, *args, **kwargs):
        # A closed ticket can't be deleted by anyone but an admin (unless agents have the
        # edit-after-close permission) — same lock that protects every other change.
        locked = self._closed_lock_response(self.get_object())
        if locked:
            return locked
        return super().destroy(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        if request.user.role == User.Role.CUSTOMER:
            customer = request.user
            # A customer's ticket always starts on its creation date — they don't pick it.
            serializer.validated_data['start_date'] = timezone.now().date()
            # Nor its priority, unless staff allowed that on their record: it takes the default.
            if not customer.can_set_ticket_priority:
                serializer.validated_data.pop('priority', None)
            # The serializer can only match a branch to a customer sent in the request, and a
            # customer never sends one, so check here that the branch is their own.
            branch = serializer.validated_data.get('branch')
            if branch is not None and branch.customer_id != customer.id:
                return Response(
                    {'branch_id': 'Branch does not belong to this customer.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        else:
            customer = serializer.validated_data.get('customer')
            if customer is None:
                return Response(
                    {'customer_id': 'Required when creating a ticket as an agent or admin.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        serializer.validated_data.pop('assigned_agent', None)
        # Only admins may assign agents at creation time. Multiple agents may be chosen: the
        # first selected becomes the primary assignee, the rest are added as collaborators.
        assigned_agent = None
        extra_collaborators = []
        if request.user.role == User.Role.ADMIN:
            if hasattr(request.data, 'getlist'):
                raw_ids = request.data.getlist('assigned_agent_ids')
            else:
                raw_ids = request.data.get('assigned_agent_ids') or []
            if isinstance(raw_ids, str):
                raw_ids = [raw_ids]
            ids = []
            for value in raw_ids:
                try:
                    ids.append(int(value))
                except (TypeError, ValueError):
                    continue
            agents_by_id = {
                a.id: a
                for a in User.objects.filter(
                    id__in=ids, role__in=[User.Role.AGENT, User.Role.ADMIN]
                )
            }
            ordered = [agents_by_id[i] for i in ids if i in agents_by_id]
            if ordered:
                assigned_agent = ordered[0]
                extra_collaborators = ordered[1:]

        with transaction.atomic():
            ticket = serializer.save(customer=customer, assigned_agent=assigned_agent)
            if assigned_agent:
                ticket.assigned_at = timezone.now()
                ticket.save(update_fields=['assigned_at'])
            if extra_collaborators:
                ticket.collaborators.set(extra_collaborators)
            files = request.FILES.getlist('attachments')
            create_attachments(ticket, files, request.user)
            log_activity(ticket, request.user, TicketActivity.ActivityType.CREATED, 'Ticket created')
            if assigned_agent:
                names = ', '.join(a.full_name for a in [assigned_agent, *extra_collaborators])
                log_activity(
                    ticket, request.user, TicketActivity.ActivityType.ASSIGNED,
                    f'Ticket assigned to {names}',
                )
                # The new-ticket alert below goes to all staff and says nothing about whose
                # ticket it is, so the assignee is told directly — the same notification the
                # assign action sends — unless they picked themselves.
                if assigned_agent != request.user:
                    notify(
                        [assigned_agent],
                        f'Ticket {ticket.reference} was assigned to you by {request.user.full_name}',
                        ticket=ticket,
                        kind=Notification.Kind.ASSIGNED,
                    )
                # Everyone picked after the first joins as a collaborator, and is told so.
                added_collaborators = [a for a in extra_collaborators if a != request.user]
                if added_collaborators:
                    notify(
                        added_collaborators,
                        f'You were added as a collaborator on ticket {ticket.reference} '
                        f'by {request.user.full_name}',
                        ticket=ticket,
                        kind=Notification.Kind.COLLABORATOR_ADDED,
                    )
            # Notify all staff (admins + agents) about the new ticket, except its creator.
            staff = User.objects.filter(
                role__in=[User.Role.ADMIN, User.Role.AGENT]
            ).exclude(pk=request.user.pk)
            notify(
                staff,
                f'New ticket {ticket.reference} from {customer.full_name}: {ticket.subject}',
                ticket=ticket,
                kind=Notification.Kind.NEW_TICKET,
            )
        # WhatsApp the configured staff number(s) that a new ticket is open (no-op unless set).
        run_in_background(notify_staff_new_ticket, ticket)
        output = TicketDetailSerializer(ticket, context=self.get_serializer_context())
        return Response(output.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['patch'], url_path='status')
    def status_action(self, request, pk=None):
        ticket = self.get_object()
        # A ticket's status can't be changed until it's assigned to an agent — an unassigned
        # ticket stays in the "Unassigned" (open) state until someone takes it on.
        if ticket.assigned_agent_id is None:
            return Response(
                {'detail': 'Assign this ticket to an agent before changing its status.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        locked = self._closed_lock_response(ticket)
        if locked:
            return locked
        serializer = TicketStatusUpdateSerializer(ticket, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        old_status = ticket.status
        new_status = serializer.validated_data['status']
        hold_reason = (serializer.validated_data.get('hold_reason') or '').strip()

        if new_status == Ticket.Status.ON_HOLD and not hold_reason:
            return Response(
                {'hold_reason': 'A reason is required when putting a ticket on hold.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        ticket.status = new_status
        # Keep the hold reason only while on hold; clear it otherwise.
        ticket.hold_reason = hold_reason if new_status == Ticket.Status.ON_HOLD else ''
        # Maintain the completion timestamps. resolved_at marks when the ticket was first
        # resolved and must survive a later close so it still counts toward resolution-time
        # reporting; a direct close (never resolved) also stamps resolved_at. Reopening the
        # ticket (moving it back to an active status) clears both.
        now = timezone.now()
        if new_status == Ticket.Status.RESOLVED:
            if ticket.resolved_at is None:
                ticket.resolved_at = now
            ticket.closed_at = None
        elif new_status == Ticket.Status.CLOSED:
            if ticket.resolved_at is None:
                ticket.resolved_at = now
            ticket.closed_at = now
        else:
            ticket.resolved_at = None
            ticket.closed_at = None

        # On the first close, mint a token so we can email the customer a rating link.
        # Skip if they've already rated (e.g. reopened then closed again).
        newly_closed = new_status == Ticket.Status.CLOSED and old_status != Ticket.Status.CLOSED
        if newly_closed and not ticket.rating_submitted_at and not ticket.rating_token:
            ticket.rating_token = secrets.token_urlsafe(32)
        ticket.save()

        description = f'Status changed from {old_status} to {new_status}'
        if new_status == Ticket.Status.ON_HOLD:
            description += f' — reason: {hold_reason}'
        log_activity(
            ticket, request.user, TicketActivity.ActivityType.STATUS_CHANGED,
            description,
            metadata={'old': old_status, 'new': new_status},
        )

        # Notify participants of the status change. Registered users (customer, assigned
        # agent, collaborators — except whoever made the change) get an in-app notification
        # plus an email if they opted in. A guest ticket instead emails the address the
        # guest provided, with a link to the public tracker.
        status_choices = dict(Ticket.Status.choices)
        new_label = status_choices.get(new_status, new_status)
        old_label = status_choices.get(old_status, old_status)
        subject = f'[Ticket {ticket.reference}] Status: {new_label}'
        change_line = (
            f'The status changed from "{old_label}" to "{new_label}" by {request.user.full_name}.'
        )
        hold_line = (
            f'\nReason: {hold_reason}'
            if (new_status == Ticket.Status.ON_HOLD and hold_reason)
            else ''
        )

        recipients = _ticket_participants(ticket, exclude=request.user)
        if recipients:
            notify(recipients, f'Ticket {ticket.reference} status changed to {new_label}', ticket=ticket)
            body = (
                f'Ticket {ticket.reference}: {ticket.subject}\n\n{change_line}{hold_line}'
                f'\n\nView the ticket: {settings.FRONTEND_URL}/tickets/{ticket.id}'
            )
            email_users(recipients, subject, body, 'email_on_status_change')

        if ticket.guest_email:
            guest_body = (
                f'Ticket {ticket.reference}: {ticket.subject}\n\n{change_line}{hold_line}'
                f'\n\nTrack your ticket at {settings.FRONTEND_URL}/guest/track using '
                f'reference number {ticket.id} and your phone number.'
            )
            send_mail_async(subject, guest_body, ticket.guest_email)

        # Guest tickets: also notify the guest on WhatsApp (Meta Cloud API) using the
        # approved template's 3 body variables: ticket id, subject, new status. No-op
        # unless WhatsApp is configured. Backgrounded like the emails — it is an
        # outbound HTTP call and the response does not depend on it.
        if ticket.guest_phone:
            run_in_background(
                send_whatsapp_template,
                ticket.guest_phone,
                [str(ticket.id), ticket.subject, new_label],
            )

        # Ask the customer to rate the experience now that the ticket is closed. Emails a
        # tokenised link the recipient uses to submit a 1–5 rating without logging in.
        if newly_closed and ticket.rating_token:
            rate_email = ticket.customer.email if ticket.customer_id else ticket.guest_email
            if rate_email:
                link = f'{settings.FRONTEND_URL}/rate/{ticket.id}?token={ticket.rating_token}'
                rate_body = (
                    f'Ticket {ticket.reference}: {ticket.subject}\n\n'
                    'Your ticket has been closed. How did we do? We\'d love your feedback — '
                    f'please rate your experience:\n\n{link}\n\nThank you.'
                )
                send_mail_async(
                    f'[Ticket {ticket.reference}] How did we do?',
                    rate_body,
                    rate_email,
                )

        return Response(TicketDetailSerializer(ticket, context=self.get_serializer_context()).data)

    @action(detail=True, methods=['patch'], url_path='deadline')
    def set_deadline(self, request, pk=None):
        ticket = self.get_object()
        locked = self._closed_lock_response(ticket)
        if locked:
            return locked
        serializer = TicketDeadlineSerializer(ticket, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        ticket = serializer.save()
        if ticket.due_at:
            description = f'Deadline set to {ticket.due_at:%Y-%m-%d %H:%M}'
        else:
            description = 'Deadline cleared'
        log_activity(ticket, request.user, TicketActivity.ActivityType.DEADLINE_SET, description)
        return Response(TicketDetailSerializer(ticket, context=self.get_serializer_context()).data)

    @action(detail=True, methods=['patch'], url_path='customer')
    def set_customer(self, request, pk=None):
        """Link a guest ticket to an existing customer, or unlink it (send an empty `customer`).
        The original guest contact details are always kept, so a mistaken link can be undone."""
        ticket = self.get_object()
        locked = self._closed_lock_response(ticket)
        if locked:
            return locked
        # Governed by the "link ticket customer" permission: admins always, agents when enabled.
        if request.user.role == User.Role.AGENT and not request.user.has_staff_permission('allow_agent_link_customer'):
            return Response(
                {'detail': 'You are not permitted to change a ticket\'s customer.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        is_guest_origin = bool(
            ticket.guest_name or ticket.guest_phone or ticket.guest_email or ticket.guest_company
        )
        raw = request.data.get('customer')

        # Empty value ⇒ unlink. Only allowed for guest-origin tickets so a customer-created
        # ticket is never left without an owner.
        if raw in (None, '', 'null'):
            if ticket.customer_id is None:
                return Response(
                    {'detail': 'This ticket has no linked customer.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if not is_guest_origin:
                return Response(
                    {'detail': 'This ticket was created by a customer and cannot be unlinked.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            removed = ticket.customer.full_name
            ticket.customer = None
            ticket.branch = None
            ticket.save(update_fields=['customer', 'branch'])
            log_activity(
                ticket, request.user, TicketActivity.ActivityType.CUSTOMER_LINKED,
                f'Removed customer {removed}',
            )
            return Response(TicketDetailSerializer(ticket, context=self.get_serializer_context()).data)

        if ticket.customer_id is not None:
            return Response(
                {'detail': 'This ticket already belongs to a customer.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        customer = User.objects.filter(id=raw, role=User.Role.CUSTOMER).first()
        if customer is None:
            return Response(
                {'customer': 'Select a valid customer.'}, status=status.HTTP_400_BAD_REQUEST
            )
        # Optionally attach one of the customer's branches.
        branch = None
        branch_id = request.data.get('branch')
        if branch_id not in (None, '', 'null'):
            branch = CustomerBranch.objects.filter(id=branch_id, customer=customer).first()
            if branch is None:
                return Response(
                    {'branch': 'Branch does not belong to this customer.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        ticket.customer = customer
        ticket.branch = branch
        update_fields = ['customer', 'branch']
        # If the guest never left an email, adopt the linked customer's email so the ticket
        # still has a contact address for notifications.
        if not ticket.guest_email and customer.email:
            ticket.guest_email = customer.email
            update_fields.append('guest_email')
        ticket.save(update_fields=update_fields)
        detail = f'Linked to customer {customer.full_name}'
        if branch:
            detail += f' (branch: {branch.name})'
        log_activity(
            ticket, request.user, TicketActivity.ActivityType.CUSTOMER_LINKED, detail,
        )
        return Response(TicketDetailSerializer(ticket, context=self.get_serializer_context()).data)

    @action(detail=True, methods=['patch'], url_path='assign')
    def assign(self, request, pk=None):
        ticket = self.get_object()
        locked = self._closed_lock_response(ticket)
        if locked:
            return locked

        if request.user.role == User.Role.AGENT:
            target = request.data.get('assigned_agent')
            is_release = target in (None, '', 'null')
            is_self = target in (request.user.id, str(request.user.id))

            if is_release:
                # Agents may claim a ticket but cannot unassign/release it once taken;
                # only an admin can remove the assignment.
                return Response(
                    {'detail': 'Agents cannot unassign tickets.'},
                    status=status.HTTP_403_FORBIDDEN,
                )
            elif is_self:
                # Claiming for self — governed by the self-assign permission.
                if not request.user.has_staff_permission('allow_agent_self_assign'):
                    return Response(
                        {'detail': 'Agents are not permitted to assign tickets.'},
                        status=status.HTTP_403_FORBIDDEN,
                    )
                if ticket.assigned_agent_id not in (None, request.user.id):
                    return Response(
                        {'detail': 'This ticket is already assigned to another agent.'},
                        status=status.HTTP_403_FORBIDDEN,
                    )
            else:
                # Handing off to a different agent — governed by the reassign permission,
                # and only allowed for the agent the ticket is currently assigned to.
                if not request.user.has_staff_permission('allow_agent_reassign'):
                    return Response(
                        {'detail': 'Agents are not permitted to reassign tickets to others.'},
                        status=status.HTTP_403_FORBIDDEN,
                    )
                if ticket.assigned_agent_id != request.user.id:
                    return Response(
                        {'detail': 'You can only reassign a ticket that is assigned to you.'},
                        status=status.HTTP_403_FORBIDDEN,
                    )
        elif request.user.role != User.Role.ADMIN:
            return Response(
                {'detail': 'You do not have permission to assign tickets.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        old_agent_id = ticket.assigned_agent_id
        serializer = TicketAssignSerializer(ticket, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        was_assigned = old_agent_id is not None
        ticket = serializer.save()

        # Record when the (new) agent was assigned; clear it when unassigned.
        new_agent_id = ticket.assigned_agent_id
        if new_agent_id is None:
            ticket.assigned_at = None
            ticket.save(update_fields=['assigned_at'])
        elif new_agent_id != old_agent_id:
            ticket.assigned_at = timezone.now()
            ticket.save(update_fields=['assigned_at'])

        activity_type = (
            TicketActivity.ActivityType.REASSIGNED if was_assigned
            else TicketActivity.ActivityType.ASSIGNED
        )
        agent_name = ticket.assigned_agent.full_name if ticket.assigned_agent else 'nobody'
        log_activity(ticket, request.user, activity_type, f'Ticket assigned to {agent_name}')

        # Tell the newly assigned agent who assigned them (unless they claimed it themselves).
        if (
            ticket.assigned_agent_id
            and ticket.assigned_agent_id != old_agent_id
            and ticket.assigned_agent_id != request.user.id
        ):
            notify(
                [ticket.assigned_agent],
                f'Ticket {ticket.reference} was assigned to you by {request.user.full_name}',
                ticket=ticket,
                kind=Notification.Kind.ASSIGNED,
            )
            email_users(
                [ticket.assigned_agent],
                f'Ticket {ticket.reference} was assigned to you',
                f'Ticket {ticket.reference}: {ticket.subject}\n\n'
                f'{request.user.full_name} assigned this ticket to you.\n\n'
                f'View the ticket: {settings.FRONTEND_URL}/tickets/{ticket.id}',
                'email_on_assignment',
            )
        return Response(TicketDetailSerializer(ticket, context=self.get_serializer_context()).data)

    @action(detail=True, methods=['patch'], url_path='collaborators')
    def set_collaborators(self, request, pk=None):
        ticket = self.get_object()
        previous = set(ticket.collaborators.values_list('pk', flat=True))
        serializer = TicketCollaboratorsSerializer(ticket, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        ticket = serializer.save()
        names = ', '.join(a.full_name for a in ticket.collaborators.all()) or 'none'
        log_activity(
            ticket, request.user, TicketActivity.ActivityType.ASSIGNED,
            f'Collaborating agents set to: {names}',
        )
        # Only people newly added hear about it — saving the same list again alerts nobody —
        # and never whoever made the change.
        added = ticket.collaborators.exclude(pk__in=previous).exclude(pk=request.user.pk)
        if added.exists():
            notify(
                added,
                f'You were added as a collaborator on ticket {ticket.reference} '
                f'by {request.user.full_name}',
                ticket=ticket,
                kind=Notification.Kind.COLLABORATOR_ADDED,
            )
        return Response(TicketDetailSerializer(ticket, context=self.get_serializer_context()).data)

    @action(detail=True, methods=['patch'], url_path='articles')
    def set_articles(self, request, pk=None):
        """Attach/detach related knowledge-base articles (staff only)."""
        ticket = self.get_object()
        serializer = TicketArticlesSerializer(ticket, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        ticket = serializer.save()
        return Response(TicketDetailSerializer(ticket, context=self.get_serializer_context()).data)

    @action(detail=True, methods=['get', 'post'], url_path='comments')
    def comments(self, request, pk=None):
        ticket = self.get_object()
        if request.method == 'GET':
            comments = ticket.comments.select_related('author').prefetch_related('attachments')
            return Response(CommentSerializer(comments, many=True, context=self.get_serializer_context()).data)

        # Any agent may watch, but only the assigned agent, a collaborating agent, the
        # admin, or the ticket's own customer may respond.
        can_respond = (
            request.user.role == User.Role.ADMIN
            or request.user == ticket.assigned_agent
            or request.user == ticket.customer
            or ticket.collaborators.filter(pk=request.user.pk).exists()
        )
        if not can_respond:
            return Response(
                {'detail': 'Only the assigned agent can respond to this ticket.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        locked = self._closed_lock_response(ticket)
        if locked:
            return locked

        body = request.data.get('body', '')
        if not body:
            return Response({'body': 'This field is required.'}, status=status.HTTP_400_BAD_REQUEST)
        with transaction.atomic():
            comment = Comment.objects.create(ticket=ticket, author=request.user, body=body)
            files = request.FILES.getlist('attachments')
            create_attachments(ticket, files, request.user, comment=comment)
            log_activity(ticket, request.user, TicketActivity.ActivityType.COMMENTED, 'Added a comment')
            if files:
                log_activity(
                    ticket, request.user, TicketActivity.ActivityType.ATTACHMENT_ADDED,
                    f'Added {len(files)} attachment(s)',
                )
            # Everyone on the ticket except whoever just wrote it.
            recipients = _ticket_participants(ticket, exclude=request.user)
            if recipients:
                notify(
                    recipients,
                    f'{request.user.full_name} commented on ticket {ticket.reference}',
                    ticket=ticket,
                )
                email_body = (
                    f'Ticket {ticket.reference}: {ticket.subject}\n\n'
                    f'{request.user.full_name} wrote:\n{body}\n\n'
                    f'View the ticket: {settings.FRONTEND_URL}/tickets/{ticket.id}'
                )
                email_users(
                    recipients,
                    f'New comment on ticket {ticket.reference}',
                    email_body,
                    'email_on_new_comment',
                )
        return Response(
            CommentSerializer(comment, context=self.get_serializer_context()).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['get', 'post'], url_path='phases')
    def phases(self, request, pk=None):
        """Work phases logged against the ticket: the staff side of the work, so staff-only to
        read as well as to write — a customer never sees them."""
        ticket = self.get_object()
        if request.user.role == User.Role.CUSTOMER:
            return Response(
                {'detail': 'Work phases are only visible to staff.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        if request.method == 'GET':
            phases = ticket.phases.select_related('author')
            return Response(
                TicketPhaseSerializer(phases, many=True, context=self.get_serializer_context()).data
            )

        can_add = (
            request.user.role == User.Role.ADMIN
            or request.user == ticket.assigned_agent
            or ticket.collaborators.filter(pk=request.user.pk).exists()
        )
        if not can_add:
            return Response(
                {'detail': 'Only the assigned agent can add phases to this ticket.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        locked = self._closed_lock_response(ticket)
        if locked:
            return locked

        body = (request.data.get('body') or '').strip()
        if not body:
            return Response({'body': 'This field is required.'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            phase = TicketPhase.objects.create(ticket=ticket, author=request.user, body=body)
            log_activity(
                ticket, request.user, TicketActivity.ActivityType.STATUS_CHANGED,
                f'{PHASE_ACTIVITY_PREFIX}{body}',
            )
        return Response(
            TicketPhaseSerializer(phase, context=self.get_serializer_context()).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['delete'], url_path=r'phases/(?P<phase_id>\d+)')
    def delete_phase(self, request, pk=None, phase_id=None):
        """Remove a phase. Its author or an admin, and never on a closed-locked ticket."""
        ticket = self.get_object()
        phase = ticket.phases.filter(pk=phase_id).first()
        if phase is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        if not (request.user.role == User.Role.ADMIN or phase.author_id == request.user.pk):
            return Response(
                {'detail': 'You can only remove your own phases.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        locked = self._closed_lock_response(ticket)
        if locked:
            return locked
        phase.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['get'], url_path='activity')
    def activity(self, request, pk=None):
        ticket = self.get_object()
        activities = ticket.activities.select_related('actor')
        # A logged phase repeats the phase's text, so it goes wherever the phases themselves
        # don't: out of a customer's view.
        if request.user.role == User.Role.CUSTOMER:
            activities = activities.exclude(description__startswith=PHASE_ACTIVITY_PREFIX)
        return Response(TicketActivitySerializer(activities, many=True).data)

    @action(detail=False, methods=['get'], url_path='calendar', pagination_class=None)
    def calendar(self, request):
        """Tickets that belong somewhere in [from, to], for the calendar month view.

        A closed ticket appears twice — on its start date and on its close date — so it's
        fetched if either falls in the window.

        Unpaginated on purpose — a calendar needs every ticket in the window, not the first
        page — so the window is required and the result is capped. The usual filters
        (status, priority, agent, …) still apply through filter_queryset."""
        start = parse_date(request.query_params.get('from') or '')
        end = parse_date(request.query_params.get('to') or '')
        if start is None or end is None:
            return Response(
                {'detail': 'Both `from` and `to` are required (YYYY-MM-DD).'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        # Either date can place a ticket in this window: a ticket started in June and closed
        # in July belongs to July's grid, and one started in July shows there even if it
        # closes later.
        in_window = Q(start_date__gte=start, start_date__lte=end)
        closed_in_window = Q(
            status=Ticket.Status.CLOSED, closed_at__date__gte=start, closed_at__date__lte=end
        )
        queryset = (
            self.filter_queryset(self.get_queryset())
            .filter(in_window | closed_in_window)
            .select_related('assigned_agent')
        )
        # The calendar answers "what is on my plate", so an agent sees their own
        # work — assigned to them or collaborating on it. Admins see everything,
        # and a customer's queryset is already limited to their own tickets.
        if request.user.role == User.Role.AGENT:
            queryset = queryset.filter(
                Q(assigned_agent=request.user) | Q(collaborators=request.user)
            ).distinct()
        queryset = queryset.order_by('start_date', 'id')[:CALENDAR_MAX_TICKETS]
        # Context carries the request, which the serializer needs to build absolute
        # avatar URLs.
        return Response(
            TicketCalendarSerializer(queryset, many=True, context=self.get_serializer_context()).data
        )

    @action(detail=False, methods=['get'], url_path='export')
    def export(self, request):
        """Download the current (filtered, scoped) ticket list as an .xlsx file."""
        queryset = self.filter_queryset(self.get_queryset()).select_related(
            'customer', 'assigned_agent', 'category'
        )
        status_labels = dict(Ticket.Status.choices)
        priority_labels = dict(Ticket.Priority.choices)

        def naive(dt):
            # openpyxl can't write timezone-aware datetimes — convert to local naive.
            return timezone.localtime(dt).replace(tzinfo=None) if dt else None

        wb = Workbook()
        ws = wb.active
        ws.title = 'Tickets'
        # Staff's ranking of each customer goes in beside the ticket's own priority; a
        # customer exporting their own tickets doesn't get it.
        with_customer_priority = request.user.role != User.Role.CUSTOMER
        headers = [
            'Reference', 'ID', 'Subject', 'Customer', 'Category', 'Requested priority',
            *(['Customer priority'] if with_customer_priority else []),
            'Status', 'Assigned agent', 'Created', 'Start date', 'Due', 'Resolved', 'Closed',
            'Rating',
        ]
        ws.append(headers)
        for tk in queryset:
            customer = tk.customer.full_name if tk.customer_id else (tk.guest_name or 'Guest')
            customer_priority = (
                priority_labels.get(tk.customer.customer_priority, '') if tk.customer_id else ''
            )
            ws.append([
                tk.reference,
                tk.id,
                tk.subject,
                customer,
                tk.category.name if tk.category_id else '',
                priority_labels.get(tk.priority, tk.priority),
                *([customer_priority] if with_customer_priority else []),
                status_labels.get(tk.status, tk.status),
                tk.assigned_agent.full_name if tk.assigned_agent_id else '',
                naive(tk.created_at),
                tk.start_date,
                naive(tk.due_at),
                naive(tk.resolved_at),
                naive(tk.closed_at),
                tk.rating,
            ])
        for i, header in enumerate(headers, start=1):
            ws.column_dimensions[get_column_letter(i)].width = max(12, len(header) + 2)

        response = HttpResponse(
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        response['Content-Disposition'] = 'attachment; filename="tickets.xlsx"'
        wb.save(response)
        return response


class TicketSettingsView(generics.RetrieveUpdateAPIView):
    serializer_class = TicketSettingsSerializer

    def get_object(self):
        return TicketSettings.get_solo()

    def get_permissions(self):
        if self.request.method in ('PATCH', 'PUT'):
            return [IsAuthenticated(), IsAdmin()]
        return [IsAuthenticated()]


# "Assigned" is not a stored status. A ticket handed to an agent but not yet started stays
# in OPEN, which the UI shows as "Unassigned" while it has no agent and "Assigned" once it
# does. The dashboard filter exposes those as two separate choices, so OPEN here means
# strictly "nobody has taken it yet".
DASHBOARD_ASSIGNED = 'assigned'


def _dashboard_status_q(name):
    """Q object for one dashboard status choice, splitting OPEN by whether it has an agent."""
    if name == Ticket.Status.OPEN:
        return Q(status=Ticket.Status.OPEN, assigned_agent__isnull=True)
    if name == DASHBOARD_ASSIGNED:
        return Q(status=Ticket.Status.OPEN, assigned_agent__isnull=False)
    return Q(status=name)


class DashboardView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        queryset = get_scoped_tickets(request.user)

        valid_statuses = {*dict(Ticket.Status.choices), DASHBOARD_ASSIGNED}
        status_param = request.query_params.get('status')
        if status_param is not None:
            # Comma-separated list; empty string means "none selected".
            statuses = [s for s in status_param.split(',') if s in valid_statuses]
        else:
            statuses = [Ticket.Status.OPEN, DASHBOARD_ASSIGNED]

        if statuses:
            status_q = Q()
            for name in statuses:
                status_q |= _dashboard_status_q(name)
            tickets_qs = queryset.filter(status_q)
        else:
            tickets_qs = queryset.none()

        # Optional created-date range filter (YYYY-MM-DD).
        date_from = request.query_params.get('date_from')
        date_to = request.query_params.get('date_to')
        if date_from:
            tickets_qs = tickets_qs.filter(created_at__date__gte=date_from)
        if date_to:
            tickets_qs = tickets_qs.filter(created_at__date__lte=date_to)

        # The tiles describe the filtered set, so they're aggregated over the very queryset
        # the table below is drawn from. Counting the unfiltered scope here left the tiles
        # frozen while the filters visibly changed the list under them.
        counts = tickets_qs.aggregate(
            total=Count('id'),
            open=Count('id', filter=_dashboard_status_q(Ticket.Status.OPEN)),
            assigned=Count('id', filter=_dashboard_status_q(DASHBOARD_ASSIGNED)),
            in_progress=Count('id', filter=Q(status=Ticket.Status.IN_PROGRESS)),
            resolved=Count('id', filter=Q(status=Ticket.Status.RESOLVED)),
        )

        recent = tickets_qs.order_by('-created_at')[:10]
        return Response({
            'role': request.user.role,
            'stats': counts,
            'status_filter': statuses,
            'recent_tickets': TicketListSerializer(recent, many=True, context=self.get_serializer_context()).data,
        })


# ---------------------------------------------------------------------------
# Guest (unauthenticated) ticketing
# ---------------------------------------------------------------------------

def _find_guest_ticket(reference, phone):
    """Return the guest ticket matching (reference AND phone), else None. Requiring both the
    reference number and the phone keeps guest tickets from being enumerable. Accepts the full
    serial (HERMES-TKT-26-000123) or, for older tickets, a bare numeric id."""
    raw = str(reference or '').strip()
    if not raw:
        return None
    # Any guest-origin ticket (one that carries a guest phone) is trackable — including
    # after staff have linked it to a customer account. The phone check below still gates
    # access, so linking a customer never locks the original guest out of their tracker.
    guests = Ticket.objects.exclude(guest_phone='')
    ticket = guests.filter(reference__iexact=raw).first()
    if ticket is None:
        try:
            ticket = guests.filter(id=int(raw.lstrip('#'))).first()
        except (TypeError, ValueError):
            ticket = None
    if ticket is None:
        return None
    if normalize_phone(ticket.guest_phone) != normalize_phone(phone or ''):
        return None
    return ticket


class PublicCategoriesView(generics.ListAPIView):
    """Category list for the public guest form (no auth)."""
    permission_classes = [AllowAny]
    pagination_class = None
    serializer_class = PublicCategorySerializer
    queryset = Category.objects.all()


class GuestTicketCreateView(generics.CreateAPIView):
    """Create a ticket without an account. Returns the reference number the guest uses
    (together with their phone) to track it."""
    permission_classes = [AllowAny]
    serializer_class = GuestTicketCreateSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            # A guest ticket always starts on its creation date.
            ticket = serializer.save(
                customer=None, assigned_agent=None, status=Ticket.Status.OPEN,
                start_date=timezone.now().date(),
            )
            files = request.FILES.getlist('attachments')
            create_attachments(ticket, files, None)
            log_activity(ticket, None, TicketActivity.ActivityType.CREATED, 'Guest ticket created')
            staff = User.objects.filter(role__in=[User.Role.ADMIN, User.Role.AGENT])
            notify(
                staff,
                f'New guest ticket {ticket.reference} from {ticket.guest_name}: {ticket.subject}',
                ticket=ticket,
                kind=Notification.Kind.NEW_TICKET,
            )
        # WhatsApp the configured staff number(s) that a new ticket is open (no-op unless set).
        run_in_background(notify_staff_new_ticket, ticket)
        return Response(
            {'id': ticket.id, 'reference': ticket.reference, 'subject': ticket.subject, 'status': ticket.status},
            status=status.HTTP_201_CREATED,
        )


class GuestTicketTrackView(APIView):
    """Look up a guest ticket by reference number + phone."""
    permission_classes = [AllowAny]

    def post(self, request):
        ticket = _find_guest_ticket(request.data.get('reference'), request.data.get('phone'))
        if ticket is None:
            return Response(
                {'detail': 'No ticket found for that reference number and phone.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(GuestTicketPublicSerializer(ticket, context={'request': request}).data)


class GuestTicketReplyView(APIView):
    """Let a guest post a reply on their own ticket (verified by reference + phone),
    optionally with files attached to it — the same way a staff comment carries them."""
    permission_classes = [AllowAny]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request):
        ticket = _find_guest_ticket(request.data.get('reference'), request.data.get('phone'))
        if ticket is None:
            return Response(
                {'detail': 'No ticket found for that reference number and phone.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        body = (request.data.get('body') or '').strip()
        if not body:
            return Response({'body': 'This field is required.'}, status=status.HTTP_400_BAD_REQUEST)
        with transaction.atomic():
            comment = Comment.objects.create(
                ticket=ticket, author=None, guest_name=ticket.guest_name, body=body
            )
            files = request.FILES.getlist('attachments')
            create_attachments(ticket, files, None, comment=comment)
            log_activity(ticket, None, TicketActivity.ActivityType.COMMENTED, 'Guest added a comment')
            if files:
                log_activity(
                    ticket, None, TicketActivity.ActivityType.ATTACHMENT_ADDED,
                    f'Guest added {len(files)} attachment(s)',
                )
            # Notify the assigned agent (or all staff if unassigned) about the guest reply.
            if ticket.assigned_agent:
                staff = User.objects.filter(pk=ticket.assigned_agent_id)
            else:
                staff = User.objects.filter(role__in=[User.Role.ADMIN, User.Role.AGENT])
            notify(staff, f'Guest replied on ticket {ticket.reference}: {ticket.subject}', ticket=ticket)
        return Response(
            GuestCommentSerializer(comment, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )


def _parse_score(request):
    """Return an int 1–5 from request.data['score'], or None if invalid."""
    try:
        score = int(request.data.get('score'))
    except (TypeError, ValueError):
        return None
    return score if 1 <= score <= 5 else None


def _apply_rating(ticket, score, comment):
    """Store a rating on the ticket, log it, and notify staff."""
    ticket.rating = score
    ticket.rating_comment = (comment or '').strip()
    ticket.rating_submitted_at = timezone.now()
    ticket.save(update_fields=['rating', 'rating_comment', 'rating_submitted_at'])
    log_activity(
        ticket, None, TicketActivity.ActivityType.RATED,
        f'Customer rated the ticket {score}/5', metadata={'score': score},
    )
    if ticket.assigned_agent_id:
        staff = User.objects.filter(pk=ticket.assigned_agent_id)
    else:
        staff = User.objects.filter(role__in=[User.Role.ADMIN, User.Role.AGENT])
    notify(staff, f'Ticket {ticket.reference} was rated {score}/5', ticket=ticket)


class TicketRatingView(APIView):
    """Public customer-satisfaction rating for a closed ticket, gated by the token emailed
    when the ticket was closed (works for both registered customers and guests)."""
    permission_classes = [AllowAny]

    def _resolve(self, request):
        """Return the ticket if the (ticket id, token) pair is valid, else None."""
        raw_id = request.query_params.get('ticket') or request.data.get('ticket')
        token = request.query_params.get('token') or request.data.get('token')
        if not raw_id or not token:
            return None
        try:
            ticket = Ticket.objects.filter(id=int(raw_id)).first()
        except (TypeError, ValueError):
            return None
        if ticket is None or not ticket.rating_token:
            return None
        if not secrets.compare_digest(str(token), ticket.rating_token):
            return None
        return ticket

    def get(self, request):
        ticket = self._resolve(request)
        if ticket is None:
            return Response({'detail': 'This rating link is invalid or expired.'},
                            status=status.HTTP_404_NOT_FOUND)
        return Response({
            'reference': ticket.reference,
            'subject': ticket.subject,
            'rated': ticket.rating_submitted_at is not None,
            'rating': ticket.rating,
            'comment': ticket.rating_comment,
        })

    def post(self, request):
        ticket = self._resolve(request)
        if ticket is None:
            return Response({'detail': 'This rating link is invalid or expired.'},
                            status=status.HTTP_404_NOT_FOUND)
        if ticket.rating_submitted_at is not None:
            return Response({'detail': 'This ticket has already been rated.'},
                            status=status.HTTP_400_BAD_REQUEST)
        score = _parse_score(request)
        if score is None:
            return Response({'score': 'Choose a rating from 1 to 5.'},
                            status=status.HTTP_400_BAD_REQUEST)
        _apply_rating(ticket, score, request.data.get('comment'))
        return Response({'detail': 'Thank you for your feedback.', 'rating': score})


class GuestTicketRateView(APIView):
    """Let a guest rate their closed ticket straight from the tracking page (verified by
    reference + phone, so no emailed token is needed)."""
    permission_classes = [AllowAny]

    def post(self, request):
        ticket = _find_guest_ticket(request.data.get('reference'), request.data.get('phone'))
        if ticket is None:
            return Response(
                {'detail': 'No ticket found for that reference number and phone.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        if ticket.status != Ticket.Status.CLOSED:
            return Response({'detail': 'Only closed tickets can be rated.'},
                            status=status.HTTP_400_BAD_REQUEST)
        if ticket.rating_submitted_at is not None:
            return Response({'detail': 'This ticket has already been rated.'},
                            status=status.HTTP_400_BAD_REQUEST)
        score = _parse_score(request)
        if score is None:
            return Response({'score': 'Choose a rating from 1 to 5.'},
                            status=status.HTTP_400_BAD_REQUEST)
        _apply_rating(ticket, score, request.data.get('comment'))
        return Response({'detail': 'Thank you for your feedback.', 'rating': score})
