import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../core/api_client.dart';
import '../i18n/i18n.dart';
import '../i18n/labels.dart';
import '../models/calendar_ticket.dart';
import '../models/project.dart';
import '../state/providers.dart';
import 'app_shell.dart';
import 'theme.dart';
import 'agents_page.dart';
import 'project_board_page.dart';
import 'ticket_detail_page.dart';
import 'widgets/chips.dart';

/// The month currently on screen, normalised to the first of the month.
final calendarMonthProvider = StateProvider<DateTime>((ref) {
  final now = DateTime.now();
  return DateTime(now.year, now.month);
});

/// Grid bounds for a month: the visible window starts on the Sunday on or
/// before the 1st and always spans six weeks, so the grid height never jumps
/// between months.
({DateTime start, DateTime end}) gridWindow(DateTime month) {
  final firstOfMonth = DateTime(month.year, month.month);
  // DateTime.weekday is 1=Mon…7=Sun; shift so Sunday is column 0.
  final leading = firstOfMonth.weekday % 7;
  final start = firstOfMonth.subtract(Duration(days: leading));
  return (start: start, end: start.add(const Duration(days: 41)));
}

/// Which kinds of entry are on the calendar: 'all', 'tickets' or 'projects'.
final calendarShowProvider = StateProvider<String>((ref) => 'all');

/// Filter both kinds by one person, or null for everyone.
final calendarAssigneeProvider = StateProvider<int?>((ref) => null);

/// Quick ranges. 'month' keeps the grid; the others narrow to a span and switch
/// to a list, because a 7-column grid showing one day is mostly empty squares.
final calendarRangeProvider = StateProvider<String>((ref) => 'month');

/// The inclusive day span a range covers, anchored on [month] for 'month'.
({DateTime start, DateTime end}) rangeWindow(String range, DateTime month) {
  final now = DateTime.now();
  final today = DateTime(now.year, now.month, now.day);
  switch (range) {
    case 'today':
      return (start: today, end: today);
    case 'yesterday':
      final day = today.subtract(const Duration(days: 1));
      return (start: day, end: day);
    case 'week':
      final from = today.subtract(Duration(days: today.weekday % 7));
      return (start: from, end: from.add(const Duration(days: 6)));
    default:
      return gridWindow(month);
  }
}

final projectCalendarProvider =
    FutureProvider.family<List<Project>, DateTime>((ref, month) {
  final range = ref.watch(calendarRangeProvider);
  final assignee = ref.watch(calendarAssigneeProvider);
  if (ref.watch(calendarShowProvider) != 'all' &&
      ref.watch(calendarShowProvider) != 'projects') {
    return Future.value(const []);
  }
  final window = rangeWindow(range, month);
  return ref.watch(miscRepositoryProvider).projectCalendar(
        from: window.start,
        to: window.end,
        assigneeId: assignee,
      );
});

final todoCalendarProvider =
    FutureProvider.family<List<TodoItem>, DateTime>((ref, month) {
  final range = ref.watch(calendarRangeProvider);
  // 'todos' narrows to them; 'all' includes them; the other values exclude them.
  final show = ref.watch(calendarShowProvider);
  if (show != 'all' && show != 'todos') return Future.value(const []);
  final window = rangeWindow(range, month);
  return ref
      .watch(miscRepositoryProvider)
      .todoCalendar(from: window.start, to: window.end);
});

final calendarProvider =
    FutureProvider.family<List<CalendarTicket>, DateTime>((ref, month) {
  final range = ref.watch(calendarRangeProvider);
  final assignee = ref.watch(calendarAssigneeProvider);
  if (ref.watch(calendarShowProvider) != 'all' &&
      ref.watch(calendarShowProvider) != 'tickets') {
    return Future.value(const []);
  }
  final window = rangeWindow(range, month);
  return ref.watch(ticketRepositoryProvider).calendar(
        from: window.start,
        to: window.end,
        assignedAgent: assignee,
      );
});

