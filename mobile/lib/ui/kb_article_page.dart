import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../core/api_client.dart';
import '../i18n/i18n.dart';
import '../models/article.dart';
import '../state/providers.dart';
import 'forms/content_form_pages.dart';
import 'kb_list_page.dart';
import 'settings_page.dart';
import 'theme.dart';
import 'widgets/chips.dart';

final _articleProvider = FutureProvider.family<Article, int>(
  (ref, id) => ref.watch(miscRepositoryProvider).article(id),
);

class KbArticlePage extends ConsumerWidget {
  final int articleId;
  const KbArticlePage({super.key, required this.articleId});

  Future<void> _delete(BuildContext context, WidgetRef ref) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(dialogContext.t('kb.deleteConfirmTitle')),
        content: Text(dialogContext.t('kb.deleteConfirmBody')),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: Text(dialogContext.t('common.cancel')),
          ),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: Theme.of(dialogContext).colorScheme.error,
            ),
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: Text(dialogContext.t('common.delete')),
          ),
        ],
      ),
    );
    if (confirmed != true || !context.mounted) return;

    try {
      await ref.read(miscRepositoryProvider).deleteArticle(articleId);
      ref.invalidate(kbArticlesProvider);
      if (context.mounted) Navigator.of(context).pop();
    } catch (e) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(describeError(e)),
        backgroundColor: Theme.of(context).colorScheme.error,
      ));
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(_articleProvider(articleId));
    final theme = Theme.of(context);

    // Same rule as the "New article" button on the list, and as
    // ArticleViewSet.get_permissions: admins always, agents only once the
    // manage-knowledge-base permission is granted.
    final user = ref.watch(authProvider).user;
    final canManage = (user?.isAdmin ?? false) ||
        ((user?.isStaff ?? false) &&
            (ref.watch(ticketSettingsProvider).valueOrNull?[
                    'allow_agent_manage_kb'] ??
                false));
    final loaded = async.valueOrNull;

    return Scaffold(
      appBar: AppBar(
        title: Text(context.t('kb.article')),
        actions: [
          if (canManage && loaded != null) ...[
            IconButton(
              icon: const Icon(Icons.edit_outlined),
              tooltip: context.t('kb.edit'),
              onPressed: () async {
                final saved = await Navigator.of(context).push<bool>(
                  MaterialPageRoute(
                    builder: (_) => ArticleFormPage(article: loaded),
                  ),
                );
                if (saved == true) {
                  ref.invalidate(_articleProvider(articleId));
                  ref.invalidate(kbArticlesProvider);
                }
              },
            ),
            IconButton(
              icon: const Icon(Icons.delete_outline),
              tooltip: context.t('kb.deleteArticle'),
              onPressed: () => _delete(context, ref),
            ),
          ],
        ],
      ),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => ErrorView(
          message: describeError(e),
          onRetry: () => ref.invalidate(_articleProvider(articleId)),
        ),
        data: (article) => ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text(article.title,
                style: theme.textTheme.headlineSmall
                    ?.copyWith(fontWeight: FontWeight.w700)),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 6,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                if (article.category != null)
                  Chip(
                    label: Text(article.category!.name),
                    visualDensity: VisualDensity.compact,
                  ),
                if (article.authorName != null)
                  Text(article.authorName!,
                      style: theme.textTheme.bodySmall
                          ?.copyWith(color: theme.colorScheme.outline)),
                if (article.updatedAt != null)
                  Text('${context.t('kb.updatedOn')} '
                      '${DateFormat.yMMMd().format(article.updatedAt!)}',
                      style: theme.textTheme.bodySmall
                          ?.copyWith(color: theme.colorScheme.outline)),
              ],
            ),
            const SizedBox(height: 20),
            // The body is stored as plain text server-side, so it is rendered
            // as-is rather than parsed as markdown or HTML.
            SelectableText(article.body ?? '',
                style: theme.textTheme.bodyMedium?.copyWith(height: 1.5)),
            if (article.attachments.isNotEmpty) ...[
              const SizedBox(height: 24),
              Text(context.t('attachments.title'),
                  style: theme.textTheme.titleSmall
                      ?.copyWith(fontWeight: FontWeight.w700)),
              const SizedBox(height: 8),
              for (final a in article.attachments)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: AppCard(
                    child: ListTile(
                      leading: const Icon(Icons.insert_drive_file_outlined),
                      title: Text(a.filename,
                          maxLines: 1, overflow: TextOverflow.ellipsis),
                      subtitle: Text(a.readableSize),
                      // Opening the file needs a URL launcher / downloader,
                      // which is part of the attachments work still to come.
                      trailing: const Icon(Icons.download_outlined),
                      onTap: null,
                    ),
                  ),
                ),
            ],
          ],
        ),
      ),
    );
  }
}
