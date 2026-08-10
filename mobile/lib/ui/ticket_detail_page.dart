import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../core/api_client.dart';
import '../i18n/i18n.dart';
import '../i18n/labels.dart';
import '../models/customer.dart';
import '../models/ticket.dart';
import '../models/user.dart';
import '../state/permissions.dart';
import '../state/providers.dart';
import '../state/ticket_list_controller.dart';
import 'kb_article_page.dart';
import 'theme.dart';
import 'widgets/chips.dart';
import 'widgets/pickers.dart';

final _activityProvider = FutureProvider.family<List<TicketActivity>, int>(
  (ref, id) => ref.watch(ticketRepositoryProvider).activity(id),
);

final _agentsProvider = FutureProvider<List<AppUser>>(
  (ref) => ref.watch(ticketRepositoryProvider).agents(),
);

class TicketDetailPage extends ConsumerStatefulWidget {
  final int ticketId;
  const TicketDetailPage({super.key, required this.ticketId});

  @override
  ConsumerState<TicketDetailPage> createState() => _TicketDetailPageState();
}

class _TicketDetailPageState extends ConsumerState<TicketDetailPage> {
  final _comment = TextEditingController();
  bool _sending = false;

  @override
  void dispose() {
    _comment.dispose();
    super.dispose();
  }

  void _reload() {
    ref.invalidate(ticketDetailProvider(widget.ticketId));
    ref.invalidate(_activityProvider(widget.ticketId));
  }

