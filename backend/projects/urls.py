from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import ProjectViewSet, TaskViewSet

router = DefaultRouter()
router.register('projects', ProjectViewSet, basename='project')
router.register('tasks', TaskViewSet, basename='task')

urlpatterns = [
    path('', include(router.urls)),
]
