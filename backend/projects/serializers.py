from accounts.models import User
from accounts.serializers import UserSerializer
from rest_framework import serializers

from .models import Project, Task


class ProjectSerializer(serializers.ModelSerializer):
    created_by = UserSerializer(read_only=True)
    task_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Project
        fields = ['id', 'name', 'description', 'created_by', 'task_count', 'created_at', 'updated_at']


class TaskSerializer(serializers.ModelSerializer):
    assignee = UserSerializer(read_only=True)
    assignee_id = serializers.PrimaryKeyRelatedField(
        source='assignee', queryset=User.objects.all(), allow_null=True, required=False, write_only=True
    )
    created_by = UserSerializer(read_only=True)

    class Meta:
        model = Task
        fields = [
            'id', 'project', 'title', 'description', 'status', 'priority',
            'assignee', 'assignee_id', 'start_date', 'due_date', 'created_by',
            'created_at', 'updated_at',
        ]

    def validate_assignee_id(self, value):
        if value is not None and value.role not in (User.Role.AGENT, User.Role.ADMIN):
            raise serializers.ValidationError('assignee must be a user with role=agent or role=admin.')
        return value

    def validate(self, attrs):
        start_date = attrs.get('start_date', getattr(self.instance, 'start_date', None))
        due_date = attrs.get('due_date', getattr(self.instance, 'due_date', None))
        if start_date and due_date and start_date > due_date:
            raise serializers.ValidationError({'start_date': 'Start date must be on or before the due date.'})
        return attrs
