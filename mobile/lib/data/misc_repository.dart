import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:path/path.dart' as p;

import '../core/api_client.dart';
import '../models/article.dart';
import '../models/customer.dart';
import '../models/dashboard.dart';
import '../models/notification.dart';
import '../models/project.dart';
import '../models/user.dart';

/// Everything outside the ticket lifecycle: dashboard, notifications, the
/// knowledge base and the signed-in user's own account.
class MiscRepository {
  final ApiClient api;

  MiscRepository(this.api);

  static List<Map<String, dynamic>> _rows(dynamic data) {
    final rows = data is List ? data : (data['results'] as List? ?? const []);
    return rows.cast<Map<String, dynamic>>();
  }

  // --- Dashboard -----------------------------------------------------------

  Future<DashboardData> dashboard() async {
    final res = await api.dio.get('/dashboard/');
    return DashboardData.fromJson(res.data as Map<String, dynamic>);
  }

  // --- Notifications -------------------------------------------------------

  Future<List<AppNotification>> notifications() async {
    final res = await api.dio.get('/notifications/');
    return _rows(res.data).map(AppNotification.fromJson).toList();
  }

  Future<void> markRead(int id) => api.dio.post('/notifications/$id/read/');

  Future<void> markAllRead() => api.dio.post('/notifications/mark-all-read/');

  // --- Knowledge base ------------------------------------------------------

  Future<List<Article>> articles({String? search}) async {
    final res = await api.dio.get('/articles/', queryParameters: {
      if (search != null && search.isNotEmpty) 'search': search,
    });
    return _rows(res.data).map(Article.fromJson).toList();
  }

  Future<Article> article(int id) async {
    final res = await api.dio.get('/articles/$id/');
    return Article.fromJson(res.data as Map<String, dynamic>);
  }

  /// Admin-only, unless `allow_agent_manage_kb` is enabled in ticket settings
  /// (ArticleViewSet.get_permissions), in which case agents may create too.
  Future<Article> createArticle({
    required String title,
    required String body,
    int? categoryId,
    bool isPublished = true,
  }) async {
    final res = await api.dio.post('/articles/', data: {
      'title': title,
      'body': body,
      if (categoryId != null) 'category_id': categoryId,
      'is_published': isPublished,
    });
    return Article.fromJson(res.data as Map<String, dynamic>);
  }

  /// Same permission as [createArticle]: admin, or agents when
  /// `allow_agent_manage_kb` is on.
  Future<Article> updateArticle(
    int id, {
    required String title,
    required String body,
    int? categoryId,
    bool isPublished = true,
  }) async {
    final res = await api.dio.patch('/articles/$id/', data: {
      'title': title,
      'body': body,
      // Sent even when null so the category can be cleared again.
      'category_id': categoryId,
      'is_published': isPublished,
    });
    return Article.fromJson(res.data as Map<String, dynamic>);
  }

  Future<void> deleteArticle(int id) => api.dio.delete('/articles/$id/');

  // --- Creation: staff/admin records ---------------------------------------

  Future<Project> createProject({
    required String name,
    String description = '',
    String status = 'open',
    int? customerId,
    int? branchId,
    List<int> assigneeIds = const [],
    DateTime? startDate,
    DateTime? endDate,
  }) async {
    final res = await api.dio.post('/projects/', data: {
      'name': name,
      'description': description,
      'status': status,
      // All optional: null clears rather than sending an empty string.
      'customer_id': customerId,
      'branch_id': branchId,
      'assignee_ids': assigneeIds,
      'start_date': _dateOnly(startDate),
      'end_date': _dateOnly(endDate),
    });
    return Project.fromJson(res.data as Map<String, dynamic>);
  }

  Future<void> deleteProject(int id) => api.dio.delete('/projects/$id/');

  /// Toggle yourself on or off a project's assignees. Needs no assignment
  /// permission — taking work on is not the same as handing it to someone else.
  Future<Project> claimProject(int id) async {
    final res = await api.dio.post('/projects/$id/claim/');
    return Project.fromJson(res.data as Map<String, dynamic>);
  }