class CalendarPage extends ConsumerWidget {
  const CalendarPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final month = ref.watch(calendarMonthProvider);
    final async = ref.watch(calendarProvider(month));
    final projectsAsync = ref.watch(projectCalendarProvider(month));
    final todosAsync = ref.watch(todoCalendarProvider(month));
    final range = ref.watch(calendarRangeProvider);
    final isMonth = range == 'month';

    return ShellScaffold(
      title: context.t('calendar.title'),
      actions: [
        IconButton(
          icon: const Icon(Icons.today),
          tooltip: context.t('calendar.today'),
          onPressed: () {
            final now = DateTime.now();
            ref.read(calendarMonthProvider.notifier).state =
                DateTime(now.year, now.month);
          },
        ),
      ],
      body: Column(
        children: [
          const _CalendarFilters(),
          if (isMonth)
            _MonthBar(
              month: month,
              onPrevious: () => ref.read(calendarMonthProvider.notifier).state =
                  DateTime(month.year, month.month - 1),
              onNext: () => ref.read(calendarMonthProvider.notifier).state =
                  DateTime(month.year, month.month + 1),
            ),
          Expanded(
            child: async.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) => ErrorView(
                message: describeError(e),
                onRetry: () => ref.invalidate(calendarProvider(month)),
              ),
              data: (tickets) {
                final projects = projectsAsync.valueOrNull ?? const <Project>[];
                final todos = todosAsync.valueOrNull ?? const <TodoItem>[];
                if (isMonth) {
                  return _MonthGrid(
                      month: month,
                      tickets: tickets,
                      projects: projects,
                      todos: todos);
                }
                // Short ranges read better as a day-by-day list.
                final window = rangeWindow(range, month);
                return _RangeList(
                    window: window,
                    tickets: tickets,
                    projects: projects,
                    todos: todos);
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _MonthBar extends StatelessWidget {
  final DateTime month;
  final VoidCallback onPrevious;
  final VoidCallback onNext;

  const _MonthBar({
    required this.month,
    required this.onPrevious,
    required this.onNext,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      child: Row(
        children: [
          IconButton(
              onPressed: onPrevious, icon: Icon(backChevron(context))),
          Expanded(
            child: Text(
              DateFormat.yMMMM().format(month),
              textAlign: TextAlign.center,
              style: Theme.of(context)
                  .textTheme
                  .titleMedium
                  ?.copyWith(fontWeight: FontWeight.w700),
            ),
          ),
          IconButton(onPressed: onNext, icon: Icon(forwardChevron(context))),
        ],
      ),
    );
  }
}

class _MonthGrid extends StatelessWidget {
  final DateTime month;
  final List<CalendarTicket> tickets;
  final List<Project> projects;
  final List<TodoItem> todos;

  const _MonthGrid({
    required this.month,
    required this.tickets,
    this.projects = const [],
    this.todos = const [],
  });

  /// Bucket tickets by day. A closed ticket lands on two days — its start and
  /// its close — matching how the web calendar renders it.
  Map<DateTime, List<CalendarTicket>> _byDay() {
    final map = <DateTime, List<CalendarTicket>>{};
    void add(DateTime? day, CalendarTicket t) {
      if (day == null) return;
      map.putIfAbsent(day, () => []).add(t);
    }

    for (final t in tickets) {
      add(t.startDate, t);
      if (t.isClosed && t.closedDate != null && t.closedDate != t.startDate) {
        add(t.closedDate, t);
      }
    }
    return map;
  }

  /// A project marks up to three days: created, start and end. A day already
  /// claimed by a dated chip does not also get the "created" one.
  Map<DateTime, List<({Project project, String kind})>> _projectsByDay() {
    final map = <DateTime, List<({Project project, String kind})>>{};
    void add(DateTime? day, Project p, String kind) {
      if (day == null) return;
      final key = DateTime(day.year, day.month, day.day);
      map.putIfAbsent(key, () => []).add((project: p, kind: kind));
    }

    for (final p in projects) {
      add(p.startDate, p, 'start');
      if (p.endDate != null && p.endDate != p.startDate) {
        add(p.endDate, p, 'end');
      }
      if (p.createdDate != null &&
          p.createdDate != p.startDate &&
          p.createdDate != p.endDate) {
        add(p.createdDate, p, 'created');
      }
    }
    return map;
  }

  /// A to-do marks the day it is due, and its start day too when the window
  /// spans more than one day.
  Map<DateTime, List<TodoItem>> _todosByDay() {
    final map = <DateTime, List<TodoItem>>{};
    void add(DateTime? at, TodoItem todo) {
      if (at == null) return;
      final key = DateTime(at.year, at.month, at.day);
      map.putIfAbsent(key, () => []).add(todo);
    }

    for (final todo in todos) {
      add(todo.dueAt, todo);
      if (todo.startAt != null &&
          (todo.dueAt == null ||
              DateTime(todo.startAt!.year, todo.startAt!.month, todo.startAt!.day) !=
                  DateTime(todo.dueAt!.year, todo.dueAt!.month, todo.dueAt!.day))) {
        add(todo.startAt, todo);
      }
    }
    return map;
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final window = gridWindow(month);
    final byDay = _byDay();
    final projectsByDay = _projectsByDay();
    final todosByDay = _todosByDay();
    final today = DateTime.now();
    final todayKey = DateTime(today.year, today.month, today.day);

    return Column(
      children: [
        Row(
          children: [
            for (final label in const ['S', 'M', 'T', 'W', 'T', 'F', 'S'])
              Expanded(
                child: Center(
                  child: Padding(
                    padding: const EdgeInsets.only(bottom: 4),
                    child: Text(label,
                        style: theme.textTheme.labelSmall
                            ?.copyWith(color: theme.colorScheme.outline)),
                  ),
                ),
              ),
          ],
        ),
        Expanded(
          child: GridView.builder(
            padding: const EdgeInsets.symmetric(horizontal: 4),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 7,
              childAspectRatio: 0.62,
              mainAxisSpacing: 2,
              crossAxisSpacing: 2,
            ),
            itemCount: 42,
            itemBuilder: (context, index) {
              final day = window.start.add(Duration(days: index));
              final key = DateTime(day.year, day.month, day.day);
              final items = byDay[key] ?? const <CalendarTicket>[];
              final inMonth = day.month == month.month;

              return _DayCell(
                day: day,
                tickets: items,
                projects: projectsByDay[key] ?? const [],
                todos: todosByDay[key] ?? const [],
                dimmed: !inMonth,
                isToday: key == todayKey,
              );
            },
          ),
        ),
      ],
    );
  }
}

class _DayCell extends StatelessWidget {
  final DateTime day;
  final List<CalendarTicket> tickets;
  final List<({Project project, String kind})> projects;
  final List<TodoItem> todos;
  final bool dimmed;
  final bool isToday;

  const _DayCell({
    required this.day,
    required this.tickets,
    required this.dimmed,
    required this.isToday,
    this.projects = const [],
    this.todos = const [],
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return InkWell(
      onTap: () => showDaySheet(context, day, tickets, projects, todos),
      borderRadius: BorderRadius.circular(8),
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: isToday
                ? theme.colorScheme.primary
                : theme.colorScheme.outlineVariant.withValues(alpha: 0.5),
            width: isToday ? 1.5 : 1,
          ),
        ),
        padding: const EdgeInsets.all(3),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              '${day.day}',
              style: theme.textTheme.labelSmall?.copyWith(
                fontWeight: isToday ? FontWeight.w800 : FontWeight.w500,
                color: dimmed
                    ? theme.colorScheme.outline.withValues(alpha: 0.5)
                    : theme.colorScheme.onSurface,
              ),
            ),
            const SizedBox(height: 2),
            // Projects lead: they are the wider context for the day.
            for (final entry in projects.take(1))
              Padding(
                padding: const EdgeInsets.only(bottom: 2),
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 3, vertical: 1),
                  decoration: BoxDecoration(
                    color: Colors.purple.withValues(alpha: dimmed ? 0.08 : 0.18),
                    borderRadius: BorderRadius.circular(3),
                  ),
                  child: Text(
                    entry.project.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.labelSmall?.copyWith(fontSize: 8),
                  ),
                ),
              ),
            // To-dos read amber, apart from tickets and projects.
            for (final todo in todos.take(1))
              Padding(
                padding: const EdgeInsets.only(bottom: 2),
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 3, vertical: 1),
                  decoration: BoxDecoration(
                    color: Colors.amber.withValues(alpha: dimmed ? 0.10 : 0.22),
                    borderRadius: BorderRadius.circular(3),
                  ),
                  child: Text(
                    todo.title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.labelSmall?.copyWith(
                      fontSize: 8,
                      decoration: todo.done ? TextDecoration.lineThrough : null,
                    ),
                  ),
                ),
              ),
            // Two chips fit comfortably in a cell this size; the rest become a
            // "+N" counter that opens the day sheet.
            for (final t in tickets.take(2))
              Padding(
                padding: const EdgeInsets.only(bottom: 2),
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 3, vertical: 1),
                  decoration: BoxDecoration(
                    color: statusColor(t.status, theme.colorScheme)
                        .withValues(alpha: dimmed ? 0.08 : 0.18),
                    borderRadius: BorderRadius.circular(3),
                  ),
                  child: Text(
                    t.subject,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 8,
                      color: statusColor(t.status, theme.colorScheme),
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ),
            if (tickets.length > 2)
              Text('+${tickets.length - 2}',
                  style: theme.textTheme.labelSmall?.copyWith(
                      fontSize: 8, color: theme.colorScheme.outline)),
          ],
        ),
      ),
    );
  }
}


