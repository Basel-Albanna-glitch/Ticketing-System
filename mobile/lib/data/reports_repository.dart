import '../core/api_client.dart';
import '../models/report.dart';

/// Admin-only reporting endpoints (backend/reports/urls.py).
///
/// Every call takes the same optional window; the licence report deliberately
/// ignores it, because "what needs renewing" is a fact about today rather than
/// about a reporting period.
class ReportsRepository {
  final ApiClient api;

  ReportsRepository(this.api);

  static String? _day(DateTime? d) => d == null
      ? null
      : '${d.year.toString().padLeft(4, '0')}-'
          '${d.month.toString().padLeft(2, '0')}-'
          '${d.day.toString().padLeft(2, '0')}';

  Map<String, dynamic> _range(DateTime? from, DateTime? to) => {
        if (from != null) 'date_from': _day(from),
        if (to != null) 'date_to': _day(to),
      };

  Future<ReportsSummary> summary({DateTime? from, DateTime? to}) async {
    final res = await api.dio
        .get('/reports/summary/', queryParameters: _range(from, to));
    return ReportsSummary.fromJson(res.data as Map<String, dynamic>);
  }

  Future<List<AgentPerformance>> agentPerformance({
    DateTime? from,
    DateTime? to,
  }) async {
    final res = await api.dio
        .get('/reports/agent-performance/', queryParameters: _range(from, to));
    return (res.data as List)
        .cast<Map<String, dynamic>>()
        .map(AgentPerformance.fromJson)
        .toList();
  }

  Future<List<CustomerActivity>> customerActivity({
    DateTime? from,
    DateTime? to,
  }) async {
    final res = await api.dio
        .get('/reports/customers/', queryParameters: _range(from, to));
    return (res.data as List)
        .cast<Map<String, dynamic>>()
        .map(CustomerActivity.fromJson)
        .toList();
  }

  Future<List<LicenseRow>> licenses() async {
    final res = await api.dio.get('/reports/licenses/');
    final data = res.data;
    // The endpoint returns {results, expired_count, expiring_count,
    // active_count} — the rows live under `results`.
    final rows = data is List ? data : (data['results'] as List? ?? const []);
    return rows.cast<Map<String, dynamic>>().map(LicenseRow.fromJson).toList();
  }
}