  void _toast(String message, {bool error = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(message),
      backgroundColor: error ? Theme.of(context).colorScheme.error : null,
    ));
  }

  /// Runs a mutation and surfaces the server's own message on failure — the API
  /// returns meaningful 400/403 bodies (permission rules, closed-ticket lock,
  /// "assign before changing status") that are worth showing verbatim.
  Future<void> _run(Future<void> Function() action, String success) async {
    try {
      await action();
      _reload();
      _toast(success);
    } catch (e) {
      _toast(describeError(e), error: true);
    }
  }

  Future<void> _addComment() async {
    final body = _comment.text.trim();
    if (body.isEmpty) return;
    setState(() => _sending = true);
    try {
      await ref.read(ticketRepositoryProvider).addComment(widget.ticketId, body);
      if (!mounted) return;
      _comment.clear();
      FocusScope.of(context).unfocus();
      _reload();
    } catch (e) {
      _toast(describeError(e), error: true);
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<String?> _promptText(String title, {String? initial}) {
    final controller = TextEditingController(text: initial);
    return showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(title),
        content: TextField(controller: controller, autofocus: true, maxLines: 3),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context),
              child: Text(context.t('common.cancel'))),
          FilledButton(
            onPressed: () => Navigator.pop(context, controller.text),
            child: Text(context.t('common.save')),
          ),
        ],
      ),
    );
  }

  Future<void> _changeStatus(Ticket ticket, TicketPermissions perms) async {
    final selected = await showModalBottomSheet<String>(
      context: context,
      showDragHandle: true,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            for (final s in perms.selectableStatuses)
              ListTile(
                leading: StatusChip(s, assigned: ticket.isAssigned),
                title:
                    Text(statusLabel(context, s, assigned: ticket.isAssigned)),
                selected: s == ticket.status,
                onTap: () => Navigator.pop(context, s),
              ),
          ],
        ),
      ),
    );
    if (selected == null || selected == ticket.status) return;
    if (!mounted) return;

    String? holdReason;
    if (selected == TicketStatus.onHold) {
      // The server rejects on_hold without a reason, so collect it up front.
      holdReason = await _promptText(context.t('ticket.whyOnHold'));
      if (holdReason == null || holdReason.trim().isEmpty) return;
    }
    // The hold-reason prompt is a second await, so re-check before reading
    // context again for the toast text.
    if (!mounted) return;

    await _run(
      () => ref.read(ticketRepositoryProvider).setStatus(
            ticket.id,
            selected,
            holdReason: holdReason,
          ),
      context.tp('ticket.statusSetTo',
          {'status': statusLabel(context, selected)}),
    );
  }

  Future<void> _assign(Ticket ticket, TicketPermissions perms) async {
    final agents = await ref.read(_agentsProvider.future);
    if (!mounted) return;
    final currentUser = ref.read(authProvider).user;

    final picked = await showModalBottomSheet<Object?>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (context) => SafeArea(
        child: ListView(
          shrinkWrap: true,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
              child: Text(context.t('ticket.assignTo'),
                  style: const TextStyle(fontWeight: FontWeight.w700)),
            ),
            for (final a in agents)
              ListTile(
                leading: CircleAvatar(child: Text(a.initials)),
                title: Text(a.fullName),
                subtitle: a.id == currentUser?.id
                    ? Text(context.t('ticket.you'))
                    : null,
                selected: a.id == ticket.assignedAgent?.id,
                onTap: () => Navigator.pop(context, a),
              ),
            // Releasing a ticket is admin-only: the server explicitly refuses
            // "Agents cannot unassign tickets."
            if (perms.canUnassign) ...[
              const Divider(height: 1),
              ListTile(
                leading: const Icon(Icons.person_off_outlined),
                title: Text(context.t('tickets.unassign')),
                subtitle: Text(context.t('ticket.returnToQueue')),
                onTap: () => Navigator.pop(context, 'unassign'),
              ),
            ],
          ],
        ),
      ),
    );
    if (picked == null || !mounted) return;

    if (picked == 'unassign') {
      await _run(
        () => ref.read(ticketRepositoryProvider).assign(ticket.id, null),
        context.t('ticket.unassigned'),
      );
      return;
    }

    final agent = picked as AppUser;
    await _run(
      () => ref.read(ticketRepositoryProvider).assign(ticket.id, agent.id),
      context.tp('ticket.assignedTo', {'name': agent.fullName}),
    );
  }

  Future<void> _setDeadline(Ticket ticket) async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: ticket.dueAt ?? now.add(const Duration(days: 3)),
      firstDate: now.subtract(const Duration(days: 365)),
      lastDate: now.add(const Duration(days: 365 * 3)),
    );
    if (picked == null || !mounted) return;
    await _run(
      () => ref.read(ticketRepositoryProvider).setDeadline(ticket.id, picked),
      context.tp('ticket.deadlineSet',
          {'date': DateFormat.yMMMd().format(picked)}),
    );
  }

  Future<void> _editCollaborators(Ticket ticket) async {
    final agents = await ref.read(_agentsProvider.future);
    if (!mounted) return;
    final selected = ticket.collaborators.map((c) => c.id).toSet();

    final result = await showModalBottomSheet<Set<int>>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (context) => StatefulBuilder(
        builder: (context, setSheetState) => SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                child: Text(context.t('ticket.collaboratingAgents'),
                    style: const TextStyle(fontWeight: FontWeight.w700)),
              ),
              Flexible(
                child: ListView(
                  shrinkWrap: true,
                  children: [
                    for (final a in agents)
                      CheckboxListTile(
                        title: Text(a.fullName),
                        value: selected.contains(a.id),
                        onChanged: (v) => setSheetState(() {
                          if (v == true) {
                            selected.add(a.id);
                          } else {
                            selected.remove(a.id);
                          }
                        }),
                      ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(12),
                child: FilledButton(
                  onPressed: () => Navigator.pop(context, selected),
                  child: Text(context.t('common.save')),
                ),
              ),
            ],
          ),
        ),
      ),
    );
    if (result == null || !mounted) return;
    await _run(
      () => ref
          .read(ticketRepositoryProvider)
          .setCollaborators(ticket.id, result.toList()),
      context.t('ticket.collaboratorsUpdated'),
    );
  }

  Future<void> _editArticles(Ticket ticket) async {
    final picked = await showArticlePicker(
      context,
      selected: ticket.articles.map((a) => a.id).toSet(),
    );
    if (picked == null || !mounted) return;
    await _run(
      () => ref.read(ticketRepositoryProvider).setArticles(ticket.id, picked),
      context.t('ticket.articlesUpdated'),
    );
  }

  Future<void> _linkCustomer(Ticket ticket) async {
    final customer = await showCustomerPicker(context);
    if (customer == null || !mounted) return;

    // A branch can only be attached in the same call that links the customer,
    // so if this customer has branches, ask now rather than leaving the ticket
    // with no branch and no way to add one.
    int? branchId;
    if (customer.branches.isNotEmpty) {
      branchId = await showModalBottomSheet<int?>(
        context: context,
        showDragHandle: true,
        builder: (context) => SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 4),
                child: Text(context.t('ticket.whichBranch'),
                    style: Theme.of(context).textTheme.titleSmall),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                child: Text(
                  '${customer.fullName} has ${customer.branches.length} '
                  'branches.',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ),
              for (final b in customer.branches)
                ListTile(
                  leading: const Icon(Icons.store_outlined),
                  title: Text(b.name),
                  subtitle: b.address.isEmpty ? null : Text(b.address),
                  trailing: Text('${b.ticketCount}'),
                  onTap: () => Navigator.pop(context, b.id),
                ),
              const Divider(height: 1),
              ListTile(
                leading: const Icon(Icons.block),
                title: Text(context.t('ticket.noBranch')),
                onTap: () => Navigator.pop(context, -1),
              ),
            ],
          ),
        ),
      );
      // Dismissed without choosing — abort rather than silently linking with
      // no branch, which the user may not have intended.
      if (branchId == null) return;
      if (branchId == -1) branchId = null;
    }

    if (!mounted) return;
    await _run(
      () => ref.read(ticketRepositoryProvider).setCustomer(
            ticket.id,
            customer.id,
            branchId: branchId,
          ),
      context.tp('ticket.linkedTo', {'name': customer.fullName}),
    );
  }

  /// Change (or clear) the branch on a ticket that already has a customer.
  Future<void> _changeBranch(Ticket ticket) async {
    final customerId = ticket.customer?.id;
    if (customerId == null) return;

    // The ticket's nested customer carries no branches, so fetch the full
    // record to list them.
    final Customer customer;
    try {
      customer = await ref.read(ticketRepositoryProvider).customer(customerId);
    } catch (e) {
      _toast(describeError(e), error: true);
      return;
    }
    if (!mounted) return;

    if (customer.branches.isEmpty) {
      _toast('${customer.fullName} has no branches.');
      return;
    }

    final picked = await showModalBottomSheet<int>(
      context: context,
      showDragHandle: true,
      builder: (context) => SafeArea(
        child: ListView(
          shrinkWrap: true,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
              child: Text(context.t('tickets.branch'),
                  style: Theme.of(context).textTheme.titleSmall),
            ),
            for (final b in customer.branches)
              ListTile(
                leading: const Icon(Icons.store_outlined),
                title: Text(b.name),
                subtitle: b.address.isEmpty ? null : Text(b.address),
                trailing: Text('${b.ticketCount}'),
                selected: b.name == ticket.branchName,
                onTap: () => Navigator.pop(context, b.id),
              ),
            const Divider(height: 1),
            ListTile(
              leading: const Icon(Icons.block),
              title: Text(context.t('ticket.noBranch')),
              onTap: () => Navigator.pop(context, -1),
            ),
          ],
        ),
      ),
    );
    if (picked == null || !mounted) return;

    await _run(
      () => ref
          .read(ticketRepositoryProvider)
          .setBranch(ticket.id, picked == -1 ? null : picked),
      context.t(picked == -1
          ? 'ticket.branchCleared'
          : 'ticket.branchUpdated'),
    );
  }

  Future<void> _unlinkCustomer(Ticket ticket) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(context.t('ticket.unlinkTitle')),
        content: Text(
          context.t('ticket.unlinkBody'),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: Text(context.t('common.cancel'))),
          FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: Text(context.t('ticket.unlink'))),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    await _run(
      () => ref.read(ticketRepositoryProvider).setCustomer(ticket.id, null),
      context.t('ticket.customerUnlinked'),
    );
  }

  Future<void> _confirmDelete(Ticket ticket) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(context.t('ticket.deleteTitle')),
        content: Text(
          context.tp(
              'ticket.deleteBody', {'ref': ticket.reference}),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: Text(context.t('common.cancel'))),
          FilledButton(
            style: FilledButton.styleFrom(
                backgroundColor: Theme.of(context).colorScheme.error),
            onPressed: () => Navigator.pop(context, true),
            child: Text(context.t('common.delete')),
          ),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await ref.read(ticketRepositoryProvider).deleteTicket(ticket.id);
      if (!mounted) return;
      Navigator.of(context).pop();
      _toast('${ticket.reference} deleted');
    } catch (e) {
      _toast(describeError(e), error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(ticketDetailProvider(widget.ticketId));
    final user = ref.watch(authProvider).user;
    final isStaff = user?.isStaff ?? false;
    return Scaffold(
      appBar: AppBar(title: Text(context.t('ticket.title'))),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => ErrorView(message: describeError(e), onRetry: _reload),
        data: (ticket) {
          // Permissions come resolved on the signed-in user, so there is no
          // settings lookup here any more.
          final perms = TicketPermissions(user: user, ticket: ticket);
          return Column(
          children: [
            Expanded(
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  _Header(ticket: ticket),
                  if (perms.lockReason != null) ...[
                    const SizedBox(height: 12),
                    _LockBanner(message: perms.lockReason!),
                  ],
                  const SizedBox(height: 16),
                  if (isStaff) ...[
                    _StaffActions(
                      ticket: ticket,
                      perms: perms,
                      onStatus: () => _changeStatus(ticket, perms),
                      onAssign: () => _assign(ticket, perms),
                      onClaim: () => _run(
                        () => ref
                            .read(ticketRepositoryProvider)
                            .assign(ticket.id, user!.id),
                        context.t('ticket.assignedToYou'),
                      ),
                      onAddPhase: () async {
                        final body = await _promptText(context.t('ticket.logWorkPhase'));
                        if (body == null ||
                            body.trim().isEmpty ||
                            !context.mounted) {
                          return;
                        }
                        await _run(
                          () => ref
                              .read(ticketRepositoryProvider)
                              .addPhase(ticket.id, body.trim()),
                          context.t('ticket.phaseLogged'),
                        );
                      },
                    ),
                    const SizedBox(height: 16),
                    _ManagePanel(
                      ticket: ticket,
                      perms: perms,
                      onDeadline: () => _setDeadline(ticket),
                      onCollaborators: () => _editCollaborators(ticket),
                      onArticles: () => _editArticles(ticket),
                      onLinkCustomer: () => _linkCustomer(ticket),
                      onUnlinkCustomer: () => _unlinkCustomer(ticket),
                      onChangeBranch: () => _changeBranch(ticket),
                      onDelete: () => _confirmDelete(ticket),
                    ),
                    const SizedBox(height: 16),
                  ],
                  _Section(
                    title: context.t('tickets.description'),
                    child: Text(ticket.description ?? '—'),
                  ),
                  if (ticket.holdReason.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    _Section(
                        title: context.t('ticket.onHoldBecause'),
                        child: Text(ticket.holdReason)),
                  ],
                  if (ticket.isGuest && isStaff) ...[
                    const SizedBox(height: 12),
                    _Section(
                      title: context.t('ticket.guestContact'),
                      child: Column(
                        children: [
                          _KeyValue('Name', ticket.guestName),
                          if (ticket.guestCompany.isNotEmpty)
                            _KeyValue(context.t('guest.company'), ticket.guestCompany),
                          if (ticket.guestBranch.isNotEmpty)
                            _KeyValue(context.t('guest.branchName'), ticket.guestBranch),
                          _KeyValue(context.t('customers.phone'), ticket.guestPhone),
                          if (ticket.guestEmail.isNotEmpty)
                            _KeyValue('Email', ticket.guestEmail),
                        ],
                      ),
                    ),
                  ],
                  if (ticket.rating != null) ...[
                    const SizedBox(height: 12),
                    _Section(
                      title: context.t('ticket.customerRating'),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              for (var i = 1; i <= 5; i++)
                                Icon(
                                  i <= ticket.rating!
                                      ? Icons.star
                                      : Icons.star_border,
                                  size: 20,
                                  color: const Color(0xFFF59E0B),
                                ),
                            ],
                          ),
                          if (ticket.ratingComment.isNotEmpty) ...[
                            const SizedBox(height: 6),
                            Text(ticket.ratingComment),
                          ],
                        ],
                      ),
                    ),
                  ],
                  if (ticket.collaborators.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    _Section(
                      title: context.t('ticket.collaboratingAgents'),
                      child: Wrap(
                        spacing: 6,
                        runSpacing: 6,
                        children: [
                          for (final c in ticket.collaborators)
                            Chip(
                              avatar: CircleAvatar(
                                  child: Text(c.initials,
                                      style: const TextStyle(fontSize: 10))),
                              label: Text(c.fullName),
                              visualDensity: VisualDensity.compact,
                            ),
                        ],
                      ),
                    ),
                  ],
                  if (ticket.articles.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    _Section(
                      title: context.t('pickers.relatedArticles'),
                      child: Column(
                        children: [
                          for (final a in ticket.articles)
                            ListTile(
                              contentPadding: EdgeInsets.zero,
                              dense: true,
                              leading: const Icon(Icons.menu_book_outlined),
                              title: Text(a.title),
                              trailing: Icon(forwardChevron(context)),
                              onTap: () => Navigator.of(context).push(
                                MaterialPageRoute(
                                  builder: (_) => KbArticlePage(articleId: a.id),
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                  ],
                  if (ticket.phases.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    _Section(
                      title: context.t('ticket.workPhases'),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          for (final p in ticket.phases)
                            _Entry(
                                author: p.authorName,
                                body: p.body,
                                at: p.createdAt),
                        ],
                      ),
                    ),
                  ],
                  const SizedBox(height: 12),
                  _Section(
                    title: context.tp('guest.conversation',
                        {'count': '${ticket.comments.length}'}),
                    child: ticket.comments.isEmpty
                        ? Text(context.t('guest.noMessages'))
                        : Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              for (final c in ticket.comments)
                                _Entry(
                                    author: c.authorName,
                                    body: c.body,
                                    at: c.createdAt),
                            ],
                          ),
                  ),
                  const SizedBox(height: 12),
                  _ActivitySection(ticketId: ticket.id),
                ],
              ),
            ),
            if (perms.canComment)
              SafeArea(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(12, 4, 12, 8),
                  child: Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _comment,
                          minLines: 1,
                          maxLines: 4,
                          decoration: InputDecoration(
                              hintText: context.t('ticket.writeReply'),
                              isDense: true),
                        ),
                      ),
                      const SizedBox(width: 8),
                      IconButton.filled(
                        onPressed: _sending ? null : _addComment,
                        icon: _sending
                            ? const SizedBox(
                                height: 18,
                                width: 18,
                                child:
                                    CircularProgressIndicator(strokeWidth: 2))
                            : const Icon(Icons.send),
                      ),
                    ],
                  ),
                ),
              ),
          ],
          );
        },
      ),
    );
  }
}

