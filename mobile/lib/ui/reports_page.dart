import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../core/api_client.dart';
import '../i18n/i18n.dart';
import '../i18n/labels.dart';
import '../models/report.dart';
import '../state/providers.dart';
import 'app_shell.dart';
import 'theme.dart';
import 'widgets/chips.dart';

/// The window every report shares. Null on either side means open-ended, which
/// the API treats as "all time".
class ReportRange {
  final DateTime? from;
  final DateTime? to;

  const ReportRange({this.from, this.to});

  bool get isAll => from == null && to == null;

  /// A method rather than a getter: the range is a plain value class held in a
  /// provider, so it has no context of its own to resolve the locale from.
  String label(BuildContext context) {
    if (isAll) return context.t('reports.allTime');
    final f = DateFormat.MMMd();
    if (from != null && to != null) {
      return '${f.format(from!)} – ${f.format(to!)}';
    }
    return from != null
        ? context.tp('reports.from', {'date': f.format(from!)})
        : context.tp('reports.until', {'date': f.format(to!)});
  }
}

final reportRangeProvider =
    StateProvider<ReportRange>((ref) => const ReportRange());

final reportsSummaryProvider = FutureProvider<ReportsSummary>((ref) {
  final range = ref.watch(reportRangeProvider);
  return ref
      .watch(reportsRepositoryProvider)
      .summary(from: range.from, to: range.to);
});

final agentPerformanceProvider = FutureProvider<List<AgentPerformance>>((ref) {
  final range = ref.watch(reportRangeProvider);
  return ref
      .watch(reportsRepositoryProvider)
      .agentPerformance(from: range.from, to: range.to);
});

final customerActivityProvider = FutureProvider<List<CustomerActivity>>((ref) {
  final range = ref.watch(reportRangeProvider);
  return ref
      .watch(reportsRepositoryProvider)
      .customerActivity(from: range.from, to: range.to);
});

final licensesProvider = FutureProvider<List<LicenseRow>>(
  (ref) => ref.watch(reportsRepositoryProvider).licenses(),
);

/// Admin-only reporting, mirroring the web's /reports page: headline stats, an
/// opened-vs-resolved trend, four breakdowns, agent and customer tables, and
/// licence renewals.
class ReportsPage extends ConsumerWidget {
  const ReportsPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final range = ref.watch(reportRangeProvider);
    final summary = ref.watch(reportsSummaryProvider);

    return ShellScaffold(
      title: context.t('reports.title'),
      actions: [
        IconButton(
          icon: const Icon(Icons.date_range),
          tooltip: context.t('reports.dateRange'),
          onPressed: () => _pickRange(context, ref),
        ),
      ],
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(reportsSummaryProvider);
          ref.invalidate(agentPerformanceProvider);
          ref.invalidate(customerActivityProvider);
          ref.invalidate(licensesProvider);
        },
        child: ListView(
          padding: const EdgeInsets.all(AppSpacing.lg),
          children: [
            _RangeBar(range: range, onTap: () => _pickRange(context, ref)),
            const SizedBox(height: AppSpacing.lg),
            summary.when(
              loading: () => const Padding(
                padding: EdgeInsets.symmetric(vertical: 60),
                child: Center(child: CircularProgressIndicator()),
              ),
              error: (e, _) => ErrorView(
                message: describeError(e),
                onRetry: () => ref.invalidate(reportsSummaryProvider),
              ),
              data: (data) => Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _StatGrid(data: data),
                  const SizedBox(height: AppSpacing.xl),
                  SectionHeader(context.t('reports.openedVsResolved')),
                  _TrendCard(trend: data.trend),
                  const SizedBox(height: AppSpacing.xl),
                  SectionHeader(context.t('reports.breakdown')),
                  _BreakdownCard(
                    title: context.t('reports.byStatus'),
                    rows: data.byStatus,
                    labelOf: (l) => statusLabel(context, l),
                    colorOf: (l) =>
                        statusColor(l, Theme.of(context).colorScheme),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  _BreakdownCard(
                    title: context.t('reports.byPriority'),
                    rows: data.byPriority,
                    labelOf: (l) => priorityLabel(context, l),
                    colorOf: priorityColor,
                  ),
                  const SizedBox(height: AppSpacing.md),
                  _BreakdownCard(
                    title: context.t('reports.byCategory'),
                    rows: data.byCategory,
                    colorOf: (_) => seedColor,
                  ),
                  const SizedBox(height: AppSpacing.md),
                  _BreakdownCard(
                    title: context.t('reports.byRating'),
                    rows: data.byRating,
                    labelOf: (l) => '$l ★',
                    colorOf: (_) => const Color(0xFFF59E0B),
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.xl),
            SectionHeader(context.t('reports.agentPerformance')),
            const _AgentTable(),
            const SizedBox(height: AppSpacing.xl),
            SectionHeader(context.t('reports.customerActivity')),
            const _CustomerTable(),
            const SizedBox(height: AppSpacing.xl),
            SectionHeader(context.t('reports.licenses')),
            const _LicenseTable(),
            const SizedBox(height: AppSpacing.xl),
          ],
        ),
      ),
    );
  }

  Future<void> _pickRange(BuildContext context, WidgetRef ref) async {
    final current = ref.read(reportRangeProvider);
    final now = DateTime.now();
    final picked = await showDateRangePicker(
      context: context,
      firstDate: DateTime(now.year - 5),
      lastDate: DateTime(now.year + 1),
      initialDateRange: current.from != null && current.to != null
          ? DateTimeRange(start: current.from!, end: current.to!)
          : null,
    );
    if (picked == null) return;
    ref.read(reportRangeProvider.notifier).state =
        ReportRange(from: picked.start, to: picked.end);
  }
}

