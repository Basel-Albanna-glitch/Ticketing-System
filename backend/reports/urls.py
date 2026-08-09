from django.urls import path

from .views import (
    AgentPerformanceView,
    CustomerActivityView,
    LicenseReportView,
    ReportsExportView,
    ReportsSummaryView,
)

urlpatterns = [
    path('reports/summary/', ReportsSummaryView.as_view(), name='reports-summary'),
    path('reports/agent-performance/', AgentPerformanceView.as_view(), name='reports-agent-performance'),
    path('reports/customers/', CustomerActivityView.as_view(), name='reports-customers'),
    path('reports/licenses/', LicenseReportView.as_view(), name='reports-licenses'),
    path('reports/export/', ReportsExportView.as_view(), name='reports-export'),
]
