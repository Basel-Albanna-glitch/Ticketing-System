import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/api_client.dart';
import '../i18n/i18n.dart';
import '../i18n/labels.dart';
import '../models/project.dart';
import '../state/providers.dart';
import 'forms/content_form_pages.dart';
import 'theme.dart';
import 'widgets/chips.dart';

final projectTasksProvider =
    FutureProvider.family<List<Task>, int>((ref, projectId) {
  return ref.watch(miscRepositoryProvider).tasks(projectId);
});

/// The project as the server currently sees it, so claim/close results show
/// without going back to the list.
final projectDetailProvider =
    FutureProvider.family<Project, int>((ref, projectId) async {
  final all = await ref.watch(miscRepositoryProvider).projects();
  return all.firstWhere((p) => p.id == projectId);
});

/// The standard steps a project runs through, mirroring the web palette. Tapping
/// one creates a real task with that title.
const _defaultTasks = [
  'Kick of meeting',
  'Collect Data sheet',
  'Configration',
  'Create Server',
  'Training',
  'Rest Data',
  'Implentation',
];

/// A project's tasks as one ordered list.
///
/// The four kanban columns are gone, matching the web app: order is manual and
/// persisted (Task.position), and a task's stage is changed through a stepper
/// rather than by moving it between columns. On touch, dragging within a single
/// vertical list is far more reliable than dragging across scrolling columns.
class ProjectBoardPage extends ConsumerWidget {
  final Project project;
  const ProjectBoardPage({super.key, required this.project});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(projectTasksProvider(project.id));
    final theme = Theme.of(context);

    final user = ref.watch(authProvider).user;
    // Prefer the freshly fetched project; fall back to the one we were given.
    final current = ref.watch(projectDetailProvider(project.id)).valueOrNull ?? project;
    final canEdit = current.canEdit;
    final isMine = current.assignees.any((a) => a.id == user?.id);

