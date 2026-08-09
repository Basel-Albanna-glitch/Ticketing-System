import '../core/config.dart';
import 'user.dart';

/// Mirrors projects.serializers.ProjectSerializer.
class Project {
  final int id;
  final String name;
  final String description;
  final String status;
  final AppUser? customer;
  final String? branchName;
  final List<AppUser> assignees;
  final AppUser? createdBy;
  final int taskCount;
  final int doneTaskCount;
  final DateTime? startDate;
  final DateTime? endDate;
  final DateTime? lastTaskDue;
  final DateTime? createdDate;
  /// Admin-only; the API omits it entirely for everyone else.
  final String? remark;
  /// Whether this viewer may change it: admins always, agents only for their own
  /// or unassigned work, and never once the project is closed.
  final bool canEdit;
  final DateTime? updatedAt;

  const Project({
    required this.id,
    required this.name,
    this.description = '',
    this.status = 'open',
    this.customer,
    this.branchName,
    this.assignees = const [],
    this.createdBy,
    this.taskCount = 0,
    this.doneTaskCount = 0,
    this.startDate,
    this.endDate,
    this.lastTaskDue,
    this.createdDate,
    this.remark,
    this.canEdit = true,
    this.updatedAt,
  });

  bool get isClosed => status == 'closed';

  /// Share of tasks finished, 0..1. A project with no tasks reads as 0, never 1.
  double get progress => taskCount == 0 ? 0 : doneTaskCount / taskCount;

  factory Project.fromJson(Map<String, dynamic> json) => Project(
        id: json['id'] as int,
        name: json['name'] as String? ?? '',
        description: json['description'] as String? ?? '',
        status: json['status'] as String? ?? 'open',
        customer: json['customer'] == null
            ? null
            : AppUser.fromJson(json['customer'] as Map<String, dynamic>),
        branchName: json['branch'] == null
            ? null
            : (json['branch'] as Map<String, dynamic>)['name'] as String?,
        assignees: (json['assignees'] as List<dynamic>? ?? [])
            .map((e) => AppUser.fromJson(e as Map<String, dynamic>))
            .toList(),
        createdBy: json['created_by'] == null
            ? null
            : AppUser.fromJson(json['created_by'] as Map<String, dynamic>),
        taskCount: json['task_count'] as int? ?? 0,
        doneTaskCount: json['done_task_count'] as int? ?? 0,
        startDate: DateTime.tryParse(json['start_date'] as String? ?? ''),
        endDate: DateTime.tryParse(json['end_date'] as String? ?? ''),
        lastTaskDue: DateTime.tryParse(json['last_task_due'] as String? ?? ''),
        createdDate: DateTime.tryParse(json['created_date'] as String? ?? ''),
        remark: json['remark'] as String?,
        canEdit: json['can_edit'] as bool? ?? true,
        updatedAt:
            DateTime.tryParse(json['updated_at'] as String? ?? '')?.toLocal(),
      );
}

/// Task.Status from projects/models.py:28 — the four kanban columns.
class TaskStatus {
  static const todo = 'todo';
  static const inProgress = 'in_progress';
  static const inReview = 'in_review';
  static const done = 'done';

  static const all = [todo, inProgress, inReview, done];

  static String label(String value) => switch (value) {
        todo => 'To Do',
        inProgress => 'In Progress',
        inReview => 'In Review',
        done => 'Done',
        _ => value,
      };
}

class Task {
  final int id;
  final int projectId;
  final String title;
  final String description;
  final String status;
  final String priority;
  final List<AppUser> assignees;
  final DateTime? startDate;
  final DateTime? dueDate;
  final int position;
  final bool canEdit;

  const Task({
    required this.id,
    required this.projectId,
    required this.title,
    this.description = '',
    this.status = TaskStatus.todo,
    this.priority = 'medium',
    this.assignees = const [],
    this.startDate,
    this.dueDate,
    this.position = 0,
    this.canEdit = true,
  });

  /// Work cannot progress before the day it is scheduled to begin, so the stage
  /// picker stays locked until then — the API refuses the change either way.
  bool get notStartedYet {
    if (startDate == null) return false;
    final now = DateTime.now();
    return startDate!.isAfter(DateTime(now.year, now.month, now.day));
  }

  /// Past its due date and not finished. A completed task stops nagging.
  bool get isOverdue {
    if (status == TaskStatus.done || dueDate == null) return false;
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    return dueDate!.isBefore(today);
  }

  factory Task.fromJson(Map<String, dynamic> json) => Task(
        id: json['id'] as int,
        projectId: json['project'] as int? ?? 0,
        title: json['title'] as String? ?? '',
        description: json['description'] as String? ?? '',
        status: json['status'] as String? ?? TaskStatus.todo,
        priority: json['priority'] as String? ?? 'medium',
        assignees: (json['assignees'] as List<dynamic>? ?? [])
            .map((e) => AppUser.fromJson(e as Map<String, dynamic>))
            .toList(),
        startDate: DateTime.tryParse(json['start_date'] as String? ?? ''),
        dueDate: DateTime.tryParse(json['due_date'] as String? ?? ''),
        position: json['position'] as int? ?? 0,
        canEdit: json['can_edit'] as bool? ?? true,
      );
}

