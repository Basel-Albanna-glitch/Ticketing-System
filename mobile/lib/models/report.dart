// Models for the reports API (backend/reports/views.py).

class TrendPoint {
  final DateTime date;
  final int created;
  final int resolved;

  const TrendPoint({
    required this.date,
    required this.created,
    required this.resolved,
  });

  factory TrendPoint.fromJson(Map<String, dynamic> json) => TrendPoint(
        date: DateTime.parse(json['date'] as String),
        created: json['created'] as int? ?? 0,
        resolved: json['resolved'] as int? ?? 0,
      );
}

/// Opened vs resolved over time. The server picks day/week/month buckets by
/// span and fills quiet buckets with zero, so the series is already continuous.
class Trend {
  final String granularity;
  final List<TrendPoint> points;

  const Trend({this.granularity = 'day', this.points = const []});

  factory Trend.fromJson(Map<String, dynamic> json) => Trend(
        granularity: json['granularity'] as String? ?? 'day',
        points: (json['points'] as List? ?? const [])
            .cast<Map<String, dynamic>>()
            .map(TrendPoint.fromJson)
            .toList(),
      );
}

/// One row of a breakdown (by status / priority / category / rating).
class Breakdown {
  final String label;
  final int count;

  const Breakdown({required this.label, required this.count});
}

class ReportsSummary {
  final int total;
  final int resolvedCount;
  final double? avgResolutionHours;
  final double? avgRating;
  final int ratingCount;
  final List<Breakdown> byStatus;
  final List<Breakdown> byPriority;
  final List<Breakdown> byCategory;
  final List<Breakdown> byRating;
  final Trend trend;

  const ReportsSummary({
    this.total = 0,
    this.resolvedCount = 0,
    this.avgResolutionHours,
    this.avgRating,
    this.ratingCount = 0,
    this.byStatus = const [],
    this.byPriority = const [],
    this.byCategory = const [],
    this.byRating = const [],
    this.trend = const Trend(),
  });

  static double? _double(Object? v) =>
      v == null ? null : (v as num).toDouble();

  static List<Breakdown> _rows(
    Object? raw,
    String key, {
    String fallback = '—',
  }) {
    return (raw as List? ?? const [])
        .cast<Map<String, dynamic>>()
        .map((r) => Breakdown(
              label: '${r[key] ?? fallback}',
              count: r['count'] as int? ?? 0,
            ))
        .toList();
  }

  factory ReportsSummary.fromJson(Map<String, dynamic> json) => ReportsSummary(
        total: json['total'] as int? ?? 0,
        resolvedCount: json['resolved_count'] as int? ?? 0,
        avgResolutionHours: _double(json['avg_resolution_hours']),
        avgRating: _double(json['avg_rating']),
        ratingCount: json['rating_count'] as int? ?? 0,
        byStatus: _rows(json['by_status'], 'status'),
        byPriority: _rows(json['by_priority'], 'priority'),
        // Uncategorised tickets come back with a null category name.
        byCategory: _rows(json['by_category'], 'category_name',
            fallback: 'Uncategorised'),
        byRating: _rows(json['by_rating'], 'rating'),
        trend: Trend.fromJson(
            (json['trend'] as Map?)?.cast<String, dynamic>() ?? const {}),
      );
}

class AgentPerformance {
  final int agentId;
  final String agentName;
  final int assignedCount;
  final int closedCount;
  final double? avgRating;
  final double? avgResolutionHours;

  const AgentPerformance({
    required this.agentId,
    required this.agentName,
    this.assignedCount = 0,
    this.closedCount = 0,
    this.avgRating,
    this.avgResolutionHours,
  });

  factory AgentPerformance.fromJson(Map<String, dynamic> json) =>
      AgentPerformance(
        agentId: json['agent_id'] as int,
        agentName: json['agent_name'] as String? ?? '',
        assignedCount: json['assigned_count'] as int? ?? 0,
        closedCount: json['closed_count'] as int? ?? 0,
        avgRating: ReportsSummary._double(json['avg_rating']),
        avgResolutionHours:
            ReportsSummary._double(json['avg_resolution_hours']),
      );
}

class CustomerActivity {
  final int customerId;
  final String customerName;
  final int ticketCount;
  final int openCount;
  final int closedCount;
  final double? avgRating;
  final double? avgResolutionHours;

  const CustomerActivity({
    required this.customerId,
    required this.customerName,
    this.ticketCount = 0,
    this.openCount = 0,
    this.closedCount = 0,
    this.avgRating,
    this.avgResolutionHours,
  });

  factory CustomerActivity.fromJson(Map<String, dynamic> json) =>
      CustomerActivity(
        customerId: json['customer_id'] as int,
        customerName: json['customer_name'] as String? ?? '',
        ticketCount: json['ticket_count'] as int? ?? 0,
        openCount: json['open_count'] as int? ?? 0,
        closedCount: json['closed_count'] as int? ?? 0,
        avgRating: ReportsSummary._double(json['avg_rating']),
        avgResolutionHours:
            ReportsSummary._double(json['avg_resolution_hours']),
      );
}

class LicenseRow {
  final int licenseId;
  final String licenseName;
  final String customerName;
  final DateTime? endDate;
  final int daysLeft;

  /// 'active' | 'expiring' | 'expired'
  final String state;

  const LicenseRow({
    required this.licenseId,
    required this.licenseName,
    required this.customerName,
    required this.state,
    this.endDate,
    this.daysLeft = 0,
  });

  factory LicenseRow.fromJson(Map<String, dynamic> json) => LicenseRow(
        licenseId: json['license_id'] as int,
        licenseName: json['license_name'] as String? ?? '',
        customerName: json['customer_name'] as String? ?? '',
        state: json['state'] as String? ?? 'active',
        endDate: DateTime.tryParse(json['end_date'] as String? ?? ''),
        daysLeft: json['days_left'] as int? ?? 0,
      );
}
