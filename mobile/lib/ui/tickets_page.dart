import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../i18n/i18n.dart';
import '../i18n/labels.dart';
import '../models/ticket.dart';
import '../state/providers.dart';
import '../state/ticket_list_controller.dart';
import 'app_shell.dart';
import 'new_ticket_page.dart';
import 'theme.dart';
import 'ticket_detail_page.dart';
import 'widgets/chips.dart';

/// The ticket list, shared by both roles.
///
/// The rows differ — a customer cares who is handling their ticket, an agent
/// cares who raised it — but the query, paging and filtering are identical
/// because the server scopes the queryset by role.
class TicketsPage extends ConsumerStatefulWidget {
  const TicketsPage({super.key});

  @override
  ConsumerState<TicketsPage> createState() => _TicketsPageState();
}

class _TicketsPageState extends ConsumerState<TicketsPage> {
  final _scroll = ScrollController();
  final _search = TextEditingController();

  @override
  void initState() {
    super.initState();
    _scroll.addListener(() {
      if (_scroll.position.pixels >= _scroll.position.maxScrollExtent - 300) {
        ref.read(ticketListProvider.notifier).loadMore();
      }
    });
  }

  @override
  void dispose() {
    _scroll.dispose();
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(ticketListProvider);
    final controller = ref.read(ticketListProvider.notifier);
    final user = ref.watch(authProvider).user;
    final isStaff = user?.isStaff ?? false;

    return ShellScaffold(
      title: context.t(isStaff ? 'tickets.queue' : 'tickets.mine'),
      bottom: PreferredSize(
          preferredSize: const Size.fromHeight(104),
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                child: TextField(
                  controller: _search,
                  textInputAction: TextInputAction.search,
                  decoration: InputDecoration(
                    hintText: isStaff
                        ? context.t('tickets.searchStaff')
                        : context.t('tickets.searchMine'),
                    prefixIcon: const Icon(Icons.search),
                    isDense: true,
                    suffixIcon: _search.text.isEmpty
                        ? null
                        : IconButton(
                            icon: const Icon(Icons.close),
                            onPressed: () {
                              _search.clear();
                              controller.setFilter(
                                  state.filter.copyWith(search: ''));
                            },
                          ),
                  ),
                  onSubmitted: (v) =>
                      controller.setFilter(state.filter.copyWith(search: v)),
                ),
              ),
              SizedBox(
                height: 44,
                child: ListView(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  children: [
                    if (isStaff)
                      Padding(
                        padding: const EdgeInsetsDirectional.only(end: 8),
                        child: FilterChip(
                          label: Text(context.t('tickets.assignedToMe')),
                          selected: state.filter.mineOnly,
                          onSelected: (v) => controller
                              .setFilter(state.filter.copyWith(mineOnly: v)),
                        ),
                      ),
                    for (final s in TicketStatus.all)
                      Padding(
                        padding: const EdgeInsetsDirectional.only(end: 8),
                        child: FilterChip(
                          label: Text(statusLabel(context, s)),
                          selected: state.filter.status == s,
                          onSelected: (selected) => controller.setFilter(
                            selected
                                ? state.filter.copyWith(status: s)
                                : state.filter.copyWith(clearStatus: true),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
      // Every role can raise a ticket — staff simply have to nominate the
      // customer it belongs to.
      floatingActionButton: user == null
          ? null
          : FloatingActionButton.extended(
              onPressed: () async {
                final created = await Navigator.of(context).push<bool>(
                  MaterialPageRoute(builder: (_) => const NewTicketPage()),
                );
                if (created == true) controller.refresh();
              },
              icon: const Icon(Icons.add),
              label: Text(context.t('tickets.new')),
            ),
      body: _body(state, controller, isStaff),
    );
  }

  Widget _body(
      TicketListState state, TicketListController controller, bool isStaff) {
    if (state.loading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (state.error != null && state.tickets.isEmpty) {
      return ErrorView(message: state.error!, onRetry: controller.refresh);
    }
    if (state.tickets.isEmpty) {
      return RefreshIndicator(
        onRefresh: controller.refresh,
        child: ListView(
          children: [
            EmptyState(
              icon: Icons.inbox_outlined,
              title: context.t('tickets.noMatch'),
              subtitle: context.t('tickets.noMatchHint'),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: controller.refresh,
      child: ListView.separated(
        controller: _scroll,
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 96),
        itemCount: state.tickets.length + (state.hasMore ? 1 : 0),
        separatorBuilder: (_, __) => const SizedBox(height: 10),
        itemBuilder: (context, index) {
          if (index >= state.tickets.length) {
            return const Padding(
              padding: EdgeInsets.all(16),
              child: Center(child: CircularProgressIndicator()),
            );
          }
          return _TicketCard(
            ticket: state.tickets[index],
            isStaff: isStaff,
            onTap: () async {
              await Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) =>
                      TicketDetailPage(ticketId: state.tickets[index].id),
                ),
              );
              controller.refresh();
            },
          );
        },
      ),
    );
  }
}

class _TicketCard extends StatelessWidget {
  final Ticket ticket;
  final bool isStaff;
  final VoidCallback onTap;

  const _TicketCard({
    required this.ticket,
    required this.isStaff,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final subtitle = isStaff
        ? ticket.requesterName
        : (ticket.assignedAgent?.fullName ?? context.t('tickets.waitingAssign'));

    return AppCard(
      onTap: onTap,
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Status is the first thing you scan for, so it also reads as a
            // colour bar down the leading edge of the row.
            Container(
              width: 4,
              decoration: BoxDecoration(
                color: statusColor(ticket.status, theme.colorScheme),
                borderRadius: const BorderRadius.horizontal(
                  left: Radius.circular(AppRadius.card),
                ),
              ),
            ),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            ticket.reference,
                            style: theme.textTheme.labelSmall?.copyWith(
                              color: theme.colorScheme.onSurfaceVariant,
                            ),
                          ),
                        ),
                        PriorityChip(ticket.priority),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      ticket.subject,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.titleMedium,
                    ),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        StatusChip(ticket.status,
                            assigned: ticket.isAssigned),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            subtitle,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: theme.textTheme.bodySmall?.copyWith(
                                color: theme.colorScheme.onSurfaceVariant),
                          ),
                        ),
                        if (ticket.createdAt != null)
                          Text(
                            DateFormat.MMMd().format(ticket.createdAt!),
                            style: theme.textTheme.bodySmall?.copyWith(
                                color: theme.colorScheme.onSurfaceVariant),
                          ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
