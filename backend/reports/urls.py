from django.urls import path

from .views import AgentPerformanceView, ReportsSummaryView

urlpatterns = [
    path('reports/summary/', ReportsSummaryView.as_view(), name='reports-summary'),
    path('reports/agent-performance/', AgentPerformanceView.as_view(), name='reports-agent-performance'),
]