class _RangeBar extends ConsumerWidget {
  final ReportRange range;
  final VoidCallback onTap;

  const _RangeBar({required this.range, required this.onTap});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    return AppCard(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.lg, vertical: AppSpacing.md),
        child: Row(
          children: [
            Icon(Icons.date_range,
                size: 18, color: theme.colorScheme.onSurfaceVariant),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(context.t('reports.period'),
                      style: theme.textTheme.labelSmall?.copyWith(
                          color: theme.colorScheme.onSurfaceVariant)),
                  Text(range.label(context), style: theme.textTheme.bodyMedium),
                ],
              ),
            ),
            if (!range.isAll)
              TextButton(
                onPressed: () => ref.read(reportRangeProvider.notifier).state =
                    const ReportRange(),
                child: Text(context.t('reports.reset')),
              ),
          ],
        ),
      ),
    );
  }
}

class _StatGrid extends StatelessWidget {
  final ReportsSummary data;
  const _StatGrid({required this.data});

  @override
  Widget build(BuildContext context) {
    String hours(double? v) =>
        v == null ? '—' : '${v.toStringAsFixed(1)}h';

    final tiles = <(String, String, IconData, TileColor)>[
      (context.t('reports.totalTickets'), '${data.total}', Icons.inbox_rounded, TileColor.indigo),
      (context.t('reports.resolved'), '${data.resolvedCount}', Icons.check_circle_outline,
          TileColor.green),
      (context.t('reports.avgResolution'), hours(data.avgResolutionHours), Icons.timer_outlined,
          TileColor.blue),
      (
        context.t('reports.satisfaction'),
        data.avgRating == null
            ? '—'
            : '${data.avgRating!.toStringAsFixed(1)} ★',
        Icons.star_outline,
        TileColor.amber
      ),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        GridView.count(
          crossAxisCount: 2,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          crossAxisSpacing: 12,
          mainAxisSpacing: 12,
          childAspectRatio: 1.55,
          children: [
            for (final (label, value, icon, color) in tiles)
              StatTile(label: label, value: value, icon: icon, color: color),
          ],
        ),
        if (data.ratingCount > 0)
          Padding(
            padding: const EdgeInsets.only(top: AppSpacing.sm),
            child: Text(
              'Satisfaction from ${data.ratingCount} rated '
              '${data.ratingCount == 1 ? "ticket" : "tickets"}.',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant),
            ),
          ),
      ],
    );
  }
}

