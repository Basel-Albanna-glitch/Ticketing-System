from accounts.models import User
from accounts.permissions import IsAdmin
from django.db.models import Avg, Count, DurationField, ExpressionWrapper, F, Q
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from tickets.models import Ticket

RESOLUTION_DURATION = ExpressionWrapper(
    F('resolved_at') - F('created_at'), output_field=DurationField()
)


def avg_hours(queryset):
    result = queryset.filter(resolved_at__isnull=False).aggregate(
        avg=Avg(RESOLUTION_DURATION)
    )['avg']
    return round(result.total_seconds() / 3600, 2) if result else None


class ReportsSummaryView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        tickets = Ticket.objects.all()
        by_status = list(
            tickets.values('status').annotate(count=Count('id')).order_by('status')
        )
        by_priority = list(
            tickets.values('priority').annotate(count=Count('id')).order_by('priority')
        )
        by_category = list(
            tickets.values(category_name=F('category__name'))
            .annotate(count=Count('id'))
            .order_by('category_name')
        )
        return Response({
            'by_status': by_status,
            'by_priority': by_priority,
            'by_category': by_category,
            'avg_resolution_hours': avg_hours(tickets),
        })


class AgentPerformanceView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        agents = User.objects.filter(role=User.Role.AGENT).annotate(
            assigned_count=Count('tickets_assigned'),
            resolved_count=Count('tickets_assigned', filter=Q(tickets_assigned__status='resolved')),
        ).order_by('full_name')

        rows = []
        for agent in agents:
            rows.append({
                'agent_id': agent.id,
                'agent_name': agent.full_name,
                'assigned_count': agent.assigned_count,
                'resolved_count': agent.resolved_count,
                'avg_resolution_hours': avg_hours(Ticket.objects.filter(assigned_agent=agent)),
            })
        return Response(rows)
