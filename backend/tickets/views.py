from accounts.models import CustomerBranch, User
from accounts.permissions import IsAdmin, IsAdminOrAgent
from django.conf import settings
from django.core.mail import send_mail
from django.db import transaction
from django.db.models import Count, Q
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, generics, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    Attachment,
    Category,
    Comment,
    Ticket,
    TicketActivity,
    TicketSettings,
    normalize_phone,
)
from .filters import TicketFilterSet
from .permissions import CanDeleteTicket, CanEditTicket, CanViewTicket
from .serializers import (
    CategorySerializer,
    CommentSerializer,
    GuestCommentSerializer,
    GuestTicketCreateSerializer,
    GuestTicketPublicSerializer,
    PublicCategorySerializer,
    TicketActivitySerializer,
    TicketAssignSerializer,
    TicketCollaboratorsSerializer,
    TicketCreateSerializer,
    TicketDeadlineSerializer,
    TicketDetailSerializer,
    TicketListSerializer,
    TicketSettingsSerializer,
    TicketStatusUpdateSerializer,
)
from .services import log_activity
from notifications.emails import email_users
from notifications.models import notify
from notifications.whatsapp import send_whatsapp_template


def get_scoped_tickets(user):
    base = Ticket.objects.select_related('customer', 'assigned_agent', 'category')
    # Admins and agents can view every ticket; agents are read-only unless assigned
    # (enforced by the CanEditTicket permission on write actions). Customers see only
    # their own.
    if user.role in (User.Role.ADMIN, User.Role.AGENT):
        return base.all()
    return base.filter(customer=user)


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