/// Opened vs resolved as two lines. The server already fills quiet buckets with
/// zero, so no gap-filling is needed here.
class _TrendCard extends StatelessWidget {
  final Trend trend;
  const _TrendCard({required this.trend});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final points = trend.points;

    if (points.isEmpty) {
      return AppCard(
        child: EmptyState(
          icon: Icons.show_chart,
          title: context.t('reports.noActivity'),
        ),
      );
    }

    final maxY = points
        .map((p) => p.created > p.resolved ? p.created : p.resolved)
        .fold<int>(0, (a, b) => a > b ? a : b)
        .toDouble();

    // A flat zero axis would collapse the chart; keep a minimum headroom.
    final top = (maxY < 4 ? 4 : maxY * 1.2).ceilToDouble();

    String labelAt(double x) {
      final i = x.round();
      if (i < 0 || i >= points.length) return '';
      final d = points[i].date;
      return switch (trend.granularity) {
        'month' => DateFormat.MMM().format(d),
        'week' => DateFormat.Md().format(d),
        _ => DateFormat.Md().format(d),
      };
    }

    // Show a handful of labels rather than one per bucket, which would overlap.
    final labelEvery = (points.length / 5).ceil().clamp(1, points.length);

    return AppCard(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(8, AppSpacing.lg, AppSpacing.lg, 8),
        child: Column(
          children: [
            SizedBox(
              height: 200,
              child: LineChart(
                LineChartData(
                  minY: 0,
                  maxY: top,
                  gridData: FlGridData(
                    show: true,
                    drawVerticalLine: false,
                    getDrawingHorizontalLine: (_) => FlLine(
                      color: theme.colorScheme.outlineVariant,
                      strokeWidth: 1,
                    ),
                  ),
                  borderData: FlBorderData(show: false),
                  titlesData: FlTitlesData(
                    topTitles: const AxisTitles(
                        sideTitles: SideTitles(showTitles: false)),
                    rightTitles: const AxisTitles(
                        sideTitles: SideTitles(showTitles: false)),
                    leftTitles: AxisTitles(
                      sideTitles: SideTitles(
                        showTitles: true,
                        reservedSize: 34,
                        getTitlesWidget: (value, meta) {
                          if (value != value.roundToDouble()) {
                            return const SizedBox.shrink();
                          }
                          return Text('${value.toInt()}',
                              style: theme.textTheme.labelSmall);
                        },
                      ),
                    ),
                    bottomTitles: AxisTitles(
                      sideTitles: SideTitles(
                        showTitles: true,
                        reservedSize: 28,
                        interval: labelEvery.toDouble(),
                        getTitlesWidget: (value, meta) => Padding(
                          padding: const EdgeInsets.only(top: 6),
                          child: Text(labelAt(value),
                              style: theme.textTheme.labelSmall),
                        ),
                      ),
                    ),
                  ),
                  lineTouchData: LineTouchData(
                    touchTooltipData: LineTouchTooltipData(
                      getTooltipItems: (spots) => spots.map((s) {
                        final isCreated = s.barIndex == 0;
                        return LineTooltipItem(
                          '${isCreated ? "Opened" : "Resolved"}: '
                          '${s.y.toInt()}',
                          TextStyle(
                            color: isCreated
                                ? seedColor
                                : const Color(0xFF059669),
                            fontWeight: FontWeight.w600,
                            fontSize: 12,
                          ),
                        );
                      }).toList(),
                    ),
                  ),
                  lineBarsData: [
                    _series(
                      [
                        for (var i = 0; i < points.length; i++)
                          FlSpot(i.toDouble(), points[i].created.toDouble()),
                      ],
                      seedColor,
                    ),
                    _series(
                      [
                        for (var i = 0; i < points.length; i++)
                          FlSpot(i.toDouble(), points[i].resolved.toDouble()),
                      ],
                      const Color(0xFF059669),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                _legend(context, 'Opened', seedColor),
                const SizedBox(width: AppSpacing.lg),
                _legend(context, 'Resolved', const Color(0xFF059669)),
              ],
            ),
          ],
        ),
      ),
    );
  }

  LineChartBarData _series(List<FlSpot> spots, Color color) => LineChartBarData(
        spots: spots,
        isCurved: true,
        curveSmoothness: 0.25,
        color: color,
        barWidth: 2.5,
        // Dots on a long series turn into noise; the tooltip covers exact values.
        dotData: FlDotData(show: spots.length <= 14),
        belowBarData: BarAreaData(
          show: true,
          color: color.withValues(alpha: 0.10),
        ),
      );

  Widget _legend(BuildContext context, String label, Color color) => Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 10,
            height: 10,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
          const SizedBox(width: 6),
          Text(label, style: Theme.of(context).textTheme.bodySmall),
        ],
      );
}

