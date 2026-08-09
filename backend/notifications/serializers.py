from rest_framework import serializers

from .models import DeviceToken, Notification


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ['id', 'message', 'kind', 'ticket', 'customer', 'is_read', 'created_at']


class DeviceTokenSerializer(serializers.ModelSerializer):
    class Meta:
        model = DeviceToken
        fields = ['id', 'token', 'platform', 'created_at', 'last_seen_at']
        read_only_fields = ['id', 'created_at', 'last_seen_at']
        # The default unique validator would reject a device re-registering its own
        # token, which the app does at every launch. Ownership is resolved in the
        # view instead, where the current user is known.
        extra_kwargs = {'token': {'validators': []}}
