import 'user.dart';

/// Ticket.Status from tickets/models.py:124. Note that 'open' is labelled
/// "Unassigned" in the UI — it means nobody has picked the ticket up yet.
class TicketStatus {
  static const open = 'open';
  static const inProgress = 'in_progress';
  static const onHold = 'on_hold';
  static const resolved = 'resolved';
  static const closed = 'closed';

  static const all = [open, inProgress, onHold, resolved, closed];

  /// "Assigned" is not a stored status. A ticket handed to an agent but not yet
  /// started stays in OPEN, which reads as "Unassigned" while nobody owns it
  /// and "Assigned" once someone does (see DASHBOARD_ASSIGNED in
  /// backend/tickets/views.py). Pass [assigned] so the label tells the truth.
  static String label(String value, {bool assigned = false}) =>
      switch (value) {
        open => assigned ? 'Assigned' : 'Unassigned',
        inProgress => 'In Progress',
        onHold => 'On Hold',
        resolved => 'Resolved',
        closed => 'Closed',
        _ => value,
      };
}

class TicketPriority {
  static const low = 'low';
  static const medium = 'medium';
  static const high = 'high';
  static const urgent = 'urgent';

  static const all = [low, medium, high, urgent];

  static String label(String value) =>
      value.isEmpty ? value : value[0].toUpperCase() + value.substring(1);
}

class Category {
  final int id;
  final String name;

  /// Categories nest one under another; null means a top-level category.
  final int? parentId;

  const Category({required this.id, required this.name, this.parentId});

  factory Category.fromJson(Map<String, dynamic> json) => Category(
        id: json['id'] as int,
        name: json['name'] as String? ?? '',
        parentId: json['parent'] as int?,
      );
}

class Comment {
  final int id;
  final String authorName;
  final String body;
  final DateTime? createdAt;

  const Comment({
    required this.id,
    required this.authorName,
    required this.body,
    this.createdAt,
  });

  factory Comment.fromJson(Map<String, dynamic> json) => Comment(
        id: json['id'] as int,
        authorName: json['author_name'] as String? ?? 'Guest',
        body: json['body'] as String? ?? '',
        createdAt: DateTime.tryParse(json['created_at'] as String? ?? ''),
      );
}

class TicketPhase {
  final int id;
  final String authorName;
  final String body;
  final DateTime? createdAt;

  const TicketPhase({
    required this.id,
    required this.authorName,
    required this.body,
    this.createdAt,
  });

  factory TicketPhase.fromJson(Map<String, dynamic> json) => TicketPhase(
        id: json['id'] as int,
        authorName: json['author_name'] as String? ?? '',
        body: json['body'] as String? ?? '',
        createdAt: DateTime.tryParse(json['created_at'] as String? ?? ''),
      );
}

/// Mirrors TicketActivitySerializer — the audit trail shown as a timeline.
class TicketActivity {
  final int id;
  final String actorName;
  final String activityType;
  final String description;
  final DateTime? createdAt;

  const TicketActivity({
    required this.id,
    required this.activityType,
    this.actorName = 'System',
    this.description = '',
    this.createdAt,
  });

  factory TicketActivity.fromJson(Map<String, dynamic> json) {
    final actor = json['actor'];
    return TicketActivity(
      id: json['id'] as int,
      activityType: json['activity_type'] as String? ?? '',
      // A null actor means the change was made by the system, not a person.
      actorName: actor is Map ? (actor['full_name'] as String? ?? '') : 'System',
      description: json['description'] as String? ?? '',
      createdAt:
          DateTime.tryParse(json['created_at'] as String? ?? '')?.toLocal(),
    );
  }
}

class TicketArticleLink {
  final int id;
  final String title;

  const TicketArticleLink({required this.id, required this.title});

  factory TicketArticleLink.fromJson(Map<String, dynamic> json) =>
      TicketArticleLink(
        id: json['id'] as int,
        title: json['title'] as String? ?? '',
      );
}

