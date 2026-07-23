from accounts.permissions import IsAdminOrAgent
from django.db.models import Count
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, viewsets
from rest_framework.permissions import IsAuthenticated

from .models import Project, Task
from .serializers import ProjectSerializer, TaskSerializer


class ProjectViewSet(viewsets.ModelViewSet):
    serializer_class = ProjectSerializer
    permission_classes = [IsAuthenticated, IsAdminOrAgent]
    filter_backends = [filters.SearchFilter]
    search_fields = ['name', 'description']

    def get_queryset(self):
        return Project.objects.annotate(task_count=Count('tasks')).order_by('-created_at')

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class TaskViewSet(viewsets.ModelViewSet):
    serializer_class = TaskSerializer
    permission_classes = [IsAuthenticated, IsAdminOrAgent]
    pagination_class = None
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['project', 'status', 'priority', 'assignee']

    def get_queryset(self):
        return Task.objects.select_related('project', 'assignee', 'created_by')

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
