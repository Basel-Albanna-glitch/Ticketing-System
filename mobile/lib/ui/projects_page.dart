import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/api_client.dart';
import '../i18n/i18n.dart';
import '../models/project.dart';
import '../state/providers.dart';
import 'app_shell.dart';
import 'forms/content_form_pages.dart';
import 'project_board_page.dart';
import 'theme.dart';
import 'widgets/chips.dart';

/// 'open' by default: closed projects are finished work and stay out of the
/// way until asked for, exactly as on the web.
final projectStatusFilterProvider = StateProvider<String>((ref) => 'open');
final projectSearchProvider = StateProvider<String>((ref) => '');

final projectsProvider = FutureProvider<List<Project>>((ref) {
  final status = ref.watch(projectStatusFilterProvider);
  final search = ref.watch(projectSearchProvider);
  return ref.watch(miscRepositoryProvider).projects(
        status: status == 'all' ? null : status,
        search: search.isEmpty ? null : search,
      );
});

/// Staff-only, matching the web app's /projects route.
class ProjectsPage extends ConsumerWidget {
  const ProjectsPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(projectsProvider);

    return ShellScaffold(
      title: context.t('projects.title'),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () async {
          final created = await Navigator.of(context).push<bool>(
            MaterialPageRoute(builder: (_) => const ProjectFormPage()),
          );
          if (created == true) ref.invalidate(projectsProvider);
        },
        icon: const Icon(Icons.add),
        label: Text(context.t('projects.new')),
      ),
      body: Column(children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  decoration: InputDecoration(
                    isDense: true,
                    prefixIcon: const Icon(Icons.search, size: 18),
                    hintText: context.t('projects.searchHint'),
                  ),
                  onSubmitted: (value) =>
                      ref.read(projectSearchProvider.notifier).state = value.trim(),
                ),
              ),
              const SizedBox(width: 8),
              DropdownButton<String>(
                value: ref.watch(projectStatusFilterProvider),
                underline: const SizedBox.shrink(),
                items: [
                  DropdownMenuItem(
                      value: 'open',
                      child: Text(context.t('projects.filterOpen'))),
                  DropdownMenuItem(
                      value: 'closed',
                      child: Text(context.t('projects.filterClosed'))),
                  DropdownMenuItem(
                      value: 'all', child: Text(context.t('common.all'))),
                ],
                onChanged: (v) => ref
                    .read(projectStatusFilterProvider.notifier)
                    .state = v ?? 'open',
              ),
            ],
          ),
        ),
        Expanded(
          child: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => ErrorView(
          message: describeError(e),
          onRetry: () => ref.invalidate(projectsProvider),
        ),
        data: (projects) => RefreshIndicator(
          onRefresh: () async => ref.invalidate(projectsProvider),
          child: projects.isEmpty
              ? ListView(children: [
                  EmptyState(
                    icon: Icons.view_kanban_outlined,
                    title: context.t('projects.noneYet'),
                  ),
                ])
              : ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: projects.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (context, i) {
                    final p = projects[i];
                    final theme = Theme.of(context);
                    return AppCard(
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
                                      style: theme.textTheme.titleMedium
                                          ?.copyWith(
                                              fontWeight: FontWeight.w600)),
                                ),
                                Text('${p.taskCount} tasks',
                                    style: theme.textTheme.labelSmall?.copyWith(
                                        color: theme.colorScheme.outline)),
                                // Edit sits on the card, as the web pencil does.
                                IconButton(
                                  visualDensity: VisualDensity.compact,
                                  tooltip: context.t('projects.edit'),
                                  icon: const Icon(Icons.edit_outlined, size: 18),
                                  onPressed: () async {
                                    final saved = await Navigator.of(context)
                                        .push<bool>(MaterialPageRoute(
                                      builder: (_) => ProjectFormPage(project: p),
                                    ));
                                    if (saved == true) {
                                      ref.invalidate(projectsProvider);
                                    }
                                  },
                                ),
                              ],
                            ),
                            if (p.description.isNotEmpty) ...[
                              const SizedBox(height: 6),
                              Text(p.description,
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                  style: theme.textTheme.bodySmall?.copyWith(
                                      color: theme.colorScheme.outline)),
                            ],
                            const SizedBox(height: 8),
                            Wrap(
                              spacing: 8,
                              runSpacing: 4,
                              crossAxisAlignment: WrapCrossAlignment.center,
                              children: [
                                // Status, who it is for, and who is on it — the
                                // same facts the web card shows.
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 8, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: p.isClosed
                                        ? theme.colorScheme.surfaceContainerHighest
                                        : theme.colorScheme.primary
                                            .withValues(alpha: 0.12),
                                    borderRadius: BorderRadius.circular(999),
                                  ),
                                  child: Text(
                                    context.t(p.isClosed
                                        ? 'projects.statusClosed'
                                        : 'projects.statusOpen'),
                                    style: theme.textTheme.labelSmall?.copyWith(
                                        fontWeight: FontWeight.w600),
                                  ),
                                ),
                                if (p.customer != null)
                                  Text(
                                    p.branchName == null
                                        ? p.customer!.fullName
                                        : '${p.customer!.fullName} · ${p.branchName}',
                                    style: theme.textTheme.labelSmall?.copyWith(
                                        color: theme.colorScheme.primary),
                                  ),
                                if (p.assignees.isNotEmpty)
                                  Text(
                                      p.assignees
                                          .map((a) => a.fullName)
                                          .join(', '),
                                      style: theme.textTheme.labelSmall
                                          ?.copyWith(
                                              color:
                                                  theme.colorScheme.outline)),
                              ],
                            ),
                            const SizedBox(height: 8),
                            // Progress by tasks done, matching the web bar.
                            ClipRRect(
                              borderRadius: BorderRadius.circular(999),
                              child: LinearProgressIndicator(
                                value: p.progress,
                                minHeight: 6,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              '${p.doneTaskCount}/${p.taskCount} ${context.t('projects.tasksDone')}',
                              style: theme.textTheme.labelSmall
                                  ?.copyWith(color: theme.colorScheme.outline),
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
        ),
          ),
        ),
      ]),
    );
  }
}
