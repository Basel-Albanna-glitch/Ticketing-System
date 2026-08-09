import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../core/api_client.dart';
import '../i18n/i18n.dart';
import '../models/customer.dart';
import '../models/project.dart';
import '../state/providers.dart';
import 'customers_page.dart';
import 'forms/customer_form_page.dart';
import 'settings_page.dart';
import 'project_board_page.dart';
import 'theme.dart';
import 'widgets/chips.dart';

final _customerProvider = FutureProvider.family<Customer, int>(
  (ref, id) => ref.watch(ticketRepositoryProvider).customer(id),
);

class CustomerProfilePage extends ConsumerWidget {
  final int customerId;
  const CustomerProfilePage({super.key, required this.customerId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(_customerProvider(customerId));
    final theme = Theme.of(context);

    // Editing a customer is admin-only until the "edit customers" permission is
    // switched on, at which point agents may too — the same rule
    // CustomerViewSet.get_permissions enforces, and the same one the web's
    // CustomerProfilePage uses to show its Edit button. Creating and deleting
    // remain admin-only and stay on the web for now.
    final user = ref.watch(authProvider).user;
    final canEdit = (user?.isAdmin ?? false) ||
        (user?.role == 'agent' &&
            (ref.watch(ticketSettingsProvider).valueOrNull?[
                    'allow_agent_edit_customers'] ??
                false));
    final loaded = async.valueOrNull;

    return Scaffold(
      appBar: AppBar(
        title: Text(context.t('customers.customer')),
        actions: [
          if (canEdit && loaded != null)
            IconButton(
              icon: const Icon(Icons.edit_outlined),
              tooltip: context.t('customers.edit'),
              onPressed: () async {
                final saved = await Navigator.of(context).push<bool>(
                  MaterialPageRoute(
                    builder: (_) => CustomerFormPage(customer: loaded),
                  ),
                );
                if (saved == true) {
                  ref.invalidate(_customerProvider(customerId));
                  // The list screen shows name/email, so it goes stale too.
                  ref.invalidate(customersProvider);
                }
              },
            ),
        ],
      ),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => ErrorView(
          message: describeError(e),
          onRetry: () => ref.invalidate(_customerProvider(customerId)),
        ),
        data: (customer) => ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Row(
              children: [
                CircleAvatar(
                  radius: 32,
                  backgroundColor: theme.colorScheme.primaryContainer,
                  foregroundImage: customer.avatarUrl == null
                      ? null
                      : NetworkImage(customer.avatarUrl!),
                  child: Text(
                    customer.initials,
                    style: theme.textTheme.titleLarge?.copyWith(
                      color: theme.colorScheme.onPrimaryContainer,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(customer.fullName,
                          style: theme.textTheme.titleLarge
                              ?.copyWith(fontWeight: FontWeight.w700)),
                      Text('@${customer.username}',
                          style: theme.textTheme.bodySmall
                              ?.copyWith(color: theme.colorScheme.outline)),
                      if (!customer.isActive)
                        Padding(
                          padding: const EdgeInsets.only(top: 4),
                          child: Text(context.t('customers.inactive'),
                              style: theme.textTheme.labelSmall
                                  ?.copyWith(color: theme.colorScheme.error)),
                        ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),
            Row(
              children: [
                Expanded(
                  child: _Stat(
                      label: context.t('customers.totalTickets'),
                      value: '${customer.ticketCount}'),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _Stat(
                      label: context.t('customers.open'),
                      value: '${customer.openCount}'),
                ),
              ],
            ),
            const SizedBox(height: 16),
            _Section(
              title: context.t('customers.contact'),
              child: Column(
                children: [
                  _Row(label: context.t('customers.email'), value: customer.email),
                  _Row(label: context.t('customers.phone'), value: customer.phone),
                  _Row(label: context.t('customers.address'), value: customer.address),
                  _Row(
                      label: context.t('customers.taxNumber'),
                      value: customer.taxNumber),
                ],
              ),
            ),
            const SizedBox(height: 12),
            // Projects filed against this customer, gathered under the branch
            // each one is for. Projects with no branch fall under "No branch"
            // rather than disappearing, so the groups add up to the total.
            _CustomerProjects(customerId: customer.id),
            if (customer.branches.isNotEmpty) ...[
              const SizedBox(height: 12),
              _Section(
                title: '${context.t('customers.branches')} '
                    '(${customer.branches.length})',
                child: Column(
                  children: [
                    for (final b in customer.branches)
                      ListTile(
                        contentPadding: EdgeInsets.zero,
                        dense: true,
                        leading: const Icon(Icons.store_outlined),
                        title: Text(b.name),
                        subtitle: b.address.isEmpty ? null : Text(b.address),
                        trailing: Text('${b.ticketCount}',
                            style: theme.textTheme.labelLarge
                                ?.copyWith(color: theme.colorScheme.outline)),
                      ),
                  ],
                ),
              ),
            ],
            if (customer.licenses.isNotEmpty) ...[
              const SizedBox(height: 12),
              _Section(
                title: '${context.t('customers.licenses')} '
                    '(${customer.licenses.length})',
                child: Column(
                  children: [
                    for (final l in customer.licenses)
                      ListTile(
                        contentPadding: EdgeInsets.zero,
                        dense: true,
                        leading: Icon(
                          Icons.verified_outlined,
                          color: l.isExpired ? theme.colorScheme.error : null,
                        ),
                        title: Text(l.name),
                        subtitle: Text(_licencePeriod(l)),
                        trailing: l.isExpired
                            ? Text(context.t('customers.expired'),
                                style: theme.textTheme.labelSmall
                                    ?.copyWith(color: theme.colorScheme.error))
                            : null,
                      ),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  static String _licencePeriod(CustomerLicense l) {
    final f = DateFormat.yMMMd();
    final from = l.startDate == null ? '—' : f.format(l.startDate!);
    final to = l.endDate == null ? '—' : f.format(l.endDate!);
    return '$from → $to';
  }
}

class _Stat extends StatelessWidget {
  final String label;
  final String value;
  const _Stat({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return AppCard(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(value,
                style: theme.textTheme.headlineSmall
                    ?.copyWith(fontWeight: FontWeight.w700)),
            Text(label,
                style: theme.textTheme.bodySmall
                    ?.copyWith(color: theme.colorScheme.outline)),
          ],
        ),
      ),
    );
  }
}

class _Section extends StatelessWidget {
  final String title;
  final Widget child;
  const _Section({required this.title, required this.child});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return AppCard(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title,
                style: theme.textTheme.titleSmall
                    ?.copyWith(fontWeight: FontWeight.w700)),
            const SizedBox(height: 6),
            child,
          ],
        ),
      ),
    );
  }
}

class _Row extends StatelessWidget {
  final String label;
  final String value;
  const _Row({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 100,
            child: Text(label,
                style: theme.textTheme.bodySmall
                    ?.copyWith(color: theme.colorScheme.outline)),
          ),
          Expanded(
            child: Text(value.isEmpty ? '—' : value,
                style: theme.textTheme.bodyMedium),
          ),
        ],
      ),
    );
  }
}


/// A customer's projects, grouped by branch. Loaded separately from the profile
/// so a slow project list never delays the account details above it.
final _customerProjectsProvider =
    FutureProvider.family<List<Project>, int>((ref, customerId) {
  return ref.watch(miscRepositoryProvider).projects(customerId: customerId);
});

class _CustomerProjects extends ConsumerWidget {
  const _CustomerProjects({required this.customerId});

  final int customerId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final async = ref.watch(_customerProjectsProvider(customerId));

    return async.when(
      loading: () => const SizedBox.shrink(),
      error: (e, _) => const SizedBox.shrink(),
      data: (projects) {
        if (projects.isEmpty) {
          return _Section(
            title: context.t('customers.projects'),
            child: Text(context.t('customers.noProjects'),
                style: theme.textTheme.bodySmall
                    ?.copyWith(color: theme.colorScheme.outline)),
          );
        }

        // Preserve the order projects arrive in; group keys are branch names,
        // with a single bucket for those without one.
        final groups = <String, List<Project>>{};
        for (final p in projects) {
          final key = p.branchName ?? context.t('projects.noBranch');
          groups.putIfAbsent(key, () => []).add(p);
        }

        return _Section(
          title: '${context.t('customers.projects')} (${projects.length})',
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              for (final entry in groups.entries) ...[
                Padding(
                  padding: const EdgeInsets.only(top: 8, bottom: 4),
                  child: Text(
                    '${entry.key} (${entry.value.length})',
                    style: theme.textTheme.labelSmall?.copyWith(
                        color: theme.colorScheme.outline,
                        fontWeight: FontWeight.w700),
                  ),
                ),
                for (final p in entry.value)
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    dense: true,
                    leading: const Icon(Icons.view_kanban_outlined),
                    title: Text(p.name),
                    subtitle: Text(
                        '${p.doneTaskCount}/${p.taskCount} ${context.t('projects.tasksDone')}'),
                    trailing: Text(
                      context.t(p.isClosed
                          ? 'projects.statusClosed'
                          : 'projects.statusOpen'),
                      style: theme.textTheme.labelSmall
                          ?.copyWith(color: theme.colorScheme.outline),
                    ),
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => ProjectBoardPage(project: p),
                      ),
                    ),
                  ),
              ],
            ],
          ),
        );
      },
    );
  }
}
