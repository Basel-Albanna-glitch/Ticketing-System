import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/api_client.dart';
import '../i18n/i18n.dart';
import '../models/project.dart';
import '../state/providers.dart';
import 'app_shell.dart';
import 'theme.dart';
import 'widgets/chips.dart';

/// Which slice of the shared list is on screen. `null` means everything.
final todoFilterProvider = StateProvider<bool?>((ref) => false);

final todosProvider = FutureProvider<List<TodoItem>>((ref) {
  final done = ref.watch(todoFilterProvider);
  return ref.watch(miscRepositoryProvider).todos(done: done);
});

/// The internal to-do list: one shared list for staff, mirroring the web /todo page.
class TodoPage extends ConsumerWidget {
  const TodoPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(todosProvider);
    final filter = ref.watch(todoFilterProvider);

    return ShellScaffold(
      title: context.t('todo.title'),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _openForm(context, ref),
        icon: const Icon(Icons.add),
        label: Text(context.t('todo.new')),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
            child: SegmentedButton<bool?>(
              segments: [
                ButtonSegment(value: false, label: Text(context.t('todo.filterOpen'))),
                ButtonSegment(value: true, label: Text(context.t('todo.filterDone'))),
                ButtonSegment(value: null, label: Text(context.t('common.all'))),
              ],
              selected: {filter},
              onSelectionChanged: (values) =>
                  ref.read(todoFilterProvider.notifier).state = values.first,
            ),
          ),
          Expanded(
            child: async.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) => ErrorView(
                message: describeError(e),
                onRetry: () => ref.invalidate(todosProvider),
              ),
              data: (items) => RefreshIndicator(
                onRefresh: () async => ref.invalidate(todosProvider),
                child: items.isEmpty
                    ? ListView(children: [
                        EmptyState(
                          icon: Icons.check_circle_outline,
                          title: context.t('todo.empty'),
                        ),
                      ])
                    : ListView.separated(
                        padding: const EdgeInsets.all(16),
                        itemCount: items.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 8),
                        itemBuilder: (context, i) =>
                            _TodoTile(item: items[i], onChanged: () => ref.invalidate(todosProvider)),
                      ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _openForm(BuildContext context, WidgetRef ref, {TodoItem? item}) async {
    final saved = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => TodoFormPage(item: item)),
    );
    if (saved == true) ref.invalidate(todosProvider);
  }
}

class _TodoTile extends ConsumerWidget {
  const _TodoTile({required this.item, required this.onChanged});

  final TodoItem item;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final overdue = item.isOverdue;

    return AppCard(
      onTap: () async {
        final saved = await Navigator.of(context).push<bool>(
          MaterialPageRoute(builder: (_) => TodoFormPage(item: item)),
        );
        if (saved == true) onChanged();
      },
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Checkbox(
              value: item.done,
              onChanged: (value) async {
                await ref
                    .read(miscRepositoryProvider)
                    .updateTodo(item.id, {'done': value ?? false});
                onChanged();
              },
            ),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    item.title,
                    style: theme.textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w600,
                      decoration: item.done ? TextDecoration.lineThrough : null,
                      color: item.done ? theme.colorScheme.outline : null,
                    ),
                  ),
                  if (item.notes.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Text(item.notes,
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
                      PriorityChip(item.priority),
                      if (item.dueAt != null)
                        Text(
                          _windowLabel(context, item),
                          style: theme.textTheme.labelSmall?.copyWith(
                            color: overdue
                                ? theme.colorScheme.error
                                : theme.colorScheme.outline,
                            fontWeight: overdue ? FontWeight.w600 : null,
                          ),
                        ),
                      if (item.durationLabel != null)
                        Text(item.durationLabel!,
                            style: theme.textTheme.labelSmall
                                ?.copyWith(color: theme.colorScheme.outline)),
                      if (item.customer != null)
                        Text(item.customer!.fullName,
                            style: theme.textTheme.labelSmall
                                ?.copyWith(color: theme.colorScheme.primary)),
                      if (item.assignees.isNotEmpty)
                        Text(item.assignees.map((a) => a.fullName).join(', '),
                            style: theme.textTheme.labelSmall
                                ?.copyWith(color: theme.colorScheme.outline)),
                    ],
                  ),
                ],
              ),
            ),
            IconButton(
              tooltip: context.t('common.delete'),
              icon: const Icon(Icons.delete_outline),
              onPressed: () async {
                await ref.read(miscRepositoryProvider).deleteTodo(item.id);
                onChanged();
              },
            ),
          ],
        ),
      ),
    );
  }

  String _windowLabel(BuildContext context, TodoItem item) {
    String stamp(DateTime d) =>
        '${d.day}/${d.month} ${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';
    if (item.startAt != null) return '${stamp(item.startAt!)} → ${stamp(item.dueAt!)}';
    return stamp(item.dueAt!);
  }
}