/// Collapsed by default — the audit trail is long and rarely the reason someone
/// opens a ticket, so it is fetched only when expanded.
class _ActivitySection extends ConsumerStatefulWidget {
  final int ticketId;
  const _ActivitySection({required this.ticketId});

  @override
  ConsumerState<_ActivitySection> createState() => _ActivitySectionState();
}

class _ActivitySectionState extends ConsumerState<_ActivitySection> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return AppCard(
      child: Column(
        children: [
          ListTile(
            title: Text(context.t('ticket.activityHistory'),
                style: theme.textTheme.titleSmall
                    ?.copyWith(fontWeight: FontWeight.w700)),
            trailing:
                Icon(_expanded ? Icons.expand_less : Icons.expand_more),
            onTap: () => setState(() => _expanded = !_expanded),
          ),
          if (_expanded)
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
              child: ref.watch(_activityProvider(widget.ticketId)).when(
                    loading: () => const Padding(
                      padding: EdgeInsets.all(16),
                      child: Center(child: CircularProgressIndicator()),
                    ),
                    error: (e, _) => Text(describeError(e)),
                    data: (items) => items.isEmpty
                        ? Text(context.t('ticket.noActivity'))
                        : Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              for (final a in items)
                                Padding(
                                  padding: const EdgeInsets.only(bottom: 10),
                                  child: Row(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Padding(
                                        padding:
                                            const EdgeInsets.only(top: 5, right: 8),
                                        child: Container(
                                          width: 7,
                                          height: 7,
                                          decoration: BoxDecoration(
                                            shape: BoxShape.circle,
                                            color: theme.colorScheme.primary
                                                .withValues(alpha: 0.6),
                                          ),
                                        ),
                                      ),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.start,
                                          children: [
                                            Text(a.description,
                                                style:
                                                    theme.textTheme.bodyMedium),
                                            Text(
                                              [
                                                a.actorName,
                                                if (a.createdAt != null)
                                                  DateFormat.MMMd()
                                                      .add_jm()
                                                      .format(a.createdAt!),
                                              ].join(' · '),
                                              style: theme.textTheme.bodySmall
                                                  ?.copyWith(
                                                      color: theme
                                                          .colorScheme.outline),
                                            ),
                                          ],
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                            ],
                          ),
                  ),
            ),
        ],
      ),
    );
  }
}

