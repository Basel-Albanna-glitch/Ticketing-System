import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../core/api_client.dart';
import '../i18n/i18n.dart';
import '../models/dashboard.dart';
import '../models/ticket.dart';
import '../state/providers.dart';
import 'app_shell.dart';
import 'theme.dart';
import 'ticket_detail_page.dart';
import 'widgets/chips.dart';

class DashboardPage extends ConsumerWidget {
  const DashboardPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(dashboardProvider);
    final user = ref.watch(authProvider).user;

    return ShellScaffold(
      title: context.t('dashboard.title'),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => ErrorView(
          message: describeError(e),
          onRetry: () => ref.invalidate(dashboardProvider),
        ),
        data: (data) => RefreshIndicator(
          onRefresh: () async => ref.invalidate(dashboardProvider),
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Text(
                context.tp('dashboard.hello',
                    {'name': user?.fullName.split(' ').first ?? ''}),
                style: Theme.of(context).textTheme.headlineSmall,
              ),
              Text(
                context.t('dashboard.subtitle'),
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant),
              ),
              const SizedBox(height: AppSpacing.xl),
              _StatGrid(data: data),
              const SizedBox(height: AppSpacing.xl),
              SectionHeader(context.t('dashboard.recentTickets')),
              if (data.recent.isEmpty)
                EmptyState(
                  icon: Icons.inbox_outlined,
                  title: context.t('dashboard.nothingTitle'),
                  subtitle: context.t('dashboard.nothingSubtitle'),
                )
              else
                for (final t in data.recent)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: _RecentRow(ticket: t),
                  ),
            ],
          ),
        ),
      ),
    );
  }
}

class _StatGrid extends StatelessWidget {
  final DashboardData data;
  const _StatGrid({required this.data});

  @override
  Widget build(BuildContext context) {
    final tiles = <(String, int, IconData, TileColor)>[
      (context.t('dashboard.total'), data.total, Icons.inbox_rounded, TileColor.indigo),
      (context.t('dashboard.unassigned'), data.open, Icons.inbox_outlined, TileColor.blue),
      (context.t('dashboard.inProgress'), data.inProgress, Icons.bolt_rounded, TileColor.amber),
      (context.t('dashboard.resolved'), data.resolved, Icons.check_circle_outline, TileColor.green),
    ];

    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      crossAxisSpacing: 12,
      mainAxisSpacing: 12,
      childAspectRatio: 1.55,
      children: [
        for (final (label, value, icon, color) in tiles)
          StatTile(
            label: label,
            value: '$value',
            icon: icon,
            color: color,
          ),
      ],
    );
  }
}

class _RecentRow extends StatelessWidget {
  final Ticket ticket;
  const _RecentRow({required this.ticket});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return AppCard(
      onTap: () => Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => TicketDetailPage(ticketId: ticket.id)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(ticket.reference,
                      style: theme.textTheme.labelSmall
                          ?.copyWith(color: theme.colorScheme.outline)),
                  const SizedBox(height: 2),
                  Text(ticket.subject,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.titleSmall
                          ?.copyWith(fontWeight: FontWeight.w600)),
                  const SizedBox(height: 6),
                  StatusChip(ticket.status, assigned: ticket.isAssigned),
                ],
              ),
            ),
            if (ticket.createdAt != null)
              Text(DateFormat.MMMd().format(ticket.createdAt!),
                  style: theme.textTheme.bodySmall
                      ?.copyWith(color: theme.colorScheme.outline)),
          ],
        ),
      ),
    );
  }
}
