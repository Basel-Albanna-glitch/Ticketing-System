import 'ticket.dart';

/// Mirrors tickets.views.DashboardView. The counts are computed server-side
/// against the caller's scoped queryset, so a customer's "total" is their own
/// tickets while an agent's is the whole visible queue.
class DashboardData {
  final String role;
  final int total;
  final int open;
  final int assigned;
  final int inProgress;
  final int resolved;
  final List<Ticket> recent;

  const DashboardData({
    required this.role,
    this.total = 0,
    this.open = 0,
    this.assigned = 0,
    this.inProgress = 0,
    this.resolved = 0,
    this.recent = const [],
  });

  factory DashboardData.fromJson(Map<String, dynamic> json) {
    final stats = (json['stats'] as Map?)?.cast<String, dynamic>() ?? const {};
    return DashboardData(
      role: json['role'] as String? ?? 'customer',
      total: stats['total'] as int? ?? 0,
      open: stats['open'] as int? ?? 0,
      assigned: stats['assigned'] as int? ?? 0,
      inProgress: stats['in_progress'] as int? ?? 0,
      resolved: stats['resolved'] as int? ?? 0,
      recent: (json['recent_tickets'] as List? ?? const [])
          .cast<Map<String, dynamic>>()
          .map(Ticket.fromJson)
          .toList(),
    );
  }
}