class _Header extends StatelessWidget {
  final Ticket ticket;
  const _Header({required this.ticket});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(ticket.reference,
            style: theme.textTheme.labelMedium
                ?.copyWith(color: theme.colorScheme.outline)),
        const SizedBox(height: 4),
        Text(ticket.subject,
            style: theme.textTheme.headlineSmall
                ?.copyWith(fontWeight: FontWeight.w700)),
        const SizedBox(height: 12),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            StatusChip(ticket.status, assigned: ticket.isAssigned),
            PriorityChip(ticket.priority),
            if (ticket.category != null)
              Chip(
                  label: Text(ticket.category!.name),
                  visualDensity: VisualDensity.compact),
          ],
        ),
        const SizedBox(height: 12),
        _KeyValue(context.t('ticket.requester'), ticket.requesterName),
        // What the guest typed on the form. Kept even when a real branch is
        // linked below, since it is what they actually reported.
        if (ticket.guestBranch.isNotEmpty)
          _KeyValue(context.t('guest.branchName'), ticket.guestBranch),
        if (ticket.branchName != null) _KeyValue(context.t('tickets.branch'), ticket.branchName!),
        _KeyValue(context.t('tickets.assignee'),
            ticket.assignedAgent?.fullName ?? context.t('ticket.nobodyYet')),
        if (ticket.createdAt != null)
          _KeyValue(
              context.t('guest.opened'),
              DateFormat.yMMMd().add_jm().format(ticket.createdAt!)),
        if (ticket.dueAt != null)
          _KeyValue(context.t('ticket.due'),
              DateFormat.yMMMd().format(ticket.dueAt!)),
        if (ticket.resolvedAt != null)
          _KeyValue(context.t('tickets.status.resolved'),
              DateFormat.yMMMd().format(ticket.resolvedAt!)),
        if (ticket.closedAt != null)
          _KeyValue(context.t('ticket.closedAt'),
              DateFormat.yMMMd().format(ticket.closedAt!)),
      ],
    );
  }
}

