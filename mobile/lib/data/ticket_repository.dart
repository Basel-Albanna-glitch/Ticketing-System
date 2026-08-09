import 'package:dio/dio.dart';
import 'package:path/path.dart' as p;

import '../core/api_client.dart';
import '../models/calendar_ticket.dart';
import '../models/customer.dart';
import '../models/paginated.dart';
import '../models/ticket.dart';
import '../models/user.dart';

/// Talks to the /api/tickets/ ViewSet.
///
/// Scoping is entirely server-side (get_scoped_tickets in tickets/views.py), so
/// the same list call returns a customer's own tickets or the full queue for
/// staff — the app never has to filter by role itself.
class TicketRepository {
  final ApiClient api;

  TicketRepository(this.api);

  Future<Paginated<Ticket>> list({
    int page = 1,
    String? status,
    String? priority,
    String? search,
    int? assignedAgent,
  }) async {
    final res = await api.dio.get('/tickets/', queryParameters: {
      'page': page,
      if (status != null && status.isNotEmpty) 'status': status,
      if (priority != null && priority.isNotEmpty) 'priority': priority,
      if (search != null && search.isNotEmpty) 'search': search,
      if (assignedAgent != null) 'assigned_agent': assignedAgent,
    });
    return Paginated.fromAny(res.data, Ticket.fromJson);
  }

  Future<Ticket> detail(int id) async {
    final res = await api.dio.get('/tickets/$id/');
    return Ticket.fromJson(res.data as Map<String, dynamic>);
  }

  /// Create a ticket.
  ///
  /// A customer posting for themselves only needs subject, description and
  /// category — the view fills in customer from request.user and forces
  /// start_date to today (tickets/views.py:294).
  ///
  /// Staff must supply [customerId] or the server answers 400. Only admins may
  /// supply [assignedAgentIds]; the first becomes the assignee and the rest are
  /// added as collaborators (tickets/views.py:311).
  Future<Ticket> create({
    required String subject,
    required String description,
    required int categoryId,
    String priority = TicketPriority.medium,
    int? customerId,
    int? branchId,
    DateTime? startDate,
    List<int> assignedAgentIds = const [],
    List<String> attachmentPaths = const [],
  }) async {
    String? day(DateTime? d) => d == null
        ? null
        : '${d.year.toString().padLeft(4, '0')}-'
            '${d.month.toString().padLeft(2, '0')}-'
            '${d.day.toString().padLeft(2, '0')}';

    final fields = <String, dynamic>{
      'subject': subject,
      'description': description,
      'category': categoryId,
      'priority': priority,
      if (customerId != null) 'customer_id': customerId,
      if (branchId != null) 'branch_id': branchId,
      if (startDate != null) 'start_date': day(startDate),
    };

    // Files force multipart, which cannot carry a nested list — so the agent
    // ids go one-per-key, which is what request.data.getlist expects
    // (tickets/views.py:312).
    if (attachmentPaths.isEmpty) {
      final res = await api.dio.post('/tickets/', data: {
        ...fields,
        if (assignedAgentIds.isNotEmpty) 'assigned_agent_ids': assignedAgentIds,
      });
      return Ticket.fromJson(res.data as Map<String, dynamic>);
    }

    final form = FormData.fromMap(fields);
    for (final id in assignedAgentIds) {
      form.fields.add(MapEntry('assigned_agent_ids', '$id'));
    }
    for (final path in attachmentPaths) {
      form.files.add(MapEntry(
        'attachments',
        await MultipartFile.fromFile(path, filename: p.basename(path)),
      ));
    }
    final res = await api.dio.post('/tickets/', data: form);
    return Ticket.fromJson(res.data as Map<String, dynamic>);
  }

  /// Change status. The server rejects this with a 400 while the ticket is
  /// unassigned, and requires holdReason when moving to on_hold
  /// (tickets/views.py:366 and :380).
  Future<void> setStatus(int id, String status, {String? holdReason}) {
    return api.dio.patch('/tickets/$id/status/', data: {
      'status': status,
      if (holdReason != null) 'hold_reason': holdReason,
    });
  }

  /// Assign or reassign. Pass null to release, which only an admin may do.
  Future<void> assign(int id, int? agentId) {
    return api.dio.patch('/tickets/$id/assign/', data: {'assigned_agent': agentId});
  }

  Future<List<Comment>> comments(int id) async {
    final res = await api.dio.get('/tickets/$id/comments/');
    return (res.data as List)
        .cast<Map<String, dynamic>>()
        .map(Comment.fromJson)
        .toList();
  }

  Future<Comment> addComment(int id, String body) async {
    final res = await api.dio.post('/tickets/$id/comments/', data: {'body': body});
    return Comment.fromJson(res.data as Map<String, dynamic>);
  }

  Future<List<TicketActivity>> activity(int id) async {
    final res = await api.dio.get('/tickets/$id/activity/');
    return (res.data as List)
        .cast<Map<String, dynamic>>()
        .map(TicketActivity.fromJson)
        .toList();
  }

