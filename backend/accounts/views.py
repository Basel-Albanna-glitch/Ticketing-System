import json
import secrets
from io import BytesIO

from PIL import Image, ImageOps, UnidentifiedImageError
from django.core.files.base import ContentFile

from django.db.models import Count, Prefetch, Q
from django.shortcuts import get_object_or_404
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
    StaffRole,
    User,
)
from .permissions import (
    CanViewSection,
    HasStaffPermission,
    IsAdmin,
    IsAdminOrAgent,
    IsFullAdmin,
)
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
    StaffRoleSerializer,
)


def customer_detail_queryset():
    """Users annotated with ticket counts and their branches (each carrying a ticket_count),
    licenses, and attachments prefetched. Shared by the staff customer list and a customer's
    own self-profile endpoint so both render the same rich detail."""
    branches = CustomerBranch.objects.annotate(
        ticket_count=Count('tickets')
    ).order_by('name', 'id')
    return User.objects.annotate(
        ticket_count=Count('tickets_created', distinct=True),
        open_count=Count(
            'tickets_created',
            filter=Q(tickets_created__status__in=['open', 'in_progress']),
            distinct=True,
        ),
    ).prefetch_related(
        'licenses', Prefetch('branches', queryset=branches), 'customer_attachments'
    )


class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]


class MyProfileView(generics.RetrieveAPIView):
    """A customer's own full account detail: profile fields, licenses, branches (with
    per-branch ticket counts), attachments, and ticket totals."""
    serializer_class = CustomerSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return customer_detail_queryset().get(pk=self.request.user.pk)


class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = MeSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user


AVATAR_MAX_UPLOAD_BYTES = 5 * 1024 * 1024
AVATAR_OUTPUT_SIZE = 512


def normalize_avatar(upload):
    """Return (ContentFile, None) for a usable image, or (None, error message).

    Whatever is uploaded is normalized here — EXIF rotation applied, centre-cropped to a
    square, resized, re-encoded as JPEG — so the stored file is small and predictable no
    matter what the browser handed us. Re-encoding also means the bytes we serve are ones
    Pillow produced, not an arbitrary file someone named `.jpg`."""
    if upload is None:
        return None, 'No file was uploaded.'
    if upload.size > AVATAR_MAX_UPLOAD_BYTES:
        return None, 'Image must be 5 MB or smaller.'
    try:
        image = Image.open(upload)
        image = ImageOps.exif_transpose(image)
        image = image.convert('RGB')
        image = ImageOps.fit(
            image, (AVATAR_OUTPUT_SIZE, AVATAR_OUTPUT_SIZE), Image.LANCZOS, centering=(0.5, 0.5)
        )
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError):
        return None, 'That file is not a readable image.'
    buffer = BytesIO()
    image.save(buffer, format='JPEG', quality=88, optimize=True)
    return ContentFile(buffer.getvalue()), None


def set_avatar(user, content):
    """Replace the user's picture, deleting the old file instead of orphaning it. The random
    filename suffix keeps a replacement from being served from cache."""
    user.avatar.delete(save=False)
    user.avatar.save(f'user_{user.pk}_{secrets.token_hex(4)}.jpg', content, save=True)


class MyAvatarView(APIView):
    """Upload (POST) or remove (DELETE) the signed-in user's own profile picture."""

    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        content, error = normalize_avatar(request.FILES.get('avatar'))
        if error:
            return Response({'avatar': error}, status=status.HTTP_400_BAD_REQUEST)
        set_avatar(request.user, content)
        return Response(MeSerializer(request.user, context={'request': request}).data)

    def delete(self, request):
        user = request.user
        if user.avatar:
            user.avatar.delete(save=True)
        return Response(MeSerializer(user, context={'request': request}).data)


class UserAvatarView(APIView):
    """Admin-managed profile picture for any user — how an admin sets an agent's or a
    customer's picture on their behalf. Same normalization as the self-serve endpoint."""

    permission_classes = [IsAuthenticated, IsAdmin]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, pk):
        user = get_object_or_404(User, pk=pk)
        content, error = normalize_avatar(request.FILES.get('avatar'))
        if error:
            return Response({'avatar': error}, status=status.HTTP_400_BAD_REQUEST)
        set_avatar(user, content)
        return Response(AdminUserSerializer(user, context={'request': request}).data)

    def delete(self, request, pk):
        user = get_object_or_404(User, pk=pk)
        if user.avatar:
            user.avatar.delete(save=True)
        return Response(AdminUserSerializer(user, context={'request': request}).data)


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


class StaffRoleViewSet(viewsets.ModelViewSet):
    """Named permission bundles. Managing them is always admin-only, and only for
    an admin who has not themselves been restricted by a role — otherwise a
    limited admin could simply grant themselves anything they were denied."""

    serializer_class = StaffRoleSerializer
    pagination_class = None

    def get_permissions(self):
        return [IsAuthenticated(), IsFullAdmin()]

    def get_queryset(self):
        return StaffRole.objects.annotate(user_count=Count('users')).order_by('name')

    def destroy(self, request, *args, **kwargs):
        role = self.get_object()
        # Holders fall back to unrestricted access (admins) or the site-wide
        # settings (agents), so deleting a role can only ever widen access. Say
        # how many people that affects instead of doing it silently.
        holders = role.users.count()
        response = super().destroy(request, *args, **kwargs)
        if holders:
            return Response(
                {'detail': f'Role deleted. {holders} user(s) reverted to default permissions.'},
                status=status.HTTP_200_OK,
            )
        return response


class AgentViewSet(viewsets.ModelViewSet):
    pagination_class = None

    def get_queryset(self):
        # Assignment dropdowns pass ?include_admins=1 so an admin can take work on
        # themselves. The agent-management page omits it and still lists agents only.
        #
        # That filter is about what the *list* shows. Detail routes always include
        # admins: otherwise addressing one by id 404s, and an admin could never be
        # given a role.
        roles = [User.Role.AGENT]
        if (
            self.action != 'list'
            or self.request.query_params.get('include_admins') in ('1', 'true', 'True')
        ):
            roles.append(User.Role.ADMIN)
        return User.objects.filter(role__in=roles).annotate(
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
        # Each branch carries its own ticket count so the profile page can show, per branch,
        # how many tickets are attached to it.
        return customer_detail_queryset().filter(role=User.Role.CUSTOMER).order_by('full_name')

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return CustomerCreateUpdateSerializer
        return CustomerSerializer

    def get_permissions(self):
        return [
            CanViewSection('allow_agent_view_customers'),
            *self._action_permissions(),
        ]

    def _action_permissions(self):
        # Deleting a customer is always admin-only: an accidental create is easy
        # to undo, a delete takes their tickets and history with it.
        if self.action == 'destroy':
            return [IsAuthenticated(), IsAdmin()]
        # Creating and editing may each be opened up by the caller's role, or by
        # the site-wide settings for anyone without one.
        if self.action == 'create':
            return [IsAuthenticated(), HasStaffPermission('allow_agent_create_customers')]
        if self.action in ('update', 'partial_update'):
            return [IsAuthenticated(), HasStaffPermission('allow_agent_edit_customers')]
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
