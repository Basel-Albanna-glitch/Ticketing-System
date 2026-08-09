import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/api_client.dart';
import '../i18n/i18n.dart';
import '../models/project.dart';
import '../state/providers.dart';
import 'project_board_page.dart';
import 'theme.dart';
import 'widgets/chips.dart';

/// Projects this agent is an assignee on. Keyed by agent id so two profiles
/// never share a cache entry.
final agentProjectsProvider =
    FutureProvider.family<List<Project>, int>((ref, agentId) {
  return ref.watch(miscRepositoryProvider).projects(assigneeId: agentId);
});

/// One agent's profile: their counts, the projects they are on, and a link into
/// each. Mirrors the web app's /agents/:id page.
class AgentDetailPage extends ConsumerWidget {
  const AgentDetailPage({super.key, required this.agent});

  final Agent agent;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final async = ref.watch(agentProjectsProvider(agent.id));

    return Scaffold(
      appBar: AppBar(title: Text(context.t('agents.profile'))),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          AppCard(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 28,
                    backgroundImage: agent.avatarUrl == null
                        ? null
                        : NetworkImage(agent.avatarUrl!),
                    child: agent.avatarUrl == null ? Text(agent.initials) : null,
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(agent.fullName,
                            style: theme.textTheme.titleLarge
                                ?.copyWith(fontWeight: FontWeight.w700)),
                        Text('@${agent.username}',
                            style: theme.textTheme.bodySmall
                                ?.copyWith(color: theme.colorScheme.outline)),
                        if (agent.email.isNotEmpty)
                          Text(agent.email,
                              style: theme.textTheme.bodySmall
                                  ?.copyWith(color: theme.colorScheme.outline)),
                        const SizedBox(height: 6),
                        Wrap(
                          spacing: 6,
                          children: [
                            Chip(
                              visualDensity: VisualDensity.compact,
                              label: Text(agent.isActive
                                  ? context.t('agents.active')
                                  : context.t('agents.inactive')),
                            ),
                            if (agent.isAvailable)
                              Chip(
                                visualDensity: VisualDensity.compact,
                                label: Text(context.t('agents.available')),
                              ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _Stat(
                  label: context.t('agents.assigned'),
                  value: '${agent.assignedCount}',
                  icon: Icons.inbox_outlined,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _Stat(
                  label: context.t('agents.resolved'),
                  value: '${agent.resolvedCount}',
                  icon: Icons.check_circle_outline,
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          Text(context.t('projects.title'),
              style: theme.textTheme.titleMedium
                  ?.copyWith(fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          async.when(
            loading: () =>
                const Center(child: Padding(
              padding: EdgeInsets.all(24),
              child: CircularProgressIndicator(),
            )),
            error: (e, _) => ErrorView(
              message: describeError(e),
              onRetry: () => ref.invalidate(agentProjectsProvider(agent.id)),
            ),
            data: (projects) => projects.isEmpty
                ? EmptyState(
                    icon: Icons.view_kanban_outlined,
                    title: context.t('agents.noProjects'),
                  )
                : Column(
                    children: [
                      for (final p in projects) ...[
                        AppCard(
                          onTap: () => Navigator.of(context).push(
                            MaterialPageRoute(
                              builder: (_) => ProjectBoardPage(project: p),
                            ),
                          ),
                          child: Padding(
                            padding: const EdgeInsets.all(14),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Expanded(
                                      child: Text(p.name,
                                          style: theme.textTheme.titleSmall
                                              ?.copyWith(
                                                  fontWeight: FontWeight.w600)),
                                    ),
                                    Text(
                                      context.t(p.isClosed
                                          ? 'projects.statusClosed'
                                          : 'projects.statusOpen'),
                                      style: theme.textTheme.labelSmall
                                          ?.copyWith(
                                              color:
                                                  theme.colorScheme.outline),
                                    ),
                                  ],
                                ),
                                if (p.customer != null)
                                  Text(
                                    p.branchName == null
                                        ? p.customer!.fullName
                                        : '${p.customer!.fullName} · ${p.branchName}',
                                    style: theme.textTheme.labelSmall?.copyWith(
                                        color: theme.colorScheme.primary),
                                  ),
                                const SizedBox(height: 8),
                                ClipRRect(
                                  borderRadius: BorderRadius.circular(999),
                                  child: LinearProgressIndicator(
                                      value: p.progress, minHeight: 6),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  '${p.doneTaskCount}/${p.taskCount} ${context.t('projects.tasksDone')}',
                                  style: theme.textTheme.labelSmall?.copyWith(
                                      color: theme.colorScheme.outline),
                                ),
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(height: 10),
                      ],
                    ],
                  ),
          ),
        ],
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({required this.label, required this.value, required this.icon});

  final String label;
  final String value;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return AppCard(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            Icon(icon, color: theme.colorScheme.primary),
            const SizedBox(width: 10),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label,
                    style: theme.textTheme.labelSmall
                        ?.copyWith(color: theme.colorScheme.outline)),
                Text(value,
                    style: theme.textTheme.titleLarge
                        ?.copyWith(fontWeight: FontWeight.w700)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
