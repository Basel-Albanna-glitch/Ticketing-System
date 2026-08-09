/// Public view of a guest ticket, from GuestTicketPublicSerializer.
///
/// Deliberately narrower than [Ticket]: the tracking endpoint hides internal
/// staff detail and the guest's own phone/email, so this model only carries
/// what the public endpoint returns.
class GuestTicket {
  final int id;
  final String reference;
  final String subject;
  final String description;
  final String status;
  final String statusDisplay;
  final String priorityDisplay;
  final String category;
  final String guestName;
  final bool isAssigned;
  final String assignedAgentName;
  final String holdReason;
  final int? rating;
  final DateTime? createdAt;
  final List<GuestComment> comments;

  const GuestTicket({
    required this.id,
    required this.reference,
    required this.subject,
    this.description = '',
    this.status = 'open',
    this.statusDisplay = '',
    this.priorityDisplay = '',
    this.category = '',
    this.guestName = '',
    this.isAssigned = false,
    this.assignedAgentName = '',
    this.holdReason = '',
    this.rating,
    this.createdAt,
    this.comments = const [],
  });

  factory GuestTicket.fromJson(Map<String, dynamic> json) => GuestTicket(
        id: json['id'] as int,
        reference: json['reference'] as String? ?? '',
        subject: json['subject'] as String? ?? '',
        description: json['description'] as String? ?? '',
        status: json['status'] as String? ?? 'open',
        statusDisplay: json['status_display'] as String? ?? '',
        priorityDisplay: json['priority_display'] as String? ?? '',
        category: json['category'] as String? ?? '',
        guestName: json['guest_name'] as String? ?? '',
        isAssigned: json['is_assigned'] as bool? ?? false,
        assignedAgentName: json['assigned_agent_name'] as String? ?? '',
        holdReason: json['hold_reason'] as String? ?? '',
        rating: json['rating'] as int?,
        createdAt:
            DateTime.tryParse(json['created_at'] as String? ?? '')?.toLocal(),
        comments: (json['comments'] as List? ?? const [])
            .cast<Map<String, dynamic>>()
            .map(GuestComment.fromJson)
            .toList(),
      );
}

class GuestComment {
  final int id;
  final String authorName;
  final String body;

  /// Lets the tracker tell a support reply apart from the guest's own message.
  final bool isStaff;
  final DateTime? createdAt;

  const GuestComment({
    required this.id,
    required this.authorName,
    required this.body,
    this.isStaff = false,
    this.createdAt,
  });

  factory GuestComment.fromJson(Map<String, dynamic> json) => GuestComment(
        id: json['id'] as int,
        authorName: json['author_name'] as String? ?? 'Guest',
        body: json['body'] as String? ?? '',
        isStaff: json['is_staff'] as bool? ?? false,
        createdAt:
            DateTime.tryParse(json['created_at'] as String? ?? '')?.toLocal(),
      );
}