/// Mirrors tickets.serializers.TicketSettingsSerializer — the admin permission
/// switches that govern what agents may do.
class TicketSettings {
  final Map<String, bool> values;

  const TicketSettings(this.values);

  static const fields = <String, String>{
    'allow_agent_self_assign': 'Agents can claim tickets',
    'allow_agent_reassign': 'Agents can reassign to others',
    'allow_agent_edit_after_close': 'Agents can edit closed tickets',
    'allow_agent_create_customers': 'Agents can add customers',
    'allow_agent_edit_customers': 'Agents can edit customers',
    'allow_agent_delete': 'Assigned agent can delete tickets',
    'allow_agent_link_customer': 'Agents can link guest tickets to customers',
    'allow_agent_manage_kb': 'Agents can manage knowledge base',
    'allow_agent_assign_projects': 'Agents can assign projects and tasks',
    'allow_agent_unassign_projects': 'Agents can remove themselves from a project',
    'allow_agent_assign_tasks': 'Agents can assign tasks to themselves and others',
  };

  bool operator [](String key) => values[key] ?? false;

  factory TicketSettings.fromJson(Map<String, dynamic> json) => TicketSettings(
        {for (final k in fields.keys) k: json[k] == true},
      );
}

/// Mirrors accounts.serializers.AgentSerializer.
class Agent {
  final int id;
  final String username;
  final String fullName;
  final String email;
  final bool isAvailable;
  final bool isActive;
  final int assignedCount;
  final int resolvedCount;
  final String? avatarUrl;

  const Agent({
    required this.id,
    required this.username,
    required this.fullName,
    this.email = '',
    this.isAvailable = false,
    this.isActive = true,
    this.assignedCount = 0,
    this.resolvedCount = 0,
    this.avatarUrl,
  });

  String get initials {
    final parts =
        fullName.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty);
    if (parts.isEmpty) return username.isEmpty ? '?' : username[0].toUpperCase();
    return parts.take(2).map((p) => p[0].toUpperCase()).join();
  }

  factory Agent.fromJson(Map<String, dynamic> json) => Agent(
        id: json['id'] as int,
        username: json['username'] as String? ?? '',
        fullName: json['full_name'] as String? ?? '',
        email: json['email'] as String? ?? '',
        isAvailable: json['is_available'] as bool? ?? false,
        isActive: json['is_active'] as bool? ?? true,
        assignedCount: json['assigned_count'] as int? ?? 0,
        resolvedCount: json['resolved_count'] as int? ?? 0,
        avatarUrl: ApiConfig.mediaUrl(json['avatar'] as String?),
      );
}

/// Mirrors projects.serializers.TodoItemSerializer — the shared internal to-do
/// list, unrelated to projects or customers.
class TodoItem {
  final int id;
  final String title;
  final String notes;
  final bool done;
  final String priority;
  final DateTime? startAt;
  final DateTime? dueAt;
  /// Derived server-side from the window; null unless both ends are set.
  final int? durationMinutes;
  final AppUser? customer;
  final List<AppUser> assignees;
  final int position;

  const TodoItem({
    required this.id,
    required this.title,
    this.notes = '',
    this.done = false,
    this.priority = 'medium',
    this.startAt,
    this.dueAt,
    this.durationMinutes,
    this.customer,
    this.assignees = const [],
    this.position = 0,
  });

  bool get isOverdue => !done && dueAt != null && dueAt!.isBefore(DateTime.now());

  /// 330 -> "5h 30m", 2160 -> "1d 12h", 45 -> "45m".
  String? get durationLabel {
    final total = durationMinutes;
    if (total == null) return null;
    final minutes = total < 0 ? 0 : total;
    final days = minutes ~/ 1440;
    final hours = (minutes % 1440) ~/ 60;
    final mins = minutes % 60;
    final parts = <String>[];
    if (days > 0) parts.add('${days}d');
    if (hours > 0) parts.add('${hours}h');
    if (mins > 0 || parts.isEmpty) parts.add('${mins}m');
    return parts.join(' ');
  }

  factory TodoItem.fromJson(Map<String, dynamic> json) => TodoItem(
        id: json['id'] as int,
        title: json['title'] as String? ?? '',
        notes: json['notes'] as String? ?? '',
        done: json['done'] as bool? ?? false,
        priority: json['priority'] as String? ?? 'medium',
        startAt: DateTime.tryParse(json['start_at'] as String? ?? '')?.toLocal(),
        dueAt: DateTime.tryParse(json['due_at'] as String? ?? '')?.toLocal(),
        durationMinutes: json['duration_minutes'] as int?,
        customer: json['customer'] == null
            ? null
            : AppUser.fromJson(json['customer'] as Map<String, dynamic>),
        assignees: (json['assignees'] as List<dynamic>? ?? [])
            .map((e) => AppUser.fromJson(e as Map<String, dynamic>))
            .toList(),
        position: json['position'] as int? ?? 0,
      );
}
