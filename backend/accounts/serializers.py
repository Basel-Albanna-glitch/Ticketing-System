import json

from rest_framework import serializers
from rest_framework.utils import html

from core.models import PERMISSION_FLAGS, TICKET_COLUMNS

from .models import (
    CustomerAttachment,
    CustomerBranch,
    CustomerLicense,
    NotificationPreference,
    SoftwareType,
    StaffRole,
    User,
)


class OptionalBooleanField(serializers.BooleanField):
    """A boolean where "not sent" means not sent, rather than False.

    DRF treats any multipart request as an HTML form, and in an HTML form an
    unchecked box is simply omitted — so a missing boolean is read as False. The
    customer form posts multipart because it can carry attachments, and it never
    sends is_active at all, which quietly created every new customer deactivated
    in spite of the model defaulting to active.

    Returning `empty` instead leaves the field out of validated_data, so the
    model default stands; a value that *is* sent still wins, which keeps the
    activate/deactivate toggle working.
    """

    default_empty_html = serializers.empty


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'full_name', 'email', 'role', 'is_available', 'avatar', 'date_joined']
        read_only_fields = fields


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    confirm_password = serializers.CharField(write_only=True)
    email = serializers.EmailField(required=False, allow_blank=True)

    class Meta:
        model = User
        fields = ['full_name', 'username', 'email', 'password', 'confirm_password']

    def validate(self, attrs):
        if attrs['password'] != attrs['confirm_password']:
            raise serializers.ValidationError({'confirm_password': 'Passwords do not match.'})
        return attrs

    def create(self, validated_data):
        validated_data.pop('confirm_password')
        return User.objects.create_user(role=User.Role.CUSTOMER, **validated_data)


class TicketColumnListField(serializers.ListField):
    """A list of ticket-table column keys (core.models.TICKET_COLUMNS).

    Unknown keys are refused rather than stored and repeats collapse, so the client
    can trust what it reads back. With `keep_one`, a list naming every column is
    refused too — used where the list withholds columns, since withholding all of
    them leaves a table with nothing in it.
    """

    def __init__(self, keep_one=False, **kwargs):
        self.keep_one = keep_one
        kwargs.setdefault('child', serializers.ChoiceField(choices=TICKET_COLUMNS))
        kwargs.setdefault('required', False)
        super().__init__(**kwargs)

    def to_internal_value(self, data):
        columns = list(dict.fromkeys(super().to_internal_value(data)))
        if self.keep_one and set(columns) >= set(TICKET_COLUMNS):
            raise serializers.ValidationError('Leave at least one column visible.')
        return columns


class MeSerializer(serializers.ModelSerializer):
    # What the signed-in user may actually do, already resolved from their role
    # (or the site-wide defaults). The client gates its UI on this rather than
    # re-deriving the rules, so the two cannot disagree about who may do what.
    # Only served here, for one user — putting it on a list serializer would cost
    # a settings lookup per row.
    permissions = serializers.SerializerMethodField()
    staff_role_name = serializers.CharField(source='staff_role.name', read_only=True, default=None)
    is_full_admin = serializers.BooleanField(read_only=True)
    # Columns the role allows (resolved, read-only) next to the ones this person hid
    # themselves (theirs to change). The table shows the first minus the second.
    allowed_ticket_columns = serializers.SerializerMethodField()
    hidden_ticket_columns = TicketColumnListField()

    class Meta:
        model = User
        fields = [
            'id', 'username', 'full_name', 'email', 'role', 'is_available', 'avatar',
            'date_joined', 'staff_role', 'staff_role_name', 'is_full_admin', 'permissions',
            'allowed_ticket_columns', 'hidden_ticket_columns', 'can_set_ticket_priority',
        ]
        # can_set_ticket_priority is read here so the new-ticket form knows whether to ask,
        # and read-only so a customer can't switch it on for themselves.
        read_only_fields = [
            'id', 'username', 'role', 'avatar', 'date_joined', 'staff_role',
            'staff_role_name', 'is_full_admin', 'permissions', 'allowed_ticket_columns',
            'can_set_ticket_priority',
        ]

    def get_permissions(self, obj):
        return obj.permission_map()

    def get_allowed_ticket_columns(self, obj):
        return obj.allowed_ticket_columns()

    def validate_hidden_ticket_columns(self, value):
        # Choosing columns is itself a permission. Without it everyone sees every column
        # their role allows, so there is no choice of theirs to save.
        if self.instance and not self.instance.has_staff_permission('allow_agent_customize_columns'):
            raise serializers.ValidationError(
                'You do not have permission to customize table columns.'
            )
        allowed = set(self.instance.allowed_ticket_columns()) if self.instance else set()
        if allowed and allowed <= set(value):
            raise serializers.ValidationError('Leave at least one column visible.')
        return value


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8)
    confirm_password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        if attrs['new_password'] != attrs['confirm_password']:
            raise serializers.ValidationError({'confirm_password': 'Passwords do not match.'})
        return attrs


class NotificationPreferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotificationPreference
        fields = [
            'email_on_new_comment', 'email_on_status_change', 'email_on_assignment',
            'email_on_license_expiry', 'email_on_todo_reminder',
        ]


class StaffRoleSerializer(serializers.ModelSerializer):
    user_count = serializers.IntegerField(read_only=True)
    withheld_ticket_columns = TicketColumnListField(keep_one=True)

    class Meta:
        model = StaffRole
        fields = [
            'id', 'name', 'description', 'user_count', *PERMISSION_FLAGS,
            'withheld_ticket_columns',
        ]

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('Name cannot be blank.')
        return value


class AgentSerializer(serializers.ModelSerializer):
    assigned_count = serializers.IntegerField(read_only=True)
    resolved_count = serializers.IntegerField(read_only=True)
    staff_role_name = serializers.CharField(source='staff_role.name', read_only=True, default=None)

    class Meta:
        model = User
        fields = [
            'id', 'username', 'full_name', 'email', 'role', 'is_available', 'is_active',
            'assigned_count', 'resolved_count', 'avatar', 'date_joined',
            'staff_role', 'staff_role_name',
        ]


class AgentCreateUpdateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, min_length=8)
    email = serializers.EmailField(required=False, allow_blank=True)

    class Meta:
        model = User
        fields = [
            'id', 'username', 'full_name', 'email', 'role', 'is_available', 'is_active',
            'password', 'staff_role',
        ]

    def validate_role(self, value):
        if value not in (User.Role.AGENT, User.Role.ADMIN):
            raise serializers.ValidationError('role must be agent or admin.')
        return value

    def validate(self, attrs):
        attrs = super().validate(attrs)
        instance = self.instance
        if instance is None:
            return attrs
        # Giving the last unrestricted admin a role, or demoting them to agent,
        # would leave nobody able to manage roles or hand permissions back — the
        # system would be permanently locked into whatever it was set to.
        role = attrs.get('role', instance.role)
        staff_role = attrs.get('staff_role', instance.staff_role)
        would_stay_full_admin = role == User.Role.ADMIN and staff_role is None
        if instance.is_full_admin and not would_stay_full_admin:
            others = User.objects.filter(
                role=User.Role.ADMIN, staff_role__isnull=True, is_active=True
            ).exclude(pk=instance.pk)
            if not others.exists():
                raise serializers.ValidationError({
                    'staff_role': (
                        'This is the last admin without a role. Restricting them would '
                        'leave nobody able to manage permissions.'
                    )
                })
        return attrs

    def create(self, validated_data):
        password = validated_data.pop('password', None)
        if not password:
            raise serializers.ValidationError({'password': 'This field is required.'})
        return User.objects.create_user(password=password, **validated_data)

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance


class SoftwareTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = SoftwareType
        fields = ['id', 'name', 'created_at']
        read_only_fields = ['id', 'created_at']


class CustomerLicenseSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomerLicense
        fields = ['id', 'name', 'start_date', 'end_date']


class CustomerBranchSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomerBranch
        fields = ['id', 'name', 'address']


class CustomerBranchDetailSerializer(CustomerBranchSerializer):
    # Number of tickets attached to this branch. Supplied by an annotation on the
    # customer's branches queryset (see CustomerViewSet.get_queryset).
    ticket_count = serializers.IntegerField(read_only=True)

    class Meta(CustomerBranchSerializer.Meta):
        fields = CustomerBranchSerializer.Meta.fields + ['ticket_count']


class CustomerAttachmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomerAttachment
        fields = ['id', 'file', 'original_filename', 'content_type', 'size', 'created_at']
        read_only_fields = fields


