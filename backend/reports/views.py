from datetime import timedelta

from accounts.models import User
from accounts.permissions import IsAdmin
from django.db.models import Avg, Count, DurationField, ExpressionWrapper, F, Q
from django.db.models.functions import TruncDate, TruncMonth, TruncWeek
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from tickets.models import Ticket

RESOLUTION_DURATION = ExpressionWrapper(
    F('resolved_at') - F('created_at'), output_field=DurationField()
)
# The same span expressed across the reverse relation, for per-agent aggregation.
AGENT_RESOLUTION_DURATION = ExpressionWrapper(
    F('tickets_assigned__resolved_at') - F('tickets_assigned__created_at'),
    output_field=DurationField(),
)

# Day buckets stay readable up to about six weeks; past that the axis turns to mush.
DAY_BUCKET_MAX_DAYS = 45
WEEK_BUCKET_MAX_DAYS = 400


def hours(delta):
    return round(delta.total_seconds() / 3600, 2) if delta else None


def avg_hours(queryset):
    return hours(
        queryset.filter(resolved_at__isnull=False).aggregate(avg=Avg(RESOLUTION_DURATION))['avg']
    )


def date_range(request):
    """The requested window as (from, to); either side may be None for open-ended."""
    return (
        parse_date(request.query_params.get('date_from') or ''),
        parse_date(request.query_params.get('date_to') or ''),
    )


def in_range(queryset, date_from, date_to, field='created_at'):
    if date_from:
        queryset = queryset.filter(**{f'{field}__date__gte': date_from})
    if date_to:
        queryset = queryset.filter(**{f'{field}__date__lte': date_to})
    return queryset


def bucket_counts(queryset, field, trunc):
    """{bucket date: count} for rows grouped into `trunc` buckets of `field`."""
    rows = queryset.annotate(bucket=trunc(field)).values('bucket').annotate(count=Count('id'))
    return {row['bucket']: row['count'] for row in rows if row['bucket']}


def _bucket_start(day, granularity):
    if granularity == 'week':
        return day - timedelta(days=day.weekday())
    if granularity == 'month':
        return day.replace(day=1)
    return day


def _next_bucket(day, granularity, step):
    if granularity == 'month':
        return (day.replace(day=28) + timedelta(days=4)).replace(day=1)
    return day + step


def build_trend(date_from, date_to):
    """Tickets opened vs resolved per bucket, with gaps filled in.

    Each series is scoped by its own date — opened by created_at, resolved by
    resolved_at — so the chart answers "how much came in versus went out" rather than
    following one cohort of tickets through time.
    """
    today = timezone.localdate()
    start = date_from
    if start is None:
        earliest = Ticket.objects.order_by('created_at').values_list('created_at', flat=True).first()
        start = earliest.date() if earliest else today
    end = date_to or today
    if end < start:
        return {'granularity': 'day', 'points': []}

    span = (end - start).days
    if span <= DAY_BUCKET_MAX_DAYS:
        granularity, trunc, step = 'day', TruncDate, timedelta(days=1)
    elif span <= WEEK_BUCKET_MAX_DAYS:
        granularity, trunc, step = 'week', TruncWeek, timedelta(weeks=1)
    else:
        granularity, trunc, step = 'month', TruncMonth, None

    created = bucket_counts(in_range(Ticket.objects.all(), start, end), 'created_at', trunc)
    resolved = bucket_counts(
        in_range(Ticket.objects.filter(resolved_at__isnull=False), start, end, field='resolved_at'),
        'resolved_at',
        trunc,
    )

    # Walk the whole window so quiet buckets are plotted as 0 instead of skipped — a line
    # that hops over empty days reads as continuous activity.
    points, cursor = [], _bucket_start(start, granularity)
    while cursor <= end:
        points.append({
            'date': cursor.isoformat(),
            'created': created.get(cursor, 0),
            'resolved': resolved.get(cursor, 0),
        })
        cursor = _next_bucket(cursor, granularity, step)
    return {'granularity': granularity, 'points': points}


class ReportsSummaryView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        date_from, date_to = date_range(request)
        tickets = in_range(Ticket.objects.all(), date_from, date_to)

        by_status = list(tickets.values('status').annotate(count=Count('id')).order_by('status'))
        by_priority = list(
            tickets.values('priority').annotate(count=Count('id')).order_by('priority')
        )
        by_category = list(
            tickets.values(category_name=F('category__name'))
            .annotate(count=Count('id'))
            .order_by('category_name')
        )
        # Customer satisfaction (CSAT): average and 1–5 distribution over rated tickets.
        rated = tickets.filter(rating__isnull=False)
        avg_rating = rated.aggregate(avg=Avg('rating'))['avg']
        by_rating = list(rated.values('rating').annotate(count=Count('id')).order_by('rating'))

        return Response({
            'by_status': by_status,
            'by_priority': by_priority,
            'by_category': by_category,
            'by_rating': by_rating,
            'total': tickets.count(),
            'resolved_count': tickets.filter(resolved_at__isnull=False).count(),
            'avg_resolution_hours': avg_hours(tickets),
            'avg_rating': round(avg_rating, 2) if avg_rating is not None else None,
            'rating_count': rated.count(),
            'trend': build_trend(date_from, date_to),
            'date_from': date_from.isoformat() if date_from else None,
            'date_to': date_to.isoformat() if date_to else None,
        })


class AgentPerformanceView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        date_from, date_to = date_range(request)
        # Every aggregate below counts only tickets inside the window; without this filter
        # the numbers would quietly span all time while the page header says otherwise.
        window = Q()
        if date_from:
            window &= Q(tickets_assigned__created_at__date__gte=date_from)
        if date_to:
            window &= Q(tickets_assigned__created_at__date__lte=date_to)

        agents = (
            User.objects.filter(role=User.Role.AGENT)
            .annotate(
                assigned_count=Count('tickets_assigned', filter=window),
                closed_count=Count(
                    'tickets_assigned', filter=window & Q(tickets_assigned__status='closed')
                ),
                avg_rating=Avg('tickets_assigned__rating', filter=window),
                # One query for all agents, where this used to run one query per agent.
                avg_resolution=Avg(
                    AGENT_RESOLUTION_DURATION,
                    filter=window & Q(tickets_assigned__resolved_at__isnull=False),
                ),
            )
            .order_by('full_name')
        )

        return Response([
            {
                'agent_id': agent.id,
                'agent_name': agent.full_name,
                'assigned_count': agent.assigned_count,
                'closed_count': agent.closed_count,
                'avg_rating': round(agent.avg_rating, 2) if agent.avg_rating is not None else None,
                'avg_resolution_hours': hours(agent.avg_resolution),
            }
            for agent in agents
        ])
