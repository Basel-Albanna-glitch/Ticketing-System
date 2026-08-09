import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/api_client.dart';
import '../i18n/i18n.dart';
import '../models/project.dart';
import '../state/providers.dart';
import 'agent_detail_page.dart';
import 'app_shell.dart';
import 'forms/people_form_pages.dart';
import 'theme.dart';
import 'widgets/chips.dart';

final agentsProvider = FutureProvider<List<Agent>>(
  (ref) => ref.watch(miscRepositoryProvider).agents(),
);

/// Admin-only roster. Availability drives who can be auto-suggested for
/// assignment, so toggling it here has real effect on the ticket flow.
class AgentsPage extends ConsumerWidget {
  const AgentsPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(agentsProvider);

    return ShellScaffold(
      title: context.t('agents.title'),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () async {
          final created = await Navigator.of(context).push<bool>(
            MaterialPageRoute(builder: (_) => const AgentFormPage()),
          );
          if (created == true) ref.invalidate(agentsProvider);
        },
        icon: const Icon(Icons.person_add_alt_1),
        label: Text(context.t('agents.new')),
      ),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => ErrorView(
          message: describeError(e),
          onRetry: () => ref.invalidate(agentsProvider),
        ),
        data: (agents) => RefreshIndicator(
          onRefresh: () async => ref.invalidate(agentsProvider),
          child: agents.isEmpty
              ? ListView(children: [
                  EmptyState(
                    icon: Icons.badge_outlined,
                    title: context.t('agents.noneYet'),
                  ),
                ])
              : ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: agents.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (context, i) => _AgentCard(
                    agent: agents[i],
                    onToggleAvailable: (value) async {
                      try {
                        await ref
                            .read(miscRepositoryProvider)
                            .updateAgent(agents[i].id, {'is_available': value});
                        ref.invalidate(agentsProvider);
                      } catch (e) {
                        if (!context.mounted) return;
                        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                          content: Text(describeError(e)),
                          backgroundColor: Theme.of(context).colorScheme.error,
                        ));
                      }
                    },
                  ),
                ),
        ),
      ),
    );
  }
}

class _AgentCard extends StatelessWidget {
  final Agent agent;
  final ValueChanged<bool> onToggleAvailable;

  const _AgentCard({required this.agent, required this.onToggleAvailable});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return AppCard(
      // Tapping the card opens the agent's profile, as on the web.
      onTap: () => Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => AgentDetailPage(agent: agent)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          children: [
            Row(
              children: [
                CircleAvatar(
                  backgroundColor: theme.colorScheme.primaryContainer,
                  foregroundImage: agent.avatarUrl == null
                      ? null
                      : NetworkImage(agent.avatarUrl!),
                  child: Text(agent.initials,
                      style: TextStyle(
                        color: theme.colorScheme.onPrimaryContainer,
                        fontWeight: FontWeight.w700,
                      )),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(agent.fullName,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: theme.textTheme.titleSmall
                              ?.copyWith(fontWeight: FontWeight.w600)),
                      Text(
                        agent.email.isEmpty ? '@${agent.username}' : agent.email,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: theme.textTheme.bodySmall
                            ?.copyWith(color: theme.colorScheme.outline),
                      ),
                    ],
                  ),
                ),
                if (!agent.isActive)
                  Text(context.t('agents.disabled'),
                      style: theme.textTheme.labelSmall
                          ?.copyWith(color: theme.colorScheme.error)),
              ],
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                _Metric(
                    label: context.t('agents.assigned'),
                    value: agent.assignedCount),
                const SizedBox(width: 16),
                _Metric(
                    label: context.t('agents.resolved'),
                    value: agent.resolvedCount),
                const Spacer(),
                Text(context.t('agents.available'),
                    style: theme.textTheme.bodySmall
                        ?.copyWith(color: theme.colorScheme.outline)),
                Switch(
                  value: agent.isAvailable,
                  onChanged: agent.isActive ? onToggleAvailable : null,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _Metric extends StatelessWidget {
  final String label;
  final int value;
  const _Metric({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Row(
      children: [
        Text('$value',
            style: theme.textTheme.titleSmall
                ?.copyWith(fontWeight: FontWeight.w700)),
        const SizedBox(width: 4),
        Text(label,
            style: theme.textTheme.bodySmall
                ?.copyWith(color: theme.colorScheme.outline)),
      ],
    );
  }
}