    return Scaffold(
      appBar: AppBar(
        title: Text(current.name),
        actions: [
          // Status is part of the project's identity, so it rides in the bar.
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 4),
            child: Chip(
              visualDensity: VisualDensity.compact,
              label: Text(context.t(current.isClosed
                  ? 'projects.statusClosed'
                  : 'projects.statusOpen')),
            ),
          ),
          if (canEdit)
            PopupMenuButton<String>(
              onSelected: (value) async {
                switch (value) {
                  case 'claim':
                    await ref.read(miscRepositoryProvider).claimProject(current.id);
                    ref.invalidate(projectDetailProvider(current.id));
                    break;
                  case 'status':
                    if (context.mounted) await _toggleStatus(context, ref, current);
                    break;
                  case 'edit':
                    final saved = await Navigator.of(context).push<bool>(
                      MaterialPageRoute(
                        builder: (_) => ProjectFormPage(project: current),
                      ),
                    );
                    if (saved == true) ref.invalidate(projectDetailProvider(current.id));
                    break;
                  case 'delete':
                    if (context.mounted) await _confirmDelete(context, ref);
                    break;
                }
              },
              itemBuilder: (menuContext) => [
                PopupMenuItem(
                  value: 'claim',
                  child: Text(menuContext.t(
                      isMine ? 'projects.unassignMe' : 'projects.assignToMe')),
                ),
                PopupMenuItem(
                  value: 'status',
                  child: Text(menuContext.t(current.isClosed
                      ? 'projects.reopenProject'
                      : 'projects.closeProject')),
                ),
                PopupMenuItem(
                    value: 'edit', child: Text(menuContext.t('projects.edit'))),
                PopupMenuItem(
                  value: 'delete',
                  child: Text(menuContext.t('projects.deleteProject')),
                ),
              ],
            ),
        ],
      ),
      floatingActionButton: !canEdit
          ? null
          : FloatingActionButton.extended(
        onPressed: () async {
          final created = await Navigator.of(context).push<bool>(
            MaterialPageRoute(
              builder: (_) => TaskFormPage(projectId: project.id),
            ),
          );
          if (created == true) ref.invalidate(projectTasksProvider(project.id));
        },
        icon: const Icon(Icons.add),
        label: Text(context.t('projects.newTask')),
      ),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => ErrorView(
          message: describeError(e),
          onRetry: () => ref.invalidate(projectTasksProvider(project.id)),
        ),
        data: (tasks) {
          final done = tasks.where((t) => t.status == TaskStatus.done).length;
          final overdue = tasks.where((t) => t.isOverdue).length;

          return Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(999),
                      child: LinearProgressIndicator(
                        value: tasks.isEmpty ? 0 : done / tasks.length,
                        minHeight: 6,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        Text(
                          '$done/${tasks.length} ${context.t('projects.tasksDone')}',
                          style: theme.textTheme.labelSmall
                              ?.copyWith(color: theme.colorScheme.outline),
                        ),
                        const Spacer(),
                        if (overdue > 0)
                          Text(
                            '$overdue ${context.t('projects.overdue')}',
                            style: theme.textTheme.labelSmall?.copyWith(
                                color: theme.colorScheme.error,
                                fontWeight: FontWeight.w600),
                          ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    // The four counts the web page shows as stat tiles.
                    Row(
                      children: [
                        _Stat(
                            label: context.t('projects.statTotal'),
                            value: '${tasks.length}'),
                        _Stat(
                            label: context.t('projects.statDone'),
                            value: '$done'),
                        _Stat(
                            label: context.t('projects.statRemaining'),
                            value: '${tasks.length - done}'),
                        _Stat(
                          label: context.t('projects.overdue'),
                          value: '$overdue',
                          danger: overdue > 0,
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    _Details(project: project),
                    if ((user?.isAdmin ?? false) &&
                        project.remark != null &&
                        project.remark!.isNotEmpty) ...[
                      const SizedBox(height: 12),
                      // Only ever present for admins: the API withholds the
                      // field entirely from everyone else.
                      _RemarkPanel(remark: project.remark!),
                    ],
                    const SizedBox(height: 12),
                    Text(context.t('projects.defaultTasks'),
                        style: theme.textTheme.labelSmall?.copyWith(
                            color: theme.colorScheme.outline,
                            fontWeight: FontWeight.w600)),
                    const SizedBox(height: 4),
                    if (canEdit)
                    Wrap(
                      spacing: 6,
                      runSpacing: 4,
                      children: [
                        for (final title in _defaultTasks)
                          _TemplateChip(
                            title: title,
                            // Titles already on the board are struck through, so
                            // the palette stays a checklist of standard steps.
                            used: tasks.any((t) =>
                                t.title.toLowerCase() == title.toLowerCase()),
                            onAdd: () async {
                              await ref
                                  .read(miscRepositoryProvider)
                                  .createTask(
                                      projectId: project.id, title: title);
                              ref.invalidate(projectTasksProvider(project.id));
                            },
                          ),
                      ],
                    ),
                  ],
                ),
              ),
              const Divider(height: 20),
              Expanded(
                child: tasks.isEmpty
                    ? ListView(children: [
                        EmptyState(
                          icon: Icons.checklist_outlined,
                          title: context.t('projects.noTasks'),
                        ),
                      ])
                    : ReorderableListView.builder(
                        buildDefaultDragHandles: canEdit,
                        padding: const EdgeInsets.fromLTRB(12, 0, 12, 88),
                        itemCount: tasks.length,
                        // onReorderItem already accounts for the removed
                        // row, so no index fix-up is needed.
                        onReorderItem: (oldIndex, newIndex) async {
                          final ids = tasks.map((t) => t.id).toList();
                          final moved = ids.removeAt(oldIndex);
                          ids.insert(newIndex, moved);
                          await ref
                              .read(miscRepositoryProvider)
                              .reorderTasks(project.id, ids);
                          ref.invalidate(projectTasksProvider(project.id));
                        },
                        itemBuilder: (context, i) {
                          final task = tasks[i];
                          return Padding(
                            key: ValueKey(task.id),
                            padding: const EdgeInsets.only(bottom: 8),
                            child: _TaskTile(
                              task: task,
                              canEdit: canEdit,
                              onChanged: () => ref
                                  .invalidate(projectTasksProvider(project.id)),
                            ),
                          );
                        },
                      ),
              ),
            ],
          );
        },
      ),
    );
  }
}