  Future<Project> updateProject(int id, Map<String, dynamic> patch) async {
    final res = await api.dio.patch('/projects/$id/', data: patch);
    return Project.fromJson(res.data as Map<String, dynamic>);
  }

  /// The API's date fields are plain dates, not instants.
  static String? _dateOnly(DateTime? value) => value == null
      ? null
      : '${value.year.toString().padLeft(4, '0')}-'
          '${value.month.toString().padLeft(2, '0')}-'
          '${value.day.toString().padLeft(2, '0')}';

  /// Admin-only. Role may be agent or admin; the serializer rejects anything
  /// else. A password is required at creation.
  Future<void> createAgent({
    required String username,
    required String fullName,
    required String password,
    String email = '',
    String role = 'agent',
    bool isAvailable = true,
  }) {
    return api.dio.post('/users/agents/', data: {
      'username': username,
      'full_name': fullName,
      'password': password,
      'email': email,
      'role': role,
      'is_available': isAvailable,
    });
  }

  Future<List<SoftwareType>> softwareTypes() async {
    final res = await api.dio.get('/software-types/');
    return _rows(res.data).map(SoftwareType.fromJson).toList();
  }

  /// Admin-only. The serializer raises if no password is supplied.
  ///
  /// Branches and licenses are not nested serializers — `CustomerViewSet` reads
  /// them from `branches` / `licenses` fields that may be a JSON *string* or a
  /// real list, and file uploads come through `attachments`. When files are
  /// present the whole request has to be multipart, and multipart cannot carry
  /// nested structures, so the two lists are JSON-encoded in that case.
  Future<void> createCustomer({
    required String username,
    required String fullName,
    required String password,
    String email = '',
    String phone = '',
    String address = '',
    String taxNumber = '',
    String softwareType = '',
    List<Map<String, String?>> branches = const [],
    List<Map<String, String?>> licenses = const [],
    List<String> attachmentPaths = const [],
  }) async {
    final fields = <String, dynamic>{
      'username': username,
      'full_name': fullName,
      'password': password,
      'email': email,
      'phone': phone,
      'address': address,
      'tax_number': taxNumber,
      // A SoftwareType *name*, not its id — `software_type` is a CharField on
      // the user model. Always sent; '' means none, matching the web form.
      'software_type': softwareType,
    };

    if (attachmentPaths.isEmpty) {
      await api.dio.post('/users/customers/', data: {
        ...fields,
        if (branches.isNotEmpty) 'branches': branches,
        if (licenses.isNotEmpty) 'licenses': licenses,
      });
      return;
    }

    final form = FormData.fromMap({
      ...fields,
      if (branches.isNotEmpty) 'branches': jsonEncode(branches),
      if (licenses.isNotEmpty) 'licenses': jsonEncode(licenses),
      'attachments': [
        for (final path in attachmentPaths)
          await MultipartFile.fromFile(path, filename: p.basename(path)),
      ],
    });
    await api.dio.post('/users/customers/', data: form);
  }