  /// Set or clear the due date. Send null to clear it.
  Future<void> setDeadline(int id, DateTime? due) {
    return api.dio.patch('/tickets/$id/deadline/', data: {
      'due_at': due?.toUtc().toIso8601String(),
    });
  }

  /// Admin-only. Replaces the whole collaborator set, so send the full list.
  Future<void> setCollaborators(int id, List<int> agentIds) {
    return api.dio.patch('/tickets/$id/collaborators/', data: {
      'collaborators': agentIds,
    });
  }

  /// Staff-only. Replaces the whole set of linked knowledge-base articles.
  Future<void> setArticles(int id, List<int> articleIds) {
    return api.dio.patch('/tickets/$id/articles/', data: {
      'articles': articleIds,
    });
  }

  /// Link a guest ticket to a customer, or pass null to unlink.
  ///
  /// [branchId] optionally attaches one of that customer's branches in the same
  /// call; the server rejects a branch belonging to anyone else. Unlinking only
  /// works on guest-origin tickets — the server refuses to leave a
  /// customer-created ticket without an owner. Admins may always do this;
  /// agents only when `allow_agent_link_customer` is enabled.
  Future<void> setCustomer(int id, int? customerId, {int? branchId}) {
    return api.dio.patch('/tickets/$id/customer/', data: {
      'customer': customerId,
      if (branchId != null) 'branch': branchId,
    });
  }

  /// Change the ticket's branch. Pass null to clear it.
  ///
  /// The server validates the branch belongs to the ticket's own customer, so a
  /// mismatched id comes back as a readable 400 rather than being applied.
  Future<void> setBranch(int id, int? branchId) {
    return api.dio.patch('/tickets/$id/', data: {'branch_id': branchId});
  }

  Future<void> deleteTicket(int id) => api.dio.delete('/tickets/$id/');

  Future<List<TicketPhase>> phases(int id) async {
    final res = await api.dio.get('/tickets/$id/phases/');
    return (res.data as List)
        .cast<Map<String, dynamic>>()
        .map(TicketPhase.fromJson)
        .toList();
  }

  Future<TicketPhase> addPhase(int id, String body) async {
    final res = await api.dio.post('/tickets/$id/phases/', data: {'body': body});
    return TicketPhase.fromJson(res.data as Map<String, dynamic>);
  }

  /// Fetch every page of a list endpoint.
  ///
  /// DRF paginates at 10 rows (PAGE_SIZE), which is fine for a scrolling list
  /// but wrong for anything used as a complete set — a category tree missing
  /// its 11th entry silently loses a branch. The page cap is a runaway guard,
  /// not an expected limit.
  Future<List<Map<String, dynamic>>> _allPages(
    String path, {
    Map<String, dynamic>? query,
  }) async {
    final rows = <Map<String, dynamic>>[];
    for (var page = 1; page <= 50; page++) {
      final res = await api.dio.get(path, queryParameters: {
        ...?query,
        'page': page,
      });
      final data = res.data;
      if (data is List) {
        rows.addAll(data.cast<Map<String, dynamic>>());
        break;
      }
      rows.addAll((data['results'] as List? ?? const [])
          .cast<Map<String, dynamic>>());
      if (data['next'] == null) break;
    }
    return rows;
  }

  Future<List<Category>> categories() async {
    final rows = await _allPages('/categories/');
    return rows.map(Category.fromJson).toList();
  }

  Future<List<AppUser>> agents() async {
    final rows = await _allPages('/users/agents/');
    return rows.map(AppUser.fromJson).toList();
  }

  /// Tickets overlapping [from, to] for the month grid. Unpaginated by design,
  /// and both bounds are required or the server returns 400.
  Future<List<CalendarTicket>> calendar({
    required DateTime from,
    required DateTime to,
    String? status,
    int? assignedAgent,
  }) async {
    String day(DateTime d) =>
        '${d.year.toString().padLeft(4, '0')}-'
        '${d.month.toString().padLeft(2, '0')}-'
        '${d.day.toString().padLeft(2, '0')}';

    final res = await api.dio.get('/tickets/calendar/', queryParameters: {
      'from': day(from),
      'to': day(to),
      if (status != null && status.isNotEmpty) 'status': status,
      if (assignedAgent != null) 'assigned_agent': assignedAgent,
    });
    return (res.data as List)
        .cast<Map<String, dynamic>>()
        .map(CalendarTicket.fromJson)
        .toList();
  }

  Future<Paginated<Customer>> customers({int page = 1, String? search}) async {
    final res = await api.dio.get('/users/customers/', queryParameters: {
      'page': page,
      if (search != null && search.isNotEmpty) 'search': search,
    });
    return Paginated.fromAny(res.data, Customer.fromJson);
  }

  Future<Customer> customer(int id) async {
    final res = await api.dio.get('/users/customers/$id/');
    return Customer.fromJson(res.data as Map<String, dynamic>);
  }

  Future<int> unreadNotifications() async {
    final res = await api.dio.get('/notifications/', queryParameters: {'is_read': false});
    final data = res.data;
    if (data is Map && data['count'] is int) return data['count'] as int;
    if (data is List) return data.length;
    return 0;
  }
}
