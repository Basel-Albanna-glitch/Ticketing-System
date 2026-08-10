from rest_framework import serializers

from core.models import PERMISSION_FLAGS

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


class MeSerializer(serializers.ModelSerializer):
    # What the signed-in user may actually do, already resolved from their role
    # (or the site-wide defaults). The client gates its UI on this rather than
    # re-deriving the rules, so the two cannot disagree about who may do what.
    # Only served here, for one user — putting it on a list serializer would cost
    # a settings lookup per row.
    permissions = serializers.SerializerMethodField()
    staff_role_name = serializers.CharField(source='staff_role.name', read_only=True, default=None)
    is_full_admin = serializers.BooleanField(read_only=True)

    class Meta:
        model = User
        fields = [
            'id', 'username', 'full_name', 'email', 'role', 'is_available', 'avatar',
            'date_joined', 'staff_role', 'staff_role_name', 'is_full_admin', 'permissions',
        ]
        read_only_fields = [
            'id', 'username', 'role', 'avatar', 'date_joined', 'staff_role',
            'staff_role_name', 'is_full_admin', 'permissions',
        ]

    def get_permissions(self, obj):
        return obj.permission_map()


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
            'email_on_license_expiry',
        ]


class StaffRoleSerializer(serializers.ModelSerializer):
    user_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = StaffRole
        fields = ['id', 'name', 'description', 'user_count', *PERMISSION_FLAGS]

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


class CustomerSerializer(serializers.ModelSerializer):
    ticket_count = serializers.IntegerField(read_only=True)
    open_count = serializers.IntegerField(read_only=True)
    licenses = CustomerLicenseSerializer(many=True, read_only=True)
    branches = CustomerBranchDetailSerializer(many=True, read_only=True)
    attachments = CustomerAttachmentSerializer(
        source='customer_attachments', many=True, read_only=True
    )

    class Meta:
        model = User
        fields = [
            'id', 'username', 'full_name', 'email', 'address', 'phone',
            'tax_number', 'software_type', 'is_active', 'ticket_count', 'open_count',
            'licenses', 'branches', 'attachments', 'avatar', 'date_joined',
        ]


class CustomerCreateUpdateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, min_length=8)
    email = serializers.EmailField(required=False, allow_blank=True)
    # Multipart posts must not be read as "unchecked" — see OptionalBooleanField.
    is_active = OptionalBooleanField(required=False)

    class Meta:
        model = User
        fields = [
            'id', 'username', 'full_name', 'email', 'address', 'phone',
            'tax_number', 'software_type', 'is_active', 'password',
        ]

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
