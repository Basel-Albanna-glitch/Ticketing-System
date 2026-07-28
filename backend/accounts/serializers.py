from rest_framework import serializers

from .models import (
    CustomerAttachment,
    CustomerBranch,
    CustomerLicense,
    NotificationPreference,
    SoftwareType,
    User,
)


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
    class Meta:
        model = User
        fields = ['id', 'username', 'full_name', 'email', 'role', 'is_available', 'avatar', 'date_joined']
        read_only_fields = ['id', 'username', 'role', 'avatar', 'date_joined']


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
        fields = ['email_on_new_comment', 'email_on_status_change', 'email_on_assignment']


class AgentSerializer(serializers.ModelSerializer):
    assigned_count = serializers.IntegerField(read_only=True)
    resolved_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = User
        fields = [
            'id', 'username', 'full_name', 'email', 'is_available', 'is_active',
            'assigned_count', 'resolved_count', 'avatar', 'date_joined',
        ]


class AgentCreateUpdateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, min_length=8)
    email = serializers.EmailField(required=False, allow_blank=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'full_name', 'email', 'role', 'is_available', 'is_active', 'password']

    def validate_role(self, value):
        if value not in (User.Role.AGENT, User.Role.ADMIN):
            raise serializers.ValidationError('role must be agent or admin.')
        return value

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