/// A breakdown as labelled proportional bars — readable on a phone where a pie
/// chart's slices and legend would not be.
class _BreakdownCard extends StatelessWidget {
  final String title;
  final List<Breakdown> rows;
  final String Function(String)? labelOf;
  final Color Function(String) colorOf;

  const _BreakdownCard({
    required this.title,
    required this.rows,
    required this.colorOf,
    this.labelOf,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final total = rows.fold<int>(0, (sum, r) => sum + r.count);

    return AppCard(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: theme.textTheme.titleSmall),
            const SizedBox(height: AppSpacing.md),
            if (rows.isEmpty)
              Text('No data',
                  style: theme.textTheme.bodySmall
                      ?.copyWith(color: theme.colorScheme.onSurfaceVariant))
            else
              for (final row in rows)
                Padding(
                  padding: const EdgeInsets.only(bottom: AppSpacing.md),
                  child: Column(
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              labelOf?.call(row.label) ?? row.label,
                              style: theme.textTheme.bodyMedium,
                            ),
                          ),
                          Text(
                            total == 0
                                ? '${row.count}'
                                : '${row.count}  ·  '
                                    '${(row.count * 100 / total).round()}%',
                            style: theme.textTheme.labelSmall?.copyWith(
                                color: theme.colorScheme.onSurfaceVariant),
                          ),
                        ],
                      ),
                      const SizedBox(height: 5),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(999),
                        child: LinearProgressIndicator(
                          value: total == 0 ? 0 : row.count / total,
                          minHeight: 6,
                          backgroundColor: theme.colorScheme.outlineVariant
                              .withValues(alpha: 0.4),
                          valueColor: AlwaysStoppedAnimation(
                              colorOf(row.label)),
                        ),
                      ),
                    ],
                  ),
                ),
          ],
        ),
      ),
    );
  }
}

class _AgentTable extends ConsumerWidget {
  const _AgentTable();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    return ref.watch(agentPerformanceProvider).when(
          loading: () => const AppCard(
            child: Padding(
              padding: EdgeInsets.all(24),
              child: Center(child: CircularProgressIndicator()),
            ),
          ),
          error: (e, _) => AppCard(
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.lg),
              child: Text(describeError(e)),
            ),
          ),
          data: (rows) => rows.isEmpty
              ? const AppCard(
                  child: EmptyState(
                      icon: Icons.badge_outlined, title: 'No agent activity'),
                )
              : AppCard(
                  child: Column(
                    children: [
                      for (var i = 0; i < rows.length; i++) ...[
                        if (i > 0)
                          Divider(
                              height: 1,
                              color: theme.colorScheme.outlineVariant),
                        _MetricRow(
                          title: rows[i].agentName,
                          metrics: [
                            ('Assigned', '${rows[i].assignedCount}'),
                            ('Closed', '${rows[i].closedCount}'),
                            (
                              'Avg',
                              rows[i].avgResolutionHours == null
                                  ? '—'
                                  : '${rows[i].avgResolutionHours!.toStringAsFixed(1)}h'
                            ),
                            (
                              'Rating',
                              rows[i].avgRating == null
                                  ? '—'
                                  : '${rows[i].avgRating!.toStringAsFixed(1)}★'
                            ),
                          ],
                        ),
                      ],
                    ],
                  ),
                ),
        );
  }
}

