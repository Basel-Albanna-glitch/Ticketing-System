from datetime import timedelta

from accounts.models import CustomerLicense, User
from accounts.permissions import HasStaffPermission
from django.db.models import Avg, Count, DurationField, ExpressionWrapper, F, Q
from django.db.models.functions import TruncDate, TruncMonth, TruncWeek
from django.http import HttpResponse
from django.utils import timezone
from django.utils.dateparse import parse_date
from openpyxl import Workbook
from core.xlsx import write_sheet
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from projects.models import Project, Task, TodoItem
from tickets.models import Ticket

RESOLUTION_DURATION = ExpressionWrapper(
    F('resolved_at') - F('created_at'), output_field=DurationField()
)
# The same span expressed across the reverse relation, for per-agent aggregation.
AGENT_RESOLUTION_DURATION = ExpressionWrapper(
    F('tickets_assigned__resolved_at') - F('tickets_assigned__created_at'),
    output_field=DurationField(),
)
# And again for per-customer aggregation.
CUSTOMER_RESOLUTION_DURATION = ExpressionWrapper(
    F('tickets_created__resolved_at') - F('tickets_created__created_at'),
    output_field=DurationField(),
)

# A licence this close to its end date is reported as expiring. Matches the first reminder
# stage in notifications/licenses.py so the report and the emails agree on "soon".
EXPIRING_SOON_DAYS = 30

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


def summary_payload(date_from, date_to):
    """Headline totals and breakdowns for the window. Shared by the API and the export."""
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

    return {
        'by_status': by_status,
        'by_priority': by_priority,
        'by_category': by_category,
        'by_rating': by_rating,
        'total': tickets.count(),
        'resolved_count': tickets.filter(resolved_at__isnull=False).count(),
        'avg_resolution_hours': avg_hours(tickets),
        'avg_rating': round(avg_rating, 2) if avg_rating is not None else None,
        'rating_count': rated.count(),
        'date_from': date_from.isoformat() if date_from else None,
        'date_to': date_to.isoformat() if date_to else None,
    }


def previous_window(date_from, date_to):
    """The window of equal length immediately before this one.

    A number on its own says nothing about direction — 40 tickets is good or bad
    only next to what came before. Returns (None, None) for an open-ended range,
    where "the period before" has no meaning.
    """
    if not date_from or not date_to:
        return None, None
    span = (date_to - date_from).days + 1
    return date_from - timedelta(days=span), date_from - timedelta(days=1)


def comparison_payload(date_from, date_to):
    """Headline totals for the preceding window, for period-over-period deltas."""
    previous_from, previous_to = previous_window(date_from, date_to)
    if previous_from is None:
        return None
    tickets = in_range(Ticket.objects.all(), previous_from, previous_to)
    return {
        'date_from': previous_from.isoformat(),
        'date_to': previous_to.isoformat(),
        'total': tickets.count(),
        'resolved_count': tickets.filter(resolved_at__isnull=False).count(),
        'avg_resolution_hours': avg_hours(tickets),
        'avg_rating': (
            round(tickets.filter(rating__isnull=False).aggregate(avg=Avg('rating'))['avg'], 2)
            if tickets.filter(rating__isnull=False).exists()
            else None
        ),
    }


def delivery_payload(date_from, date_to):
    """Project, task and internal to-do delivery over the window.

    Tickets are only half the work now: projects and the internal list carry the
    rest, and none of it was visible in a report before.
    """
    today = timezone.localdate()
    projects = in_range(Project.objects.all(), date_from, date_to)
    tasks = in_range(Task.objects.all(), date_from, date_to)
    # Public to-dos only. These are team delivery figures, and someone's private list is
    # neither the team's work nor anyone else's business — counting it here would leak
    # how much of it exists to every report reader.
    shared_todos = TodoItem.objects.filter(is_private=False)
    todos = in_range(shared_todos, date_from, date_to)

    # Overdue is a live fact, not a windowed one: a task is late today whether or
    # not it was created inside the range.
    overdue_tasks = Task.objects.filter(due_date__lt=today).exclude(status=Task.Status.DONE)
    unassigned_projects = Project.objects.filter(
        status=Project.Status.OPEN, assignees__isnull=True
    )

    by_assignee = list(
        Task.objects.filter(assignees__isnull=False)
        .exclude(status=Task.Status.DONE)
        .values(person=F('assignees__full_name'))
        .annotate(count=Count('id'))
        .order_by('-count')[:10]
    )

    return {
        'projects_total': projects.count(),
        'projects_open': projects.filter(status=Project.Status.OPEN).count(),
        'projects_closed': projects.filter(status=Project.Status.CLOSED).count(),
        'projects_unassigned': unassigned_projects.count(),
        'tasks_total': tasks.count(),
        'tasks_done': tasks.filter(status=Task.Status.DONE).count(),
        'tasks_overdue': overdue_tasks.count(),
        'todos_total': todos.count(),
        'todos_done': todos.filter(done=True).count(),
        'todos_overdue': shared_todos.filter(
            done=False, due_at__lt=timezone.now()
        ).count(),
        'by_task_stage': list(
            tasks.values('status').annotate(count=Count('id')).order_by('status')
        ),
        'open_tasks_by_person': by_assignee,
    }


