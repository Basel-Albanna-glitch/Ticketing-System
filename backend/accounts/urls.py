from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register('users/agents', views.AgentViewSet, basename='agent')
router.register('users/customers', views.CustomerViewSet, basename='customer')
router.register('software-types', views.SoftwareTypeViewSet, basename='software-type')
router.register('users', views.UserViewSet, basename='user')

urlpatterns = [
    # Ahead of the router so it wins over the users/<pk>/ detail route.
    path('users/<int:pk>/avatar/', views.UserAvatarView.as_view(), name='user-avatar'),
    path('auth/register/', views.RegisterView.as_view(), name='register'),
    path('auth/me/', views.MeView.as_view(), name='me'),
    path('auth/me/profile/', views.MyProfileView.as_view(), name='my-profile'),
    path('auth/me/avatar/', views.MyAvatarView.as_view(), name='my-avatar'),
    path('auth/change-password/', views.ChangePasswordView.as_view(), name='change-password'),
    path('auth/notification-preferences/', views.NotificationPreferenceView.as_view(), name='notification-preferences'),
    path('', include(router.urls)),
]
