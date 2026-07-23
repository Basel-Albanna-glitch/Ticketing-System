import json

from django.db.models import Count, Q
from django.db.models.deletion import ProtectedError
from rest_framework import generics, status, viewsets
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    CustomerAttachment,
    CustomerBranch,
    CustomerLicense,
    NotificationPreference,
    SoftwareType,
    User,
)
from .permissions import IsAdmin, IsAdminOrAgent
from .serializers import (
    AdminUserSerializer,
    AgentCreateUpdateSerializer,
    AgentSerializer,
    ChangePasswordSerializer,
    CustomerCreateUpdateSerializer,
    CustomerSerializer,
    MeSerializer,
    NotificationPreferenceSerializer,
    RegisterSerializer,
    SoftwareTypeSerializer,
)


class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]


class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = MeSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = request.user
        if not user.check_password(serializer.validated_data['old_password']):
            return Response({'old_password': 'Incorrect password.'}, status=status.HTTP_400_BAD_REQUEST)
        user.set_password(serializer.validated_data['new_password'])
        user.save()
        return Response({'detail': 'Password updated.'})


class NotificationPreferenceView(generics.RetrieveUpdateAPIView):
    serializer_class = NotificationPreferenceSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        obj, _ = NotificationPreference.objects.get_or_create(user=self.request.user)
        return obj


class AgentViewSet(viewsets.ModelViewSet):
    pagination_class = None

    def get_queryset(self):
        return User.objects.filter(role=User.Role.AGENT).annotate(
            assigned_count=Count('tickets_assigned'),
            resolved_count=Count(
                'tickets_assigned', filter=Q(tickets_assigned__status='resolved')
            ),
        ).order_by('full_name')

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return AgentCreateUpdateSerializer
        return AgentSerializer

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [IsAuthenticated(), IsAdmin()]
        return [IsAuthenticated(), IsAdminOrAgent()]


class CustomerViewSet(viewsets.ModelViewSet):
    pagination_class = None
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        return User.objects.filter(role=User.Role.CUSTOMER).annotate(
            ticket_count=Count('tickets_created'),
            open_count=Count(
                'tickets_created', filter=Q(tickets_created__status__in=['open', 'in_progress'])
            ),
        ).prefetch_related('licenses', 'branches', 'customer_attachments').order_by('full_name')

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return CustomerCreateUpdateSerializer
        return CustomerSerializer

    def get_permissions(self):
        # Creating and deleting customers is always admin-only.
        if self.action in ('create', 'destroy'):
            return [IsAuthenticated(), IsAdmin()]
        # Editing may be opened up to agents via the "edit customers" permission.
        if self.action in ('update', 'partial_update'):
            from tickets.models import TicketSettings

            if TicketSettings.get_solo().allow_agent_edit_customers:
                return [IsAuthenticated(), IsAdminOrAgent()]
            return [IsAuthenticated(), IsAdmin()]
        return [IsAuthenticated(), IsAdminOrAgent()]

    def destroy(self, request, *args, **kwargs):
        customer = self.get_object()
        try:
            customer.delete()
        except ProtectedError:
            return Response(
                {'detail': 'This customer has tickets and cannot be deleted. '
                           'Deactivate the account instead.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)

    def _save_licenses(self, customer, request, replace):
        """Replace/create licenses from a JSON-encoded ``licenses`` field."""
        raw = request.data.get('licenses')
        if raw is None:
            return
        try:
            items = json.loads(raw) if isinstance(raw, str) else raw
        except (ValueError, TypeError):
            return
        if not isinstance(items, list):
            return
        if replace:
            customer.licenses.all().delete()
        for item in items:
            if not isinstance(item, dict):
                continue
            name = (item.get('name') or '').strip()
            start = item.get('start_date') or None
            end = item.get('end_date') or None
            if not (name or start or end):
                continue
            CustomerLicense.objects.create(
                customer=customer, name=name, start_date=start, end_date=end
            )

    def _save_branches(self, customer, request, replace):
        """Replace/create branches from a JSON-encoded ``branches`` field."""
        raw = request.data.get('branches')
        if raw is None:
            return
        try:
            items = json.loads(raw) if isinstance(raw, str) else raw
        except (ValueError, TypeError):
            return
        if not isinstance(items, list):
            return
        if replace:
            customer.branches.all().delete()
        for item in items:
            if not isinstance(item, dict):
                continue
            name = (item.get('name') or '').strip()
            address = (item.get('address') or '').strip()
            if not (name or address):
                continue
            CustomerBranch.objects.create(customer=customer, name=name, address=address)

    def _save_attachments(self, customer, request):
        for f in request.FILES.getlist('attachments'):
            CustomerAttachment.objects.create(
                customer=customer,
                uploaded_by=request.user if request.user.is_authenticated else None,
                file=f,
                original_filename=f.name,
                content_type=f.content_type or '',
                size=f.size,
            )

    def _detail_response(self, customer, status_code):
        instance = self.get_queryset().get(pk=customer.pk)
        return Response(CustomerSerializer(instance).data, status=status_code)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        customer = serializer.save()
        self._save_licenses(customer, request, replace=False)
        self._save_branches(customer, request, replace=False)
        self._save_attachments(customer, request)
        return self._detail_response(customer, status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        customer = serializer.save()
        self._save_licenses(customer, request, replace=True)
        self._save_branches(customer, request, replace=True)
        self._save_attachments(customer, request)
        return self._detail_response(customer, status.HTTP_200_OK)


class SoftwareTypeViewSet(viewsets.ModelViewSet):
    queryset = SoftwareType.objects.all()
    serializer_class = SoftwareTypeSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [IsAuthenticated(), IsAdmin()]
        return [IsAuthenticated()]


class UserViewSet(viewsets.ModelViewSet):
    """Admin-only flat user list for Settings > User roles."""

    queryset = User.objects.all().order_by('full_name')
    serializer_class = AdminUserSerializer
    permission_classes = [IsAuthenticated, IsAdmin]
    pagination_class = None
    http_method_names = ['get', 'patch']