class ReportsSummaryView(APIView):
    permission_classes = [IsAuthenticated, HasStaffPermission('allow_agent_view_reports')]

    def get(self, request):
        date_from, date_to = date_range(request)
        payload = summary_payload(date_from, date_to)
        # The trend is chart-only, so the export does not pay for building it.
        payload['trend'] = build_trend(date_from, date_to)
        payload['previous'] = comparison_payload(date_from, date_to)
        payload['delivery'] = delivery_payload(date_from, date_to)
        return Response(payload)


def agent_performance_rows(date_from, date_to):
    """Per-agent workload and quality over the window."""
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

    return [
        {
            'agent_id': agent.id,
            'agent_name': agent.full_name,
            'assigned_count': agent.assigned_count,
            'closed_count': agent.closed_count,
            'avg_rating': round(agent.avg_rating, 2) if agent.avg_rating is not None else None,
            'avg_resolution_hours': hours(agent.avg_resolution),
        }
        for agent in agents
    ]


def customer_activity_rows(date_from, date_to):
    """Per-customer ticket volume over the window, busiest first.

    Customers with nothing in the window are dropped: a report of who needs attention is
    only made harder to read by a long tail of zeroes.
    """
    window = Q()
    if date_from:
        window &= Q(tickets_created__created_at__date__gte=date_from)
    if date_to:
        window &= Q(tickets_created__created_at__date__lte=date_to)

    customers = (
        User.objects.filter(role=User.Role.CUSTOMER)
        .annotate(
            ticket_count=Count('tickets_created', filter=window),
            open_count=Count(
                'tickets_created',
                filter=window & Q(tickets_created__status__in=['open', 'in_progress']),
            ),
            closed_count=Count(
                'tickets_created', filter=window & Q(tickets_created__status='closed')
            ),
            avg_rating=Avg('tickets_created__rating', filter=window),
            avg_resolution=Avg(
                CUSTOMER_RESOLUTION_DURATION,
                filter=window & Q(tickets_created__resolved_at__isnull=False),
            ),
        )
        .filter(ticket_count__gt=0)
        .order_by('-ticket_count', 'full_name')
    )

    return [
        {
            'customer_id': customer.id,
            'customer_name': customer.full_name or customer.username,
            'software_type': ', '.join(customer.software_types or []),
            'ticket_count': customer.ticket_count,
            'open_count': customer.open_count,
            'closed_count': customer.closed_count,
            'avg_rating': (
                round(customer.avg_rating, 2) if customer.avg_rating is not None else None
            ),
            'avg_resolution_hours': hours(customer.avg_resolution),
        }
        for customer in customers
    ]


def license_rows():
    """Every licence with an end date, soonest first, tagged with where it stands.

    Deliberately not scoped by the page's date range: a licence report answers "what needs
    renewing now", which is a fact about today rather than about a reporting window.
    """
    today = timezone.localdate()
    licenses = (
        CustomerLicense.objects.filter(end_date__isnull=False)
        .select_related('customer')
        .order_by('end_date', 'id')
    )

    rows = []
    for lic in licenses:
        days_left = (lic.end_date - today).days
        if days_left < 0:
            state = 'expired'
        elif days_left <= EXPIRING_SOON_DAYS:
            state = 'expiring'
        else:
            state = 'active'
        rows.append({
            'license_id': lic.id,
            'license_name': lic.name,
            'customer_id': lic.customer_id,
            'customer_name': lic.customer.full_name or lic.customer.username,
            'start_date': lic.start_date.isoformat() if lic.start_date else None,
            'end_date': lic.end_date.isoformat(),
            'days_left': days_left,
            'state': state,
        })
    return rows


class AgentPerformanceView(APIView):
    permission_classes = [IsAuthenticated, HasStaffPermission('allow_agent_view_reports')]

    def get(self, request):
        date_from, date_to = date_range(request)
        return Response(agent_performance_rows(date_from, date_to))


class CustomerActivityView(APIView):
    permission_classes = [IsAuthenticated, HasStaffPermission('allow_agent_view_reports')]

    def get(self, request):
        date_from, date_to = date_range(request)
        return Response(customer_activity_rows(date_from, date_to))