class SoftwareTypesField(serializers.ListField):
    """The software type names a customer runs.

    The customer form posts multipart (it can carry attachments), and a multipart list
    has no way to say "empty" — an absent key reads as "not sent" — so the list arrives
    JSON-encoded, the same way `licenses` does. A JSON body may send a plain list.
    """

    def __init__(self, **kwargs):
        kwargs.setdefault('child', serializers.CharField(max_length=100, allow_blank=True))
        kwargs.setdefault('required', False)
        super().__init__(**kwargs)

    def get_value(self, dictionary):
        if html.is_html_input(dictionary):
            return dictionary.get(self.field_name, serializers.empty)
        return super().get_value(dictionary)

    def to_internal_value(self, data):
        if isinstance(data, str):
            try:
                data = json.loads(data) if data.strip() else []
            except ValueError:
                raise serializers.ValidationError('Expected a JSON list of software type names.')
        names = super().to_internal_value(data)
        # Blank picks drop out and repeats collapse, keeping the order they were chosen in.
        return list(dict.fromkeys(name.strip() for name in names if name.strip()))


class CustomerSerializer(serializers.ModelSerializer):
    ticket_count = serializers.IntegerField(read_only=True)
    open_count = serializers.IntegerField(read_only=True)
    licenses = CustomerLicenseSerializer(many=True, read_only=True)
    branches = CustomerBranchDetailSerializer(many=True, read_only=True)
    attachments = CustomerAttachmentSerializer(
        source='customer_attachments', many=True, read_only=True
    )
    # For clients that predate the list (the mobile app): the names joined into the single
    # string this field used to hold.
    software_type = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'username', 'full_name', 'email', 'address', 'phone',
            'tax_number', 'software_types', 'software_type', 'customer_priority',
            'can_set_ticket_priority', 'is_active', 'ticket_count', 'open_count', 'licenses',
            'branches', 'attachments', 'avatar', 'date_joined',
        ]

    def get_software_type(self, obj):
        return ', '.join(obj.software_types or [])

    def to_representation(self, instance):
        data = super().to_representation(instance)
        # How staff rank a customer is theirs to know: a customer reading their own
        # account (MyProfileView serves them this serializer) doesn't see it.
        request = self.context.get('request')
        if request and getattr(request.user, 'role', None) == User.Role.CUSTOMER:
            data.pop('customer_priority', None)
        return data


class CustomerCreateUpdateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, min_length=8)
    email = serializers.EmailField(required=False, allow_blank=True)
    # Multipart posts must not be read as "unchecked" — see OptionalBooleanField.
    is_active = OptionalBooleanField(required=False)
    software_types = SoftwareTypesField()
    # The single-name field older clients still send. Not stored as such — see validate().
    software_type = serializers.CharField(
        required=False, allow_blank=True, write_only=True, max_length=255
    )
    # Optional. The multipart form sends '' for "none", which is stored as null rather
    # than as an empty choice.
    customer_priority = serializers.ChoiceField(
        choices=User.CustomerPriority.choices, required=False, allow_null=True, allow_blank=True
    )
    # Posted multipart like is_active, so a missing value must not read as "off".
    can_set_ticket_priority = OptionalBooleanField(required=False)

    class Meta:
        model = User
        fields = [
            'id', 'username', 'full_name', 'email', 'address', 'phone',
            'tax_number', 'software_types', 'software_type', 'customer_priority',
            'can_set_ticket_priority', 'is_active', 'password',
        ]

    def validate_customer_priority(self, value):
        return value or None

    def validate(self, attrs):
        attrs = super().validate(attrs)
        legacy = attrs.pop('software_type', None)
        # A client that only knows the single field (the mobile app) sends back the joined
        # string it was given, so an unchanged one means "left alone", not one type named
        # "Aloha, Micros". Anything else it sends is a genuine single pick.
        if legacy is not None and 'software_types' not in attrs:
            current = ', '.join(self.instance.software_types) if self.instance else ''
            if legacy != current:
                attrs['software_types'] = [legacy] if legacy else []
        return attrs

    def create(self, validated_data):
        password = validated_data.pop('password', None)
        if not password:
            raise serializers.ValidationError({'password': 'This field is required.'})
        return User.objects.create_user(role=User.Role.CUSTOMER, password=password, **validated_data)

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance


class AdminUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'full_name', 'email', 'role', 'is_available', 'avatar', 'date_joined']
        read_only_fields = ['id', 'username', 'full_name', 'email', 'is_available', 'avatar', 'date_joined']
