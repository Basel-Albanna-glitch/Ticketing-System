from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Notification
from .serializers import NotificationSerializer


class NotificationViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        return Notification.objects.filter(recipient=self.request.user)[:50]

    def list(self, request, *args, **kwargs):
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