class LicenseReportView(APIView):
    permission_classes = [IsAuthenticated, HasStaffPermission('allow_agent_view_reports')]

    def get(self, request):
        rows = license_rows()
        return Response({
            'results': rows,
            'expired_count': sum(1 for r in rows if r['state'] == 'expired'),
            'expiring_count': sum(1 for r in rows if r['state'] == 'expiring'),
            'active_count': sum(1 for r in rows if r['state'] == 'active'),
        })


STATE_LABELS = {'expired': 'Expired', 'expiring': 'Expiring soon', 'active': 'Active'}


# Kept as a local alias: the implementation now lives in core so the to-do export can
# share it, and the call sites below read the same as they always did.
_write_sheet = write_sheet


class ReportsExportView(APIView):
    """Download the whole report for the current range as a multi-sheet .xlsx."""

    permission_classes = [IsAuthenticated, HasStaffPermission('allow_agent_view_reports')]

    def get(self, request):
        date_from, date_to = date_range(request)
        summary = summary_payload(date_from, date_to)
        status_labels = dict(Ticket.Status.choices)
        priority_labels = dict(Ticket.Priority.choices)

        workbook = Workbook()

        _write_sheet(workbook, 'Summary', ['Metric', 'Value'], [
            ['Date from', summary['date_from'] or 'All time'],
            ['Date to', summary['date_to'] or 'All time'],
            ['Total tickets', summary['total']],
            ['Resolved tickets', summary['resolved_count']],
            ['Average resolution (hours)', summary['avg_resolution_hours'] or ''],
            ['Average rating', summary['avg_rating'] or ''],
            ['Ratings received', summary['rating_count']],
        ], first=True)

        _write_sheet(workbook, 'By status', ['Status', 'Tickets'], [
            [status_labels.get(r['status'], r['status']), r['count']]
            for r in summary['by_status']
        ], first=False)

        _write_sheet(workbook, 'By priority', ['Priority', 'Tickets'], [
            [priority_labels.get(r['priority'], r['priority']), r['count']]
            for r in summary['by_priority']
        ], first=False)

        _write_sheet(workbook, 'By category', ['Category', 'Tickets'], [
            [r['category_name'] or 'Uncategorized', r['count']] for r in summary['by_category']
        ], first=False)

        _write_sheet(workbook, 'By rating', ['Rating', 'Tickets'], [
            [r['rating'], r['count']] for r in summary['by_rating']
        ], first=False)

        # The export mirrors the page, so delivery belongs here too.
        delivery = delivery_payload(date_from, date_to)
        _write_sheet(workbook, 'Delivery', ['Metric', 'Value'], [
            ['Projects created', delivery['projects_total']],
            ['Projects open', delivery['projects_open']],
            ['Projects closed', delivery['projects_closed']],
            ['Projects unassigned (now)', delivery['projects_unassigned']],
            ['Tasks created', delivery['tasks_total']],
            ['Tasks done', delivery['tasks_done']],
            ['Tasks overdue (now)', delivery['tasks_overdue']],
            ['To-dos created', delivery['todos_total']],
            ['To-dos done', delivery['todos_done']],
            ['To-dos overdue (now)', delivery['todos_overdue']],
        ], first=False)

        _write_sheet(
            workbook, 'Open tasks by person', ['Person', 'Open tasks'],
            [[r['person'], r['count']] for r in delivery['open_tasks_by_person']],
            first=False,
        )

        _write_sheet(
            workbook, 'Agents',
            ['Agent', 'Assigned', 'Closed', 'Average rating', 'Average resolution (hours)'],
            [
                [
                    r['agent_name'], r['assigned_count'], r['closed_count'],
                    r['avg_rating'] or '', r['avg_resolution_hours'] or '',
                ]
                for r in agent_performance_rows(date_from, date_to)
            ],
            first=False,
        )

        _write_sheet(
            workbook, 'Customers',
            ['Customer', 'Software type', 'Tickets', 'Open', 'Closed', 'Average rating',
             'Average resolution (hours)'],
            [
                [
                    r['customer_name'], r['software_type'], r['ticket_count'],
                    r['open_count'], r['closed_count'], r['avg_rating'] or '',
                    r['avg_resolution_hours'] or '',
                ]
                for r in customer_activity_rows(date_from, date_to)
            ],
            first=False,
        )

        _write_sheet(
            workbook, 'Licenses',
            ['Customer', 'License', 'Start date', 'End date', 'Days left', 'Status'],
            [
                [
                    r['customer_name'], r['license_name'], r['start_date'] or '',
                    r['end_date'], r['days_left'], STATE_LABELS[r['state']],
                ]
                for r in license_rows()
            ],
            first=False,
        )

        response = HttpResponse(
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        suffix = f'{summary["date_from"] or "all"}_{summary["date_to"] or "all"}'
        response['Content-Disposition'] = f'attachment; filename="report_{suffix}.xlsx"'
        workbook.save(response)
        return response
