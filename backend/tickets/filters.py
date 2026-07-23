import django_filters

from .models import Ticket


class CharInFilter(django_filters.BaseInFilter, django_filters.CharFilter):
    """Accepts a comma-separated list and filters with `__in`."""


class TicketFilterSet(django_filters.FilterSet):
    # e.g. ?status=open,in_progress matches tickets in either status.
    status = CharInFilter(field_name='status', lookup_expr='in')

    class Meta:
        model = Ticket
        fields = ['status', 'priority', 'category', 'assigned_agent', 'customer']