class _CustomerTable extends ConsumerWidget {
  const _CustomerTable();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    return ref.watch(customerActivityProvider).when(
          loading: () => const AppCard(
            child: Padding(
              padding: EdgeInsets.all(24),
              child: Center(child: CircularProgressIndicator()),
            ),
          ),
          error: (e, _) => AppCard(
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.lg),
              child: Text(describeError(e)),
            ),
          ),
          data: (rows) => rows.isEmpty
              ? const AppCard(
                  child: EmptyState(
                    icon: Icons.people_outline,
                    title: 'No customer activity',
                    subtitle: 'Customers with no tickets in the period are '
                        'left out.',
                  ),
                )
              : AppCard(
                  child: Column(
                    children: [
                      for (var i = 0; i < rows.length; i++) ...[
                        if (i > 0)
                          Divider(
                              height: 1,
                              color: theme.colorScheme.outlineVariant),
                        _MetricRow(
                          title: rows[i].customerName,
                          metrics: [
                            ('Tickets', '${rows[i].ticketCount}'),
                            ('Open', '${rows[i].openCount}'),
                            ('Closed', '${rows[i].closedCount}'),
                            (
                              'Rating',
                              rows[i].avgRating == null
                                  ? '—'
                                  : '${rows[i].avgRating!.toStringAsFixed(1)}★'
                            ),
                          ],
                        ),
                      ],
                    ],
                  ),
                ),
        );
  }
}

class _LicenseTable extends ConsumerWidget {
  const _LicenseTable();

  static Color _stateColor(String state) => switch (state) {
        'expired' => const Color(0xFFDC2626),
        'expiring' => const Color(0xFFD97706),
        _ => const Color(0xFF059669),
      };

  static String _stateLabel(String state) => switch (state) {
        'expired' => 'Expired',
        'expiring' => 'Expiring soon',
        _ => 'Active',
      };

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    return ref.watch(licensesProvider).when(
          loading: () => const AppCard(
            child: Padding(
              padding: EdgeInsets.all(24),
              child: Center(child: CircularProgressIndicator()),
            ),
          ),
          error: (e, _) => AppCard(
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.lg),
              child: Text(describeError(e)),
            ),
          ),
          data: (rows) => rows.isEmpty
              ? const AppCard(
                  child: EmptyState(
                      icon: Icons.verified_outlined, title: 'No licenses'),
                )
              : Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Padding(
                      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                      child: Text(
                        'Always current — not filtered by the reporting '
                        'period.',
                        style: theme.textTheme.bodySmall?.copyWith(
                            color: theme.colorScheme.onSurfaceVariant),
                      ),
                    ),
                    AppCard(
                      child: Column(
                        children: [
                          for (var i = 0; i < rows.length; i++) ...[
                            if (i > 0)
                              Divider(
                                  height: 1,
                                  color: theme.colorScheme.outlineVariant),
                            ListTile(
                              title: Text(rows[i].licenseName),
                              subtitle: Text(
                                '${rows[i].customerName}'
                                '${rows[i].endDate == null ? "" : " · ends "
                                    "${DateFormat.yMMMd().format(rows[i].endDate!)}"}',
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                              ),
                              trailing: Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                crossAxisAlignment: CrossAxisAlignment.end,
                                children: [
                                  Pill(
                                    label: _stateLabel(rows[i].state),
                                    color: _stateColor(rows[i].state),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    rows[i].daysLeft < 0
                                        ? '${-rows[i].daysLeft}d ago'
                                        : '${rows[i].daysLeft}d left',
                                    style: theme.textTheme.labelSmall?.copyWith(
                                        color:
                                            theme.colorScheme.onSurfaceVariant),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ],
                ),
        );
  }
}

/// One named row with a set of small metrics beneath it — a table layout that
/// survives a narrow screen, where real columns would not.
class _MetricRow extends StatelessWidget {
  final String title;
  final List<(String, String)> metrics;

  const _MetricRow({required this.title, required this.metrics});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.all(AppSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: theme.textTheme.titleSmall),
          const SizedBox(height: AppSpacing.sm),
          Row(
            children: [
              for (final (label, value) in metrics)
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(value,
                          style: theme.textTheme.titleMedium
                              ?.copyWith(fontWeight: FontWeight.w700)),
                      Text(label,
                          style: theme.textTheme.labelSmall?.copyWith(
                              color: theme.colorScheme.onSurfaceVariant)),
                    ],
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }
}