/// Create or edit one to-do. Everything but the title is optional.
class TodoFormPage extends ConsumerStatefulWidget {
  const TodoFormPage({super.key, this.item});

  final TodoItem? item;

  @override
  ConsumerState<TodoFormPage> createState() => _TodoFormPageState();
}

class _TodoFormPageState extends ConsumerState<TodoFormPage> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _title =
      TextEditingController(text: widget.item?.title ?? '');
  late final TextEditingController _notes =
      TextEditingController(text: widget.item?.notes ?? '');
  late String _priority = widget.item?.priority ?? 'medium';
  late DateTime? _startAt = widget.item?.startAt;
  late DateTime? _dueAt = widget.item?.dueAt;
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _title.dispose();
    _notes.dispose();
    super.dispose();
  }

  /// Minutes between the two ends, or null while the window is incomplete.
  int? get _durationMinutes {
    if (_startAt == null || _dueAt == null) return null;
    return _dueAt!.difference(_startAt!).inMinutes;
  }

  String get _durationLabel {
    final minutes = _durationMinutes;
    if (minutes == null) return '—';
    final safe = minutes < 0 ? 0 : minutes;
    final days = safe ~/ 1440;
    final hours = (safe % 1440) ~/ 60;
    final mins = safe % 60;
    final parts = <String>[];
    if (days > 0) parts.add('${days}d');
    if (hours > 0) parts.add('${hours}h');
    if (mins > 0 || parts.isEmpty) parts.add('${mins}m');
    return parts.join(' ');
  }

  Future<void> _pick(bool isStart) async {
    final initial = (isStart ? _startAt : _dueAt) ?? DateTime.now();
    final date = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(2020),
      lastDate: DateTime(2100),
    );
    if (date == null || !mounted) return;
    final time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(initial),
    );
    if (time == null) return;
    final picked = DateTime(date.year, date.month, date.day, time.hour, time.minute);
    setState(() {
      if (isStart) {
        _startAt = picked;
      } else {
        _dueAt = picked;
      }
    });
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    if (_startAt != null && _dueAt != null && _startAt!.isAfter(_dueAt!)) {
      setState(() => _error = context.t('todo.startAfterDue'));
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final repo = ref.read(miscRepositoryProvider);
      if (widget.item == null) {
        await repo.createTodo(
          title: _title.text.trim(),
          notes: _notes.text.trim(),
          priority: _priority,
          startAt: _startAt,
          dueAt: _dueAt,
        );
      } else {
        await repo.updateTodo(widget.item!.id, {
          'title': _title.text.trim(),
          'notes': _notes.text.trim(),
          'priority': _priority,
          'start_at': _startAt?.toUtc().toIso8601String(),
          'due_at': _dueAt?.toUtc().toIso8601String(),
        });
      }
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      setState(() => _error = describeError(e));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final editing = widget.item != null;
    String stamp(DateTime? d) => d == null
        ? '—'
        : '${d.day}/${d.month}/${d.year} ${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';

    return Scaffold(
      appBar: AppBar(title: Text(context.t(editing ? 'todo.edit' : 'todo.new'))),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            TextFormField(
              controller: _title,
              decoration: InputDecoration(labelText: context.t('projects.taskTitle')),
              validator: (v) =>
                  (v == null || v.trim().isEmpty) ? context.t('todo.titleRequired') : null,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _notes,
              maxLines: 3,
              decoration: InputDecoration(labelText: context.t('todo.notes')),
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              initialValue: _priority,
              decoration: InputDecoration(labelText: context.t('tickets.priority')),
              items: const ['low', 'medium', 'high', 'urgent']
                  .map((p) => DropdownMenuItem(value: p, child: Text(p)))
                  .toList(),
              onChanged: (v) => setState(() => _priority = v ?? 'medium'),
            ),
            const SizedBox(height: 12),
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.play_arrow_outlined),
              title: Text(context.t('todo.from')),
              subtitle: Text(stamp(_startAt)),
              trailing: _startAt == null
                  ? null
                  : IconButton(
                      icon: const Icon(Icons.clear),
                      onPressed: () => setState(() => _startAt = null),
                    ),
              onTap: () => _pick(true),
            ),
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.flag_outlined),
              title: Text(context.t('todo.to')),
              subtitle: Text(stamp(_dueAt)),
              trailing: _dueAt == null
                  ? null
                  : IconButton(
                      icon: const Icon(Icons.clear),
                      onPressed: () => setState(() => _dueAt = null),
                    ),
              onTap: () => _pick(false),
            ),
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.timelapse_outlined),
              title: Text(context.t('todo.duration')),
              // Derived from the pair, never typed, so the two cannot disagree.
              subtitle: Text(_durationLabel),
            ),
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
            ],
            const SizedBox(height: 20),
            FilledButton(
              onPressed: _saving ? null : _save,
              child: Text(context.t(editing ? 'common.save' : 'todo.add')),
            ),
          ],
        ),
      ),
    );
  }
}