extension on ProjectBoardPage {
  /// Closing claims the work is finished, so the API refuses it while tasks are
  /// open. Check first and name the offenders rather than showing a bare error.
  Future<void> _toggleStatus(
      BuildContext context, WidgetRef ref, Project current) async {
    final tasks = ref.read(projectTasksProvider(current.id)).valueOrNull ?? [];
    final open = tasks.where((t) => t.status != TaskStatus.done).toList();
    if (!current.isClosed && open.isNotEmpty) {
      await showDialog<void>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          title: Text(dialogContext.t('projects.closeProject')),
          content: Text(
            '${dialogContext.t('projects.cannotCloseOpenTasks')}\n\n'
            '${open.take(5).map((t) => '\u2022 ${t.title}').join('\n')}'
            '${open.length > 5 ? '\n\u2022 +${open.length - 5}' : ''}',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext),
              child: Text(dialogContext.t('common.ok')),
            ),
          ],
        ),
      );
      return;
    }

    final ok = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(dialogContext.t(current.isClosed
            ? 'projects.reopenProject'
            : 'projects.closeProject')),
        content: Text('${dialogContext.t(current.isClosed ? 'projects.reopenConfirm' : 'projects.closeConfirm')}\n\n"${current.name}"'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: Text(dialogContext.t('common.cancel')),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: Text(dialogContext.t('common.ok')),
          ),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await ref.read(miscRepositoryProvider).updateProject(
        current.id,
        {'status': current.isClosed ? 'open' : 'closed'},
      );
      ref.invalidate(projectDetailProvider(current.id));
    } catch (e) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(describeError(e))),
      );
    }
  }

  Future<void> _confirmDelete(BuildContext context, WidgetRef ref) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(dialogContext.t('projects.deleteProject')),
        content: Text('${dialogContext.t('projects.deleteProjectConfirm')} '
            '"${project.name}"?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: Text(dialogContext.t('common.cancel')),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: Text(dialogContext.t('common.delete')),
          ),
        ],
      ),
    );
    if (ok != true || !context.mounted) return;
    await ref.read(miscRepositoryProvider).deleteProject(project.id);
    if (context.mounted) Navigator.of(context).pop();
  }
}

/// One count in the header row, mirroring a web stat tile.
class _Stat extends StatelessWidget {
  const _Stat({required this.label, required this.value, this.danger = false});

  final String label;
  final String value;
  final bool danger;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Expanded(
      child: Column(
        children: [
          Text(value,
              style: theme.textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w700,
                  color: danger ? theme.colorScheme.error : null)),
          Text(label,
              textAlign: TextAlign.center,
              style: theme.textTheme.labelSmall
                  ?.copyWith(color: theme.colorScheme.outline)),
        ],
      ),
    );
  }
}

/// Customer, branch, assignees and dates \u2014 the web page's Details card.
class _Details extends StatelessWidget {
  const _Details({required this.project});

  final Project project;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    String date(DateTime? d) =>
        d == null ? '\u2014' : '${d.day}/${d.month}/${d.year}';

