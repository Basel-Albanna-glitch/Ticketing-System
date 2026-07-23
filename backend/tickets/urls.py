from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    CategoryViewSet,
    DashboardView,
    GuestTicketCreateView,
    GuestTicketReplyView,
    GuestTicketTrackView,
    PublicCategoriesView,
    TicketSettingsView,
    TicketViewSet,
)

router = DefaultRouter()
router.register('categories', CategoryViewSet, basename='category')
router.register('tickets', TicketViewSet, basename='ticket')

urlpatterns = [
    path('dashboard/', DashboardView.as_view(), name='dashboard'),
    path('settings/tickets/', TicketSettingsView.as_view(), name='ticket-settings'),
    # Public (guest) endpoints — must come before the router so 'tickets/guest/…' isn't
    # captured as a ticket detail lookup.
    path('public/categories/', PublicCategoriesView.as_view(), name='public-categories'),
    path('tickets/guest/', GuestTicketCreateView.as_view(), name='guest-ticket-create'),
    path('tickets/guest/track/', GuestTicketTrackView.as_view(), name='guest-ticket-track'),
    path('tickets/guest/reply/', GuestTicketReplyView.as_view(), name='guest-ticket-reply'),
    path('', include(router.urls)),
]