class _KeyValue extends StatelessWidget {
  final String label;
  final String value;
  const _KeyValue(this.label, this.value);

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 110,
            child: Text(label,
                style: theme.textTheme.bodySmall
                    ?.copyWith(color: theme.colorScheme.outline)),
          ),
          Expanded(
              child: Text(value.isEmpty ? '—' : value,
                  style: theme.textTheme.bodyMedium)),
        ],
      ),
    );
  }
}

/// Explains why the ticket is read-only, instead of leaving greyed-out buttons
/// with no reason given.
class _LockBanner extends StatelessWidget {
  final String message;
  const _LockBanner({required this.message});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: theme.colorScheme.surfaceContainerHighest.withValues(alpha: 0.6),
        borderRadius: BorderRadius.circular(AppRadius.control),
        border: Border.all(color: theme.colorScheme.outlineVariant),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.lock_outline,
              size: 18, color: theme.colorScheme.onSurfaceVariant),
          const SizedBox(width: 10),
          Expanded(
            child: Text(message,
                style: theme.textTheme.bodySmall
                    ?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
          ),
        ],
      ),
    );
  }
}

class _StaffActions extends StatelessWidget {
  final Ticket ticket;
  final TicketPermissions perms;
  final VoidCallback onStatus;
  final VoidCallback onAssign;
  final VoidCallback onClaim;
  final VoidCallback onAddPhase;