    final rows = <(IconData, String, String)>[
      (
        Icons.person_outline,
        context.t('tickets.customer'),
        project.customer == null
            ? context.t('projects.noCustomer')
            : project.branchName == null
                ? project.customer!.fullName
                : '${project.customer!.fullName} \u00b7 ${project.branchName}',
      ),
      (
        Icons.people_outline,
        context.t('projects.assignees'),
        project.assignees.isEmpty
            ? context.t('projects.unassigned')
            : project.assignees.map((a) => a.fullName).join(', '),
      ),
      (
        Icons.event_outlined,
        context.t('projects.window'),
        project.startDate == null && project.endDate == null
            ? '\u2014'
            : '${date(project.startDate)} \u2192 ${date(project.endDate)}',
      ),
      (
        Icons.schedule_outlined,
        context.t('projects.lastTaskDue'),
        date(project.lastTaskDue),
      ),
    ];

    return Column(
      children: [
        for (final (icon, label, value) in rows)
          Padding(
            padding: const EdgeInsets.only(bottom: 6),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(icon, size: 16, color: theme.colorScheme.outline),
                const SizedBox(width: 8),
                Text('$label: ',
                    style: theme.textTheme.labelSmall
                        ?.copyWith(color: theme.colorScheme.outline)),
                Expanded(
                  child: Text(value, style: theme.textTheme.labelSmall),
                ),
              ],
            ),
          ),
      ],
    );
  }
}

/// The admin-only note, styled apart from the rest so it reads as private.
class _RemarkPanel extends StatelessWidget {
  const _RemarkPanel({required this.remark});

  final String remark;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: Colors.amber.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: Colors.amber.withValues(alpha: 0.35)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '${context.t('projects.remark')} \u00b7 ${context.t('projects.remarkAdminOnly')}',
            style: theme.textTheme.labelSmall?.copyWith(
                fontWeight: FontWeight.w700, color: Colors.amber.shade800),
          ),
          const SizedBox(height: 4),
          Text(remark, style: theme.textTheme.bodySmall),
        ],
      ),
    );
  }
}

class _TemplateChip extends StatelessWidget {
  const _TemplateChip(
      {required this.title, required this.used, required this.onAdd});

  final String title;
  final bool used;
  final VoidCallback onAdd;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    if (used) {
      return Chip(
        label: Text(title,
            style: theme.textTheme.labelSmall?.copyWith(
                color: theme.colorScheme.outline,
                decoration: TextDecoration.lineThrough)),
        visualDensity: VisualDensity.compact,
      );
    }
    return ActionChip(
      avatar: const Icon(Icons.add, size: 14),
      label: Text(title, style: theme.textTheme.labelSmall),
      visualDensity: VisualDensity.compact,
      onPressed: onAdd,
    );
  }
}

class _TaskTile extends ConsumerWidget {
  const _TaskTile({
    required this.task,
    required this.onChanged,
    this.canEdit = true,
  });

  final Task task;
  final VoidCallback onChanged;
  final bool canEdit;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final overdue = task.isOverdue;