/// The day panel, shared by the month grid and the range list so the two can
/// never disagree about what a day holds.
void showDaySheet(
  BuildContext context,
  DateTime day,
  List<CalendarTicket> tickets,
  List<({Project project, String kind})> projects,
  List<TodoItem> todos,
) {
  showModalBottomSheet(
    context: context,
    showDragHandle: true,
    builder: (sheetContext) {
      final theme = Theme.of(sheetContext);
      return SafeArea(
        child: ListView(
          shrinkWrap: true,
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
          children: [
            Text(DateFormat.yMMMMEEEEd().format(day),
                style: theme.textTheme.titleMedium
                    ?.copyWith(fontWeight: FontWeight.w700)),
            const SizedBox(height: 12),
            if (tickets.isEmpty && projects.isEmpty && todos.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 16),
                child: Text(sheetContext.t('calendar.dayEmpty'),
                    textAlign: TextAlign.center,
                    style: theme.textTheme.bodySmall
                        ?.copyWith(color: theme.colorScheme.outline)),
              ),
            for (final entry in projects)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: AppCard(
                  onTap: () {
                    Navigator.pop(sheetContext);
                    Navigator.of(context).push(MaterialPageRoute(
                      builder: (_) => ProjectBoardPage(project: entry.project),
                    ));
                  },
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Icon(Icons.view_kanban_outlined,
                                size: 14, color: theme.colorScheme.primary),
                            const SizedBox(width: 6),
                            Text(
                              sheetContext.t(switch (entry.kind) {
                                'end' => 'calendar.tagEnd',
                                'created' => 'calendar.tagCreated',
                                _ => 'calendar.tagStart',
                              }),
                              style: theme.textTheme.labelSmall?.copyWith(
                                  color: theme.colorScheme.outline,
                                  fontWeight: FontWeight.w700),
                            ),
                          ],
                        ),
                        const SizedBox(height: 4),
                        Text(entry.project.name,
                            style: theme.textTheme.titleSmall
                                ?.copyWith(fontWeight: FontWeight.w600)),
                        const SizedBox(height: 4),
                        // Names, not just counts: avatars alone do not say who.
                        Text(
                          [
                            sheetContext.t(entry.project.isClosed
                                ? 'projects.statusClosed'
                                : 'projects.statusOpen'),
                            '${entry.project.doneTaskCount}/${entry.project.taskCount} '
                                '${sheetContext.t('projects.tasksDone')}',
                            if (entry.project.customer != null)
                              entry.project.customer!.fullName,
                            if (entry.project.assignees.isNotEmpty)
                              entry.project.assignees
                                  .map((a) => a.fullName)
                                  .join(', '),
                          ].join(' · '),
                          style: theme.textTheme.labelSmall
                              ?.copyWith(color: theme.colorScheme.outline),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            for (final todo in todos)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: AppCard(
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Icon(Icons.checklist_outlined,
                                size: 14, color: Colors.amber.shade800),
                            const SizedBox(width: 6),
                            Expanded(
                              child: Text(
                                todo.title,
                                style: theme.textTheme.titleSmall?.copyWith(
                                  fontWeight: FontWeight.w600,
                                  decoration: todo.done
                                      ? TextDecoration.lineThrough
                                      : null,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 4),
                        // Labelled values, not a run-on line.
                        Text(
                          [
                            todo.priority,
                            if (todo.durationLabel != null) todo.durationLabel!,
                            if (todo.customer != null) todo.customer!.fullName,
                            if (todo.assignees.isNotEmpty)
                              todo.assignees.map((a) => a.fullName).join(', ')
                            else
                              sheetContext.t('projects.unassigned'),
                          ].join(' \u00b7 '),
                          style: theme.textTheme.labelSmall
                              ?.copyWith(color: theme.colorScheme.outline),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            for (final t in tickets)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: AppCard(
                  onTap: () {
                    Navigator.pop(sheetContext);
                    Navigator.of(context).push(MaterialPageRoute(
                      builder: (_) => TicketDetailPage(ticketId: t.id),
                    ));
                  },
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(t.reference,
                            style: theme.textTheme.labelSmall
                                ?.copyWith(color: theme.colorScheme.outline)),
                        const SizedBox(height: 2),
                        Text(t.subject,
                            style: theme.textTheme.titleSmall
                                ?.copyWith(fontWeight: FontWeight.w600)),
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            StatusChip(t.status,
                                assigned: t.assignedAgentName.isNotEmpty),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                  t.assignedAgentName.isEmpty
                                      ? sheetContext.t('projects.unassigned')
                                      : t.assignedAgentName,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: theme.textTheme.bodySmall?.copyWith(
                                      color: theme.colorScheme.outline)),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ),
          ],
        ),
      );
    },
  );
}

/// Show / assignee / range controls, governing both kinds of entry at once.
class _CalendarFilters extends ConsumerWidget {
  const _CalendarFilters();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final show = ref.watch(calendarShowProvider);
    final assignee = ref.watch(calendarAssigneeProvider);
    final range = ref.watch(calendarRangeProvider);
    final agents = ref.watch(agentsProvider).valueOrNull ?? const <Agent>[];

    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
      child: Column(
        children: [
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                for (final option in const ['today', 'yesterday', 'week', 'month'])
                  Padding(
                    padding: const EdgeInsets.only(right: 6),
                    child: ChoiceChip(
                      label: Text(context.t(switch (option) {
                        'today' => 'calendar.rangeToday',
                        'yesterday' => 'calendar.rangeYesterday',
                        'week' => 'calendar.rangeWeek',
                        _ => 'calendar.rangeMonth',
                      })),
                      selected: range == option,
                      visualDensity: VisualDensity.compact,
                      onSelected: (_) {
                        ref.read(calendarRangeProvider.notifier).state = option;
                        // A preset is anchored on today, so jump back from any
                        // month the user had browsed to.
                        if (option != 'month') {
                          final now = DateTime.now();
                          ref.read(calendarMonthProvider.notifier).state =
                              DateTime(now.year, now.month);
                        }
                      },
                    ),
                  ),
              ],
            ),
          ),
          Row(
            children: [
              Expanded(
                child: DropdownButtonFormField<String>(
                  initialValue: show,
                  isExpanded: true,
                  decoration: InputDecoration(
                    labelText: context.t('calendar.showFilter'),
                    isDense: true,
                  ),
                  items: [
                    DropdownMenuItem(
                        value: 'all', child: Text(context.t('common.all'))),
                    DropdownMenuItem(
                        value: 'tickets', child: Text(context.t('nav.tickets'))),
                    DropdownMenuItem(
                        value: 'projects',
                        child: Text(context.t('projects.title'))),
                    DropdownMenuItem(
                        value: 'todos', child: Text(context.t('nav.todo'))),
                  ],
                  onChanged: (v) =>
                      ref.read(calendarShowProvider.notifier).state = v ?? 'all',
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: DropdownButtonFormField<int?>(
                  initialValue: assignee,
                  isExpanded: true,
                  decoration: InputDecoration(
                    labelText: context.t('calendar.assigneeFilter'),
                    isDense: true,
                  ),
                  items: [
                    DropdownMenuItem(
                        value: null, child: Text(context.t('common.all'))),
                    ...agents.map((a) => DropdownMenuItem(
                        value: a.id, child: Text(a.fullName))),
                  ],
                  onChanged: (v) =>
                      ref.read(calendarAssigneeProvider.notifier).state = v,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Day-by-day list for the short ranges. Every day in the span gets a row,
/// empty ones included — the span is short enough that blanks are informative.
class _RangeList extends StatelessWidget {
  const _RangeList({
    required this.window,
    required this.tickets,
    required this.projects,
    this.todos = const [],
  });

  final ({DateTime start, DateTime end}) window;
  final List<CalendarTicket> tickets;
  final List<Project> projects;
  final List<TodoItem> todos;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final days = window.end.difference(window.start).inDays + 1;

    return ListView.builder(
      padding: const EdgeInsets.all(12),
      itemCount: days,
      itemBuilder: (context, i) {
        final day = window.start.add(Duration(days: i));
        final key = DateTime(day.year, day.month, day.day);

        final dayTickets = tickets.where((t) {
          final start = t.startDate;
          final closed = t.closedDate;
          return start == key || (t.isClosed && closed == key);
        }).toList();

        final dayProjects = <({Project project, String kind})>[
          for (final p in projects)
            if (p.startDate == key)
              (project: p, kind: 'start')
            else if (p.endDate == key)
              (project: p, kind: 'end')
            else if (p.createdDate == key)
              (project: p, kind: 'created'),
        ];

        final dayTodos = todos.where((todo) {
          bool sameDay(DateTime? at) =>
              at != null && DateTime(at.year, at.month, at.day) == key;
          return sameDay(todo.dueAt) || sameDay(todo.startAt);
        }).toList();

        return AppCard(
          onTap: () =>
              showDaySheet(context, day, dayTickets, dayProjects, dayTodos),
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(DateFormat.MMMEd().format(day),
                    style: theme.textTheme.titleSmall
                        ?.copyWith(fontWeight: FontWeight.w700)),
                const SizedBox(height: 6),
                if (dayTickets.isEmpty && dayProjects.isEmpty && dayTodos.isEmpty)
                  Text(context.t('calendar.dayEmpty'),
                      style: theme.textTheme.bodySmall
                          ?.copyWith(color: theme.colorScheme.outline))
                else ...[
                  for (final entry in dayProjects)
                    Text('▬ ${entry.project.name}',
                        style: theme.textTheme.bodySmall
                            ?.copyWith(color: theme.colorScheme.primary)),
                  for (final t in dayTickets)
                    Text('● ${t.subject}',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: theme.textTheme.bodySmall),
                ],
              ],
            ),
          ),
        );
      },
    );
  }
}