  /// Admin, or an agent when `allow_agent_edit_customers` is on
  /// (CustomerViewSet.get_permissions). Creating and deleting stay admin-only.
  ///
  /// Branches and licences are **replaced** by this call, not merged:
  /// `_save_branches`/`_save_licenses` delete the existing rows first when
  /// updating. They only do that if the field is present at all, so both lists
  /// are always sent — omitting an emptied list would silently keep the rows
  /// the user just deleted.
  ///
  /// [password] is optional here (it is mandatory on create); blank means
  /// "leave the existing password alone". `username` is deliberately absent —
  /// the web's edit form does not send it either, so it stays immutable.
  Future<void> updateCustomer({
    required int id,
    required String fullName,
    String? password,
    String email = '',
    String phone = '',
    String address = '',
    String taxNumber = '',
    String softwareType = '',
    List<Map<String, String?>> branches = const [],
    List<Map<String, String?>> licenses = const [],
    List<String> attachmentPaths = const [],
  }) async {
    final fields = <String, dynamic>{
      'full_name': fullName,
      'email': email,
      'phone': phone,
      'address': address,
      'tax_number': taxNumber,
      'software_type': softwareType,
      if (password != null && password.isNotEmpty) 'password': password,
    };

    await api.dio.patch('/users/customers/$id/', data: {
      ...fields,
      'branches': branches,
      'licenses': licenses,
    });

    if (attachmentPaths.isEmpty) return;

    // Files go in a second PATCH. `_save_attachments` appends rather than
    // replaces, and with no `branches`/`licenses` keys present the view leaves
    // the rows just written by the call above untouched.
    final form = FormData.fromMap({
      'attachments': [
        for (final path in attachmentPaths)
          await MultipartFile.fromFile(path, filename: p.basename(path)),
      ],
    });
    await api.dio.patch('/users/customers/$id/', data: form);
  }

  /// Admin-only. Pass [parentId] to create a sub-category.
  Future<void> createCategory({
    required String name,
    String description = '',
    String priority = 'medium',
    int? parentId,
  }) {
    return api.dio.post('/categories/', data: {
      'name': name,
      'description': description,
      'priority': priority,
      'parent': parentId,
    });
  }

  // --- My account ----------------------------------------------------------

  /// PATCHes the profile fields the user owns. The endpoint is separate from
  /// /auth/me/ so role and permissions stay read-only.
  Future<AppUser> updateProfile({String? fullName, String? email}) async {
    final res = await api.dio.patch('/auth/me/profile/', data: {
      if (fullName != null) 'full_name': fullName,
      if (email != null) 'email': email,
    });
    return AppUser.fromJson(res.data as Map<String, dynamic>);
  }

  Future<void> changePassword({
    required String oldPassword,
    required String newPassword,
    required String confirmPassword,
  }) {
    return api.dio.post('/auth/change-password/', data: {
      'old_password': oldPassword,
      'new_password': newPassword,
      'confirm_password': confirmPassword,
    });
  }

  // --- Agents (admin) -------------------------------------------------------

  Future<List<Agent>> agents() async {
    final res = await api.dio.get('/users/agents/');
    return _rows(res.data).map(Agent.fromJson).toList();
  }

  /// Toggle an agent's availability or active flag. Admin-only server-side.
  Future<void> updateAgent(int id, Map<String, dynamic> changes) {
    return api.dio.patch('/users/agents/$id/', data: changes);
  }

  // --- Ticket settings (admin) ---------------------------------------------

  Future<TicketSettings> ticketSettings() async {
    final res = await api.dio.get('/settings/tickets/');
    return TicketSettings.fromJson(res.data as Map<String, dynamic>);
  }

  /// Readable to any signed-in user but only writable by admins
  /// (TicketSettingsView.get_permissions), so a non-admin gets a 403 here.
  Future<TicketSettings> setTicketSetting(String field, bool value) async {
    final res = await api.dio.patch('/settings/tickets/', data: {field: value});
    return TicketSettings.fromJson(res.data as Map<String, dynamic>);
  }

  // --- Projects -------------------------------------------------------------

  /// [customerId] and [assigneeId] filter server-side, for the customer profile
  /// and agent profile pages respectively.
  Future<List<Project>> projects({
    int? customerId,
    int? assigneeId,
    String? status,
    String? search,
  }) async {
    final res = await api.dio.get('/projects/', queryParameters: {
      if (customerId != null) 'customer': customerId,
      if (assigneeId != null) 'assignees': assigneeId,
      if (status != null) 'status': status,
      if (search != null) 'search': search,
    });
    return _rows(res.data).map(Project.fromJson).toList();
  }

