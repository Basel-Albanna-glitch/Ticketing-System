import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/api_client.dart';
import '../i18n/i18n.dart';
import '../models/article.dart';
import '../state/providers.dart';
import 'app_shell.dart';
import 'forms/content_form_pages.dart';
import 'kb_article_page.dart';
import 'settings_page.dart';
import 'theme.dart';
import 'widgets/chips.dart';

/// Articles are filtered server-side: unpublished drafts are only returned to
/// staff (ArticleViewSet.get_queryset), so no role check is needed here.
final kbSearchProvider = StateProvider<String>((ref) => '');

final kbArticlesProvider = FutureProvider<List<Article>>((ref) {
  final search = ref.watch(kbSearchProvider);
  return ref.watch(miscRepositoryProvider).articles(search: search);
});

class KbListPage extends ConsumerStatefulWidget {
  const KbListPage({super.key});

  @override
  ConsumerState<KbListPage> createState() => _KbListPageState();
}

class _KbListPageState extends ConsumerState<KbListPage> {
  final _search = TextEditingController();

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(kbArticlesProvider);

    final user = ref.watch(authProvider).user;
    // Admins always may; agents only when the manage-knowledge-base permission
    // is switched on, which is exactly what the API enforces.
    final canManage = (user?.isAdmin ?? false) ||
        ((user?.isStaff ?? false) &&
            (ref.watch(ticketSettingsProvider).valueOrNull?['allow_agent_manage_kb'] ??
                false));

    return ShellScaffold(
      title: context.t('kb.title'),
      floatingActionButton: canManage
          ? FloatingActionButton.extended(
              onPressed: () async {
                final created = await Navigator.of(context).push<bool>(
                  MaterialPageRoute(builder: (_) => const ArticleFormPage()),
                );
                if (created == true) ref.invalidate(kbArticlesProvider);
              },
              icon: const Icon(Icons.add),
              label: Text(context.t('kb.new')),
            )
          : null,
      bottom: PreferredSize(
        preferredSize: const Size.fromHeight(60),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
          child: TextField(
            controller: _search,
            textInputAction: TextInputAction.search,
            decoration: InputDecoration(
              hintText: context.t('kb.searchHint'),
              prefixIcon: const Icon(Icons.search),
              isDense: true,
            ),
            onSubmitted: (v) =>
                ref.read(kbSearchProvider.notifier).state = v.trim(),
          ),
        ),
      ),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => ErrorView(
          message: describeError(e),
          onRetry: () => ref.invalidate(kbArticlesProvider),
        ),
        data: (articles) => RefreshIndicator(
          onRefresh: () async => ref.invalidate(kbArticlesProvider),
          child: articles.isEmpty
              ? ListView(children: [
                  EmptyState(
                    icon: Icons.menu_book_outlined,
                    title: context.t('kb.noneFound'),
                    subtitle: context.t('kb.tryDifferent'),
                  ),
                ])
              : ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: articles.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (context, i) => _ArticleCard(article: articles[i]),
                ),
        ),
      ),
    );
  }
}

class _ArticleCard extends StatelessWidget {
  final Article article;
  const _ArticleCard({required this.article});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return AppCard(
      onTap: () => Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => KbArticlePage(articleId: article.id)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(article.title,
                      style: theme.textTheme.titleMedium
                          ?.copyWith(fontWeight: FontWeight.w600)),
                ),
                if (!article.isPublished)
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: theme.colorScheme.tertiaryContainer,
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(context.t('kb.draft'),
                        style: theme.textTheme.labelSmall?.copyWith(
                            color: theme.colorScheme.onTertiaryContainer)),
                  ),
              ],
            ),
            if (article.excerpt.isNotEmpty) ...[
              const SizedBox(height: 6),
              Text(article.excerpt,
                  maxLines: 3,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.bodySmall
                      ?.copyWith(color: theme.colorScheme.outline)),
            ],
            const SizedBox(height: 10),
            Row(
              children: [
                if (article.category != null)
                  Chip(
                    label: Text(article.category!.name),
                    visualDensity: VisualDensity.compact,
                    materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                const Spacer(),
                if (article.attachmentCount > 0) ...[
                  Icon(Icons.attach_file,
                      size: 14, color: theme.colorScheme.outline),
                  const SizedBox(width: 2),
                  Text('${article.attachmentCount}',
                      style: theme.textTheme.bodySmall
                          ?.copyWith(color: theme.colorScheme.outline)),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }
}