  const _StaffActions({
    required this.ticket,
    required this.perms,
    required this.onStatus,
    required this.onAssign,
    required this.onClaim,
    required this.onAddPhase,
  });

  @override
  Widget build(BuildContext context) {
    final buttons = <Widget>[
      if (perms.canClaim)
        FilledButton.tonalIcon(
          onPressed: onClaim,
          icon: const Icon(Icons.person_add_alt),
          // Always "Claim": canClaim is false once the ticket has an owner.
          label: Text(context.t('tickets.claim')),
          style: FilledButton.styleFrom(minimumSize: const Size(0, 40)),
        ),
      if (perms.canAssignOthers)
        OutlinedButton.icon(
          onPressed: onAssign,
          icon: const Icon(Icons.people_alt_outlined),
          label: Text(context.t('tickets.assign')),
        ),
      if (perms.canEdit)
        OutlinedButton.icon(
          // Disabled rather than hidden while unassigned: the action exists,
          // it just needs an owner first, and the banner says so.
          onPressed: perms.canChangeStatus ? onStatus : null,
          icon: const Icon(Icons.swap_horiz),
          label: Text(context.t('tickets.status')),
        ),
      if (perms.canAddPhase)
        OutlinedButton.icon(
          onPressed: onAddPhase,
          icon: const Icon(Icons.timeline),
          label: Text(context.t('tickets.addPhase')),
        ),
    ];

    if (buttons.isEmpty) return const SizedBox.shrink();
    return Wrap(spacing: 8, runSpacing: 8, children: buttons);
  }
}

