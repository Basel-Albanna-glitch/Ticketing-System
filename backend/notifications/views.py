from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .licenses import maybe_sweep_license_expiry
from .models import DeviceToken, Notification
from .serializers import DeviceTokenSerializer, NotificationSerializer


class NotificationViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        return Notification.objects.filter(recipient=self.request.user)[:50]

    def list(self, request, *args, **kwargs):
        # This poll doubles as the heartbeat for time-based alerts, which have no
        # scheduler of their own. Hourly at most, off-thread, and a no-op if a sweep
        # already covered today's deadlines.
        maybe_sweep_license_expiry()
        qs = self.get_queryset()
        unread = Notification.objects.filter(recipient=request.user, is_read=False).count()
        return Response({
            'unread_count': unread,
            'results': NotificationSerializer(qs, many=True).data,
        })

    @action(detail=True, methods=['post'], url_path='read')
    def mark_read(self, request, pk=None):
        Notification.objects.filter(recipient=request.user, pk=pk).update(is_read=True)
        return Response({'status': 'ok'})

    @action(detail=False, methods=['post'], url_path='mark-all-read')
    def mark_all_read(self, request):
        Notification.objects.filter(recipient=request.user, is_read=False).update(is_read=True)
        return Response({'status': 'ok'})


class DeviceTokenViewSet(viewsets.GenericViewSet):
    """Registration of this device's FCM token, so push can reach it.

    The app registers at every launch (tokens rotate on their own schedule) and
    unregisters on logout — without that, the next person to use the phone would keep
    receiving the previous user's alerts.
    """

    serializer_class = DeviceTokenSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return DeviceToken.objects.filter(user=self.request.user)

    def create(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        token = serializer.validated_data['token']

        # update_or_create keyed on the token, not (user, token): the row must MOVE to
        # the current user when a device changes hands, rather than leaving the old
        # owner subscribed to a phone that is no longer theirs.
        device, created = DeviceToken.objects.update_or_create(
            token=token,
            defaults={
                'user': request.user,
                'platform': serializer.validated_data.get(
                    'platform', DeviceToken.Platform.ANDROID
                ),
            },
        )
        return Response(
            DeviceTokenSerializer(device).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    @action(detail=False, methods=['post'], url_path='unregister')
    def unregister(self, request):
        token = request.data.get('token')
        if not token:
            return Response(
                {'token': 'This field is required.'}, status=status.HTTP_400_BAD_REQUEST
            )
        # Scoped to the caller so one user cannot silence another's device by
        # guessing or replaying a token.
        deleted, _ = DeviceToken.objects.filter(user=request.user, token=token).delete()
        return Response({'status': 'ok', 'deleted': deleted})