class TicketViewSet(viewsets.ModelViewSet):
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = TicketFilterSet
    ordering_fields = ['id', 'subject', 'priority', 'status', 'created_at', 'start_date', 'due_at', 'assigned_at']
    ordering = ['-created_at']

    @property
    def search_fields(self):
        # Customers only see their own tickets, so search by subject alone; staff can also
        # search by the customer's name/email.
        if self.request.user.role == User.Role.CUSTOMER:
            return ['subject']
        return ['subject', 'customer__full_name', 'customer__email']

    def get_queryset(self):
        return get_scoped_tickets(self.request.user)

    def get_serializer_class(self):
        if self.action == 'list':
            return TicketListSerializer
        if self.action == 'create':
            return TicketCreateSerializer
        return TicketDetailSerializer

    def get_permissions(self):
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
        return [IsAuthenticated()]

    def _closed_lock_response(self, ticket):
        """Return a 403 Response when this ticket is closed and locked for the current
        user, otherwise None. Admins are never locked (they can always reopen). Agents
        are locked unless 'allow_agent_edit_after_close' is on; customers are always
        locked once a ticket is closed."""
        user = self.request.user
        if ticket.status != Ticket.Status.CLOSED:
            return None
        if user.role == User.Role.ADMIN:
            return None
        if user.role == User.Role.AGENT and TicketSettings.get_solo().allow_agent_edit_after_close:
            return None
        return Response(
            {'detail': 'This ticket is closed. Ask an admin to reopen it or enable '
                       'editing of closed tickets for agents in settings.'},
            status=status.HTTP_403_FORBIDDEN,
        )

    def update(self, request, *args, **kwargs):
        locked = self._closed_lock_response(self.get_object())
        if locked:
            return locked
        return super().update(request, *args, **kwargs)

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
            agents_by_id = {a.id: a for a in User.objects.filter(id__in=ids, role=User.Role.AGENT)}
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
            # Notify all staff (admins + agents) about the new ticket, except its creator.
            staff = User.objects.filter(
                role__in=[User.Role.ADMIN, User.Role.AGENT]
            ).exclude(pk=request.user.pk)
            notify(
                staff,
                f'New ticket {ticket.reference} from {customer.full_name}: {ticket.subject}',
                ticket=ticket,
            )
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
        if new_status == Ticket.Status.RESOLVED:
            ticket.resolved_at = timezone.now()
        elif ticket.resolved_at is not None:
            ticket.resolved_at = None
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

        recipients, seen = [], {request.user.id}
        for u in [ticket.customer, ticket.assigned_agent, *ticket.collaborators.all()]:
            if u and u.id not in seen:
                seen.add(u.id)
                recipients.append(u)
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
            send_mail(subject, guest_body, settings.DEFAULT_FROM_EMAIL, [ticket.guest_email],
                      fail_silently=True)

        # Guest tickets: also notify the guest on WhatsApp (Meta Cloud API) using the
        # approved template's 3 body variables: ticket id, subject, new status. No-op
        # unless WhatsApp is configured.
        if ticket.guest_phone:
            send_whatsapp_template(ticket.guest_phone, [str(ticket.id), ticket.subject, new_label])

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
        if request.user.role == User.Role.AGENT and not TicketSettings.get_solo().allow_agent_link_customer:
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
        ticket.save(update_fields=['customer', 'branch'])
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
            ticket_settings = TicketSettings.get_solo()
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
                if not ticket_settings.allow_agent_self_assign:
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
                if not ticket_settings.allow_agent_reassign:
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
            )
        return Response(TicketDetailSerializer(ticket, context=self.get_serializer_context()).data)

    @action(detail=True, methods=['patch'], url_path='collaborators')
    def set_collaborators(self, request, pk=None):
        ticket = self.get_object()
        serializer = TicketCollaboratorsSerializer(ticket, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        ticket = serializer.save()
        names = ', '.join(a.full_name for a in ticket.collaborators.all()) or 'none'
        log_activity(
            ticket, request.user, TicketActivity.ActivityType.ASSIGNED,
            f'Collaborating agents set to: {names}',
        )
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
        return Response(
            CommentSerializer(comment, context=self.get_serializer_context()).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['get'], url_path='activity')
    def activity(self, request, pk=None):
        ticket = self.get_object()
        activities = ticket.activities.select_related('actor')
        return Response(TicketActivitySerializer(activities, many=True).data)


class TicketSettingsView(generics.RetrieveUpdateAPIView):
    serializer_class = TicketSettingsSerializer

    def get_object(self):
        return TicketSettings.get_solo()

    def get_permissions(self):
        if self.request.method in ('PATCH', 'PUT'):
            return [IsAuthenticated(), IsAdmin()]
        return [IsAuthenticated()]


class DashboardView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        queryset = get_scoped_tickets(request.user)
        counts = queryset.aggregate(
            total=Count('id'),
            open=Count('id', filter=Q(status=Ticket.Status.OPEN)),
            in_progress=Count('id', filter=Q(status=Ticket.Status.IN_PROGRESS)),
            resolved=Count('id', filter=Q(status=Ticket.Status.RESOLVED)),
        )

        valid_statuses = dict(Ticket.Status.choices)
        status_param = request.query_params.get('status')
        if status_param is not None:
            # Comma-separated list; empty string means "none selected".
            statuses = [s for s in status_param.split(',') if s in valid_statuses]
        else:
            statuses = [Ticket.Status.OPEN, Ticket.Status.IN_PROGRESS]

        tickets_qs = queryset.filter(status__in=statuses) if statuses else queryset.none()

        # Optional created-date range filter (YYYY-MM-DD).
        date_from = request.query_params.get('date_from')
        date_to = request.query_params.get('date_to')
        if date_from:
            tickets_qs = tickets_qs.filter(created_at__date__gte=date_from)
        if date_to:
            tickets_qs = tickets_qs.filter(created_at__date__lte=date_to)

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
            )
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
    """Let a guest post a reply on their own ticket (verified by reference + phone)."""
    permission_classes = [AllowAny]

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
            log_activity(ticket, None, TicketActivity.ActivityType.COMMENTED, 'Guest added a comment')
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
