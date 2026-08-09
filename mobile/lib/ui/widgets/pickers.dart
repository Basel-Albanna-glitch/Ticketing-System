import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api_client.dart';
import '../../i18n/i18n.dart';
import '../../models/article.dart';
import '../../models/customer.dart';
import '../../state/providers.dart';
import '../theme.dart';

final _pickerCustomersProvider =
    FutureProvider.family<List<Customer>, String>((ref, query) async {
  final page =
      await ref.watch(ticketRepositoryProvider).customers(search: query);
  return page.results;
});

final _pickerArticlesProvider = FutureProvider<List<Article>>(
  (ref) => ref.watch(miscRepositoryProvider).articles(),
);

/// Searchable customer chooser. Searching server-side rather than filtering a
/// preloaded page means it still works with a real customer base.
Future<Customer?> showCustomerPicker(BuildContext context) {
  return showModalBottomSheet<Customer>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (_) => const _CustomerPicker(),
  );
}

class _CustomerPicker extends ConsumerStatefulWidget {
  const _CustomerPicker();

  @override
  ConsumerState<_CustomerPicker> createState() => _CustomerPickerState();
}

class _CustomerPickerState extends ConsumerState<_CustomerPicker> {
  final _search = TextEditingController();
  String _query = '';

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(_pickerCustomersProvider(_query));

    return SafeArea(
      child: Padding(
        padding:
            EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
              child: TextField(
                controller: _search,
                autofocus: true,
                textInputAction: TextInputAction.search,
                decoration: InputDecoration(
                  hintText: context.t('pickers.searchCustomers'),
                  prefixIcon: const Icon(Icons.search),
                  isDense: true,
                ),
                onSubmitted: (v) => setState(() => _query = v.trim()),
              ),
            ),
            Flexible(
              child: async.when(
                loading: () => const Padding(
                  padding: EdgeInsets.all(32),
                  child: Center(child: CircularProgressIndicator()),
                ),
                error: (e, _) => Padding(
                  padding: const EdgeInsets.all(16),
                  child: Text(describeError(e)),
                ),
                data: (customers) => customers.isEmpty
                    ? Padding(
                        padding: const EdgeInsets.all(24),
                        child: Text(context.t('pickers.noCustomers')),
                      )
                    : ListView.builder(
                        shrinkWrap: true,
                        itemCount: customers.length,
                        itemBuilder: (context, i) {
                          final c = customers[i];
                          return ListTile(
                            leading: CircleAvatar(child: Text(c.initials)),
                            title: Text(c.fullName),
                            subtitle: Text(
                                c.email.isEmpty ? '@${c.username}' : c.email),
                            onTap: () => Navigator.pop(context, c),
                          );
                        },
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Multi-select over the knowledge base. Returns the chosen ids, or null if
/// dismissed — the endpoint replaces the whole set, so the full list is needed.
Future<List<int>?> showArticlePicker(
  BuildContext context, {
  required Set<int> selected,
}) {
  return showModalBottomSheet<List<int>>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (_) => _ArticlePicker(initial: selected),
  );
}

class _ArticlePicker extends ConsumerStatefulWidget {
  final Set<int> initial;
  const _ArticlePicker({required this.initial});

  @override
  ConsumerState<_ArticlePicker> createState() => _ArticlePickerState();
}

class _ArticlePickerState extends ConsumerState<_ArticlePicker> {
  late final Set<int> _selected = {...widget.initial};

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(_pickerArticlesProvider);
    final theme = Theme.of(context);

    return SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
            child: Row(
              children: [
                Expanded(
                  child: Text(context.t('pickers.relatedArticles'),
                      style: theme.textTheme.titleSmall),
                ),
                Text('${_selected.length} selected',
                    style: theme.textTheme.bodySmall?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant)),
              ],
            ),
          ),
          Flexible(
            child: async.when(
              loading: () => const Padding(
                padding: EdgeInsets.all(32),
                child: Center(child: CircularProgressIndicator()),
              ),
              error: (e, _) => Padding(
                padding: const EdgeInsets.all(16),
                child: Text(describeError(e)),
              ),
              data: (articles) => articles.isEmpty
                  ? Padding(
                      padding: const EdgeInsets.all(24),
                      child: Text(context.t('pickers.noArticles')),
                    )
                  : ListView(
                      shrinkWrap: true,
                      children: [
                        for (final a in articles)
                          CheckboxListTile(
                            title: Text(a.title),
                            subtitle: a.category == null
                                ? null
                                : Text(a.category!.name),
                            value: _selected.contains(a.id),
                            onChanged: (v) => setState(() {
                              if (v == true) {
                                _selected.add(a.id);
                              } else {
                                _selected.remove(a.id);
                              }
                            }),
                          ),
                      ],
                    ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(AppSpacing.md),
            child: SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: () => Navigator.pop(context, _selected.toList()),
                child: Text(context.t('common.save')),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
