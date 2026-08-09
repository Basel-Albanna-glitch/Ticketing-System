import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/api_client.dart';
import '../i18n/i18n.dart';
import '../i18n/labels.dart';
import '../models/customer.dart';
import '../models/paginated.dart';
import '../state/providers.dart';
import 'app_shell.dart';
import 'customer_profile_page.dart';
import 'forms/customer_form_page.dart';
import 'theme.dart';
import 'widgets/chips.dart';

final customerSearchProvider = StateProvider<String>((ref) => '');

final customersProvider = FutureProvider<Paginated<Customer>>((ref) {
  final search = ref.watch(customerSearchProvider);
  return ref.watch(ticketRepositoryProvider).customers(search: search);
});

/// Staff-only screen (agents and admins). The drawer hides it for customers and
/// CustomerViewSet rejects them server-side.
class CustomersPage extends ConsumerStatefulWidget {
  const CustomersPage({super.key});

  @override
  ConsumerState<CustomersPage> createState() => _CustomersPageState();
}

class _CustomersPageState extends ConsumerState<CustomersPage> {
  final _search = TextEditingController();

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(customersProvider);

    return ShellScaffold(
      title: context.t('customers.title'),
      // Creating customers is admin-only server-side, so agents get no button
      // rather than a button that always 403s.
      floatingActionButton: (ref.watch(authProvider).user?.isAdmin ?? false)
          ? FloatingActionButton.extended(
              onPressed: () async {
                final created = await Navigator.of(context).push<bool>(
                  MaterialPageRoute(builder: (_) => const CustomerFormPage()),
                );
                if (created == true) ref.invalidate(customersProvider);
              },
              icon: const Icon(Icons.person_add_alt_1),
              label: Text(context.t('customers.new')),
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
              hintText: context.t('customers.searchHint'),
              prefixIcon: const Icon(Icons.search),
              isDense: true,
            ),
            onSubmitted: (v) =>
                ref.read(customerSearchProvider.notifier).state = v.trim(),
          ),
        ),
      ),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => ErrorView(
          message: describeError(e),
          onRetry: () => ref.invalidate(customersProvider),
        ),
        data: (page) => RefreshIndicator(
          onRefresh: () async => ref.invalidate(customersProvider),
          child: page.results.isEmpty
              ? ListView(children: [
                  EmptyState(
                    icon: Icons.people_outline,
                    title: context.t('customers.noneFound'),
                    subtitle: context.t('kb.tryDifferent'),
                  ),
                ])
              : ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: page.results.length + 1,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (context, i) {
                    if (i == page.results.length) {
                      return Padding(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        child: Center(
                          child: Text(
                            context.tp('customers.showing', {
                              'shown': '${page.results.length}',
                              'total': '${page.count}',
                            }),
                            style: Theme.of(context)
                                .textTheme
                                .bodySmall
                                ?.copyWith(
                                    color:
                                        Theme.of(context).colorScheme.outline),
                          ),
                        ),
                      );
                    }
                    return _CustomerCard(customer: page.results[i]);
                  },
                ),
        ),
      ),
    );
  }
}

class _CustomerCard extends StatelessWidget {
  final Customer customer;
  const _CustomerCard({required this.customer});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return AppCard(
      onTap: () => Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => CustomerProfilePage(customerId: customer.id),
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            CircleAvatar(
              backgroundColor: theme.colorScheme.primaryContainer,
              foregroundImage: customer.avatarUrl == null
                  ? null
                  : NetworkImage(customer.avatarUrl!),
              child: Text(
                customer.initials,
                style: TextStyle(
                  color: theme.colorScheme.onPrimaryContainer,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(customer.fullName,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: theme.textTheme.titleSmall
                                ?.copyWith(fontWeight: FontWeight.w600)),
                      ),
                      if (!customer.isActive)
                        Text(context.t('customers.inactiveShort'),
                            style: theme.textTheme.labelSmall
                                ?.copyWith(color: theme.colorScheme.error)),
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(
                    customer.email.isEmpty
                        ? '@${customer.username}'
                        : customer.email,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.bodySmall
                        ?.copyWith(color: theme.colorScheme.outline),
                  ),
                  const SizedBox(height: 6),
                  Wrap(
                    spacing: 6,
                    children: [
                      _Count(
                          label: context.t('customers.ticketsCount'),
                          value: customer.ticketCount),
                      if (customer.openCount > 0)
                        _Count(
                            label: context.t('customers.openCount'),
                            value: customer.openCount),
                      if (customer.branches.isNotEmpty)
                        _Count(
                            label: context.t('customers.branchesCount'),
                            value: customer.branches.length),
                    ],
                  ),
                ],
              ),
            ),
            Icon(forwardChevron(context), color: theme.colorScheme.outline),
          ],
        ),
      ),
    );
  }
}

class _Count extends StatelessWidget {
  final String label;
  final int value;
  const _Count({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Text('$value $label',
        style: theme.textTheme.labelSmall
            ?.copyWith(color: theme.colorScheme.outline));
  }
}