/// Covers both TicketListSerializer and TicketDetailSerializer — the detail-only
/// fields are simply null on a list row.
class Ticket {
  final int id;
  final String reference;
  final String subject;
  final String? description;
  final String status;
  final String priority;
  final AppUser? customer;
  final AppUser? assignedAgent;
  final Category? category;
  final String guestName;
  final String guestCompany;

  /// Branch the guest typed on the public form — free text, unrelated to the
  /// [branchName] FK below, which only exists once a customer is linked.
  final String guestBranch;
  final String guestPhone;
  final String guestEmail;
  final String? branchName;
  final DateTime? createdAt;
  final DateTime? dueAt;
  final DateTime? closedAt;
  final DateTime? resolvedAt;
  final String holdReason;
  final int? rating;
  final String ratingComment;
  final List<Comment> comments;
  final List<TicketPhase> phases;
  final List<AppUser> collaborators;
  final List<TicketArticleLink> articles;

  const Ticket({
    required this.id,
    required this.reference,
    required this.subject,
    required this.status,
    required this.priority,
    this.description,
    this.customer,
    this.assignedAgent,
    this.category,
    this.guestName = '',
    this.guestCompany = '',
    this.guestBranch = '',
    this.guestPhone = '',
    this.guestEmail = '',
    this.branchName,
    this.createdAt,
    this.dueAt,
    this.closedAt,
    this.resolvedAt,
    this.holdReason = '',
    this.rating,
    this.ratingComment = '',
    this.comments = const [],
    this.phases = const [],
    this.collaborators = const [],
    this.articles = const [],
  });

  /// A ticket with no registered customer but guest contact details came in
  /// through the public form; staff may link it to a customer account later.
  bool get isGuest => customer == null && guestPhone.isNotEmpty;

  /// A guest ticket has no registered customer, only the guest_* contact fields.
  String get requesterName =>
      customer?.fullName ?? (guestName.isEmpty ? 'Guest' : guestName);

  bool get isAssigned => assignedAgent != null;
  bool get isClosed => status == TicketStatus.closed;

  static DateTime? _date(dynamic v) =>
      v is String ? DateTime.tryParse(v)?.toLocal() : null;

  factory Ticket.fromJson(Map<String, dynamic> json) {
    List<T> list<T>(String key, T Function(Map<String, dynamic>) parse) =>
        (json[key] as List? ?? const [])
            .cast<Map<String, dynamic>>()
            .map(parse)
            .toList();

    return Ticket(
      id: json['id'] as int,
      reference: json['reference'] as String? ?? '',
      subject: json['subject'] as String? ?? '',
      description: json['description'] as String?,
      status: json['status'] as String? ?? TicketStatus.open,
      priority: json['priority'] as String? ?? TicketPriority.medium,
      customer: json['customer'] == null
          ? null
          : AppUser.fromJson(json['customer'] as Map<String, dynamic>),
      assignedAgent: json['assigned_agent'] == null
          ? null
          : AppUser.fromJson(json['assigned_agent'] as Map<String, dynamic>),
      category: json['category'] is Map
          ? Category.fromJson(json['category'] as Map<String, dynamic>)
          : null,
      guestName: json['guest_name'] as String? ?? '',
      guestCompany: json['guest_company'] as String? ?? '',
      guestBranch: json['guest_branch'] as String? ?? '',
      guestPhone: json['guest_phone'] as String? ?? '',
      guestEmail: json['guest_email'] as String? ?? '',
      branchName: json['branch'] is Map
          ? (json['branch']['name'] as String?)
          : null,
      createdAt: _date(json['created_at']),
      dueAt: _date(json['due_at']),
      closedAt: _date(json['closed_at']),
      resolvedAt: _date(json['resolved_at']),
      holdReason: json['hold_reason'] as String? ?? '',
      rating: json['rating'] as int?,
      ratingComment: json['rating_comment'] as String? ?? '',
      comments: list('comments', Comment.fromJson),
      phases: list('phases', TicketPhase.fromJson),
      collaborators: list('collaborators', AppUser.fromJson),
      articles: list('articles', TicketArticleLink.fromJson),
    );
  }
}