/// Everything staff can change about a ticket, in one visible panel.
///
/// These used to live behind an overflow menu, which hid the fact they existed
/// at all. Each row shows its current value, so the panel doubles as a summary.
class _ManagePanel extends StatelessWidget {
  final Ticket ticket;
  final TicketPermissions perms;
  final VoidCallback onDeadline;
  final VoidCallback onCollaborators;
  final VoidCallback onArticles;
  final VoidCallback onLinkCustomer;
  final VoidCallback onUnlinkCustomer;
  final VoidCallback onChangeBranch;
  final VoidCallback onDelete;

  const _ManagePanel({
    required this.ticket,
    required this.perms,
    required this.onDeadline,
    required this.onCollaborators,
    required this.onArticles,
    required this.onLinkCustomer,
    required this.onUnlinkCustomer,
    required this.onChangeBranch,
    required this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    // The server keeps guest contact details even after linking, so a ticket
    // that came in through the public form can always be re-linked or unlinked.
    final guestOrigin = ticket.guestPhone.isNotEmpty ||
        ticket.guestName.isNotEmpty ||
        ticket.guestEmail.isNotEmpty;

    // Each row is shown only when the corresponding action would be accepted;
    // a permanently-failing row is worse than an absent one.
    final rows = <Widget>[
      if (perms.canSetDeadline)
        _row(
          context,
          icon: Icons.event_outlined,
          label: context.t('ticket.dueDate'),
          value: ticket.dueAt == null
              ? context.t('ticket.notSet')
              : DateFormat.yMMMd().format(ticket.dueAt!),
          onTap: onDeadline,
        ),
      if (perms.canEditArticles)
        _row(
          context,
          icon: Icons.menu_book_outlined,
          label: context.t('tickets.relatedArticles'),
          value: ticket.articles.isEmpty
              ? context.t('common.none')
              : '${ticket.articles.length} linked',
          onTap: onArticles,
        ),
      if (perms.canEditCollaborators)
        _row(
          context,
          icon: Icons.groups_outlined,
          label: context.t('tickets.collaborators'),
          value: ticket.collaborators.isEmpty
              ? context.t('common.none')
              : ticket.collaborators.map((c) => c.fullName).join(', '),
          onTap: onCollaborators,
        ),
      if (guestOrigin && perms.canLinkCustomer)
        _row(
          context,
          icon: Icons.link,
          label: context.t('tickets.customer'),
          value: ticket.customer?.fullName ?? context.t('ticket.notLinked'),
          onTap:
              ticket.customer == null ? onLinkCustomer : onUnlinkCustomer,
          actionLabel: context
              .t(ticket.customer == null ? 'ticket.link' : 'ticket.unlink'),
        ),
      // A branch belongs to a customer, so this is only meaningful once one is
      // attached; the server rejects a branch without.
      if (ticket.customer != null && perms.canEdit)
        _row(
          context,
          icon: Icons.store_outlined,
          label: context.t('tickets.branch'),
          value: ticket.branchName ?? context.t('ticket.notSet'),
          onTap: onChangeBranch,
        ),
    ];

    if (rows.isEmpty && !perms.canDelete) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (rows.isNotEmpty) ...[
          SectionHeader(context.t('tickets.manage')),
          AppCard(
            child: Column(
              children: [
                for (var i = 0; i < rows.length; i++) ...[
                  if (i > 0) _divider(theme),
                  rows[i],
                ],
              ],
            ),
          ),
        ],
        if (perms.canDelete) ...[
          const SizedBox(height: AppSpacing.lg),
          SectionHeader(context.t('tickets.dangerZone')),
          AppCard(
            child: ListTile(
              leading:
                  Icon(Icons.delete_outline, color: theme.colorScheme.error),
              title: Text(context.t('tickets.deleteTicket'),
                  style: TextStyle(color: theme.colorScheme.error)),
              subtitle:
                  Text(context.t('ticket.deleteHint')),
              onTap: onDelete,
            ),
          ),
        ],
      ],
    );
  }

  Widget _divider(ThemeData theme) => Divider(
        height: 1,
        indent: 52,
        color: theme.colorScheme.outlineVariant,
      );

  Widget _row(
    BuildContext context, {
    required IconData icon,
    required String label,
    required String value,
    required VoidCallback onTap,
    String? actionLabel,
  }) {
    final theme = Theme.of(context);
    return ListTile(
      leading: Icon(icon, size: 20, color: theme.colorScheme.onSurfaceVariant),
      title: Text(label, style: theme.textTheme.bodyMedium),
      subtitle: Text(
        value,
        maxLines: 2,
        overflow: TextOverflow.ellipsis,
        style: theme.textTheme.bodySmall
            ?.copyWith(color: theme.colorScheme.onSurfaceVariant),
      ),
      trailing: actionLabel == null
          ? Icon(forwardChevron(context), color: theme.colorScheme.outline)
          : Text(actionLabel,
              style: theme.textTheme.labelLarge
                  ?.copyWith(color: theme.colorScheme.primary)),
      onTap: onTap,
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
            const SizedBox(height: 8),
            child,
          ],
        ),
      ),
    );
  }
}

class _Entry extends StatelessWidget {
  final String author;
  final String body;
  final DateTime? at;

  const _Entry({required this.author, required this.body, this.at});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(author,
                  style: theme.textTheme.labelLarge
                      ?.copyWith(fontWeight: FontWeight.w600)),
              const SizedBox(width: 8),
              if (at != null)
                Text(DateFormat.MMMd().add_jm().format(at!),
                    style: theme.textTheme.bodySmall
                        ?.copyWith(color: theme.colorScheme.outline)),
            ],
          ),
          const SizedBox(height: 2),
          Text(body),
        ],
      ),
    );
  }
}