  /// Projects whose window or creation day falls inside [from]..[to].
  Future<List<Project>> projectCalendar({
    required DateTime from,
    required DateTime to,
    int? assigneeId,
  }) async {
    final res = await api.dio.get('/projects/calendar/', queryParameters: {
      'from': _dateOnly(from),
      'to': _dateOnly(to),
      if (assigneeId != null) 'assignees': assigneeId,
    });
    return _rows(res.data).map(Project.fromJson).toList();
  }

  Future<List<Task>> tasks(int projectId) async {
    final res = await api.dio.get('/tasks/', queryParameters: {
      'project': projectId,
    });
    return _rows(res.data).map(Task.fromJson).toList();
  }

  /// Moving a card between kanban columns is just a status patch.
  Future<void> setTaskStatus(int taskId, String status) {
    return api.dio.patch('/tasks/$taskId/', data: {'status': status});
  }

  Future<Task> createTask({
    required int projectId,
    required String title,
    String description = '',
    String status = TaskStatus.todo,
    String priority = 'medium',
    List<int> assigneeIds = const [],
  }) async {
    final res = await api.dio.post('/tasks/', data: {
      'project': projectId,
      'title': title,
      'description': description,
      'status': status,
      'priority': priority,
      // A task can be shared: the API takes a list, not a single id.
      'assignee_ids': assigneeIds,
    });
    return Task.fromJson(res.data as Map<String, dynamic>);
  }

  Future<void> deleteTask(int taskId) => api.dio.delete('/tasks/$taskId/');

  Future<void> setTaskAssignees(int taskId, List<int> assigneeIds) {
    return api.dio.patch('/tasks/$taskId/', data: {'assignee_ids': assigneeIds});
  }

  /// `ids` is the project's full task list in its new order.
  Future<void> reorderTasks(int projectId, List<int> ids) {
    return api.dio.post('/tasks/reorder/', data: {'project': projectId, 'ids': ids});
  }

  // --- Internal to-do list ---------------------------------------------------

  Future<List<TodoItem>> todos({bool? done}) async {
    final res = await api.dio.get('/todos/', queryParameters: {
      if (done != null) 'done': done,
    });
    return _rows(res.data).map(TodoItem.fromJson).toList();
  }

  /// Dated to-dos overlapping the calendar's visible window.
  Future<List<TodoItem>> todoCalendar({
    required DateTime from,
    required DateTime to,
  }) async {
    final res = await api.dio.get('/todos/calendar/', queryParameters: {
      'from': _dateOnly(from),
      'to': _dateOnly(to),
    });
    return _rows(res.data).map(TodoItem.fromJson).toList();
  }

  Future<TodoItem> createTodo({
    required String title,
    String notes = '',
    String priority = 'medium',
    DateTime? startAt,
    DateTime? dueAt,
    int? customerId,
    List<int> assigneeIds = const [],
  }) async {
    final res = await api.dio.post('/todos/', data: {
      'title': title,
      'notes': notes,
      'priority': priority,
      // Every extra field is optional; null clears it rather than sending ''.
      'start_at': startAt?.toUtc().toIso8601String(),
      'due_at': dueAt?.toUtc().toIso8601String(),
      'customer_id': customerId,
      'assignee_ids': assigneeIds,
    });
    return TodoItem.fromJson(res.data as Map<String, dynamic>);
  }

  Future<TodoItem> updateTodo(int id, Map<String, dynamic> patch) async {
    final res = await api.dio.patch('/todos/$id/', data: patch);
    return TodoItem.fromJson(res.data as Map<String, dynamic>);
  }

  Future<void> deleteTodo(int id) => api.dio.delete('/todos/$id/');

  Future<void> reorderTodos(List<int> ids) =>
      api.dio.post('/todos/reorder/', data: {'ids': ids});

  Future<Map<String, bool>> notificationPreferences() async {
    final res = await api.dio.get('/auth/notification-preferences/');
    final data = (res.data as Map).cast<String, dynamic>();
    return data.map((k, v) => MapEntry(k, v == true));
  }

  Future<void> setNotificationPreference(String field, bool value) {
    return api.dio.patch('/auth/notification-preferences/', data: {field: value});
  }
}
