import 'ticket.dart';

/// Mirrors TicketCalendarSerializer — a minimal row for drawing a chip in the
/// month grid.
///
/// A closed ticket is placed on two days: its start date and its close date.
/// The server sends [closedDate] pre-localised for exactly that reason, so the
/// client does no timezone arithmetic of its own.
class CalendarTicket {
  final int id;
  final String reference;
  final String subject;
  final String status;
  final String priority;
  final DateTime? startDate;
  final DateTime? closedDate;
  final String assignedAgentName;

  const CalendarTicket({
    required this.id,
    required this.reference,
    required this.subject,
    required this.status,
    required this.priority,
    this.startDate,
    this.closedDate,
    this.assignedAgentName = '',
  });

  bool get isClosed => status == TicketStatus.closed;

  static DateTime? _day(String? v) {
    if (v == null || v.isEmpty) return null;
    final parsed = DateTime.tryParse(v);
    return parsed == null
        ? null
        : DateTime(parsed.year, parsed.month, parsed.day);
  }

  factory CalendarTicket.fromJson(Map<String, dynamic> json) => CalendarTicket(
        id: json['id'] as int,
        reference: json['reference'] as String? ?? '',
        subject: json['subject'] as String? ?? '',
        status: json['status'] as String? ?? TicketStatus.open,
        priority: json['priority'] as String? ?? TicketPriority.medium,
        startDate: _day(json['start_date'] as String?),
        closedDate: _day(json['closed_date'] as String?),
        assignedAgentName: json['assigned_agent_name'] as String? ?? '',
      );
}