    return AppCard(
      onTap: canEdit ? () => _showStageSheet(context, ref) : null,
      child: Container(
        decoration: BoxDecoration(
          color: overdue
              ? theme.colorScheme.error.withValues(alpha: 0.06)
              : Colors.transparent,
          borderRadius: BorderRadius.circular(12),
        ),
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    task.title,
                    style: theme.textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w600,
                      decoration: task.status == TaskStatus.done
                          ? TextDecoration.lineThrough
                          : null,
                    ),
                  ),
                ),
                if (overdue)
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: theme.colorScheme.error.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(context.t('projects.overdue'),
                        style: theme.textTheme.labelSmall?.copyWith(
                            color: theme.colorScheme.error,
                            fontWeight: FontWeight.w600)),
                  ),
              ],
            ),
            if (task.description.isNotEmpty) ...[
              const SizedBox(height: 4),
              Text(task.description,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.bodySmall
                      ?.copyWith(color: theme.colorScheme.outline)),
            ],
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 4,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                // Without columns, each row carries its own stage marker.
                _StageDot(status: task.status),
                PriorityChip(task.priority),
                if (task.dueDate != null)
                  Text(
                    '${task.dueDate!.day}/${task.dueDate!.month}',
                    style: theme.textTheme.labelSmall?.copyWith(
                      color: overdue
                          ? theme.colorScheme.error
                          : theme.colorScheme.outline,
                      fontWeight: overdue ? FontWeight.w600 : null,
                    ),
                  ),
                if (task.assignees.isNotEmpty)
                  Text(task.assignees.map((a) => a.fullName).join(', '),
                      style: theme.textTheme.labelSmall
                          ?.copyWith(color: theme.colorScheme.outline)),
              ],
            ),
          ],
        ),
      ),
    );
  }

  /// Deleting a task is irreversible and the row is small, so it asks first.
  Future<void> _confirmDeleteTask(BuildContext context, WidgetRef ref) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(dialogContext.t('projects.deleteTask')),
        content: Text('${dialogContext.t('projects.deleteTaskConfirm')} '
            '"${task.title}"?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: Text(dialogContext.t('common.cancel')),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: Text(dialogContext.t('common.delete')),
          ),
        ],
      ),
    );
    if (ok != true) return;
    await ref.read(miscRepositoryProvider).deleteTask(task.id);
    onChanged();
  }

  /// The stepper: every stage is tappable, not just the next one — work slips
  /// backwards as often as it moves forward.
  void _showStageSheet(BuildContext context, WidgetRef ref) {
    showModalBottomSheet(
      context: context,
      showDragHandle: true,
      builder: (sheetContext) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
              child: Text(task.title,
                  style: Theme.of(sheetContext)
                      .textTheme
                      .titleMedium
                      ?.copyWith(fontWeight: FontWeight.w700)),
            ),
            if (task.notStartedYet)
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                child: Text(
                  '${sheetContext.t('projects.startsLater')} '
                  '${task.startDate!.day}/${task.startDate!.month}/${task.startDate!.year}',
                  style: TextStyle(
                      color: Theme.of(sheetContext).colorScheme.error),
                ),
              ),
            for (final status in TaskStatus.all)
              ListTile(
                // Work cannot progress before the day it is scheduled to begin.
                enabled: !task.notStartedYet,
                leading: Icon(
                  status == task.status
                      ? Icons.radio_button_checked
                      : Icons.radio_button_unchecked,
                  color: status == task.status
                      ? Theme.of(sheetContext).colorScheme.primary
                      : null,
                ),
                title: Text(taskStatusLabel(sheetContext, status)),
                onTap: () async {
                  Navigator.pop(sheetContext);
                  if (status == task.status) return;
                  await ref
                      .read(miscRepositoryProvider)
                      .setTaskStatus(task.id, status);
                  onChanged();
                },
              ),
            const Divider(height: 12),
            // Acting on a task happens here, so removing it does too.
            ListTile(
              leading: Icon(Icons.delete_outline,
                  color: Theme.of(sheetContext).colorScheme.error),
              title: Text(
                sheetContext.t('projects.deleteTask'),
                style:
                    TextStyle(color: Theme.of(sheetContext).colorScheme.error),
              ),
              onTap: () async {
                Navigator.pop(sheetContext);
                await _confirmDeleteTask(context, ref);
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _StageDot extends StatelessWidget {
  const _StageDot({required this.status});

  final String status;

  static const _colors = {
    TaskStatus.todo: Colors.grey,
    TaskStatus.inProgress: Colors.blue,
    TaskStatus.inReview: Colors.amber,
    TaskStatus.done: Colors.green,
  };

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 8,
          height: 8,
          decoration: BoxDecoration(
            color: _colors[status] ?? Colors.grey,
            shape: BoxShape.circle,
          ),
        ),
        const SizedBox(width: 4),
        Text(taskStatusLabel(context, status),
            style: theme.textTheme.labelSmall
                ?.copyWith(color: theme.colorScheme.outline)),
      ],
    );
  }
}
