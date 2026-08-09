import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../core/api_client.dart';
import '../../i18n/i18n.dart';
import '../../models/guest_ticket.dart';
import '../../models/ticket.dart';
import '../../state/providers.dart';
import '../theme.dart';
import '../widgets/chips.dart';
import 'guest_ticket_page.dart';

/// The four stages shown in the progress stepper, mirroring TRACK_STEPS in
/// frontend/src/pages/GuestTrackPage.jsx.
// Labels are keys, resolved per build so the tracker relabels with the app.
const _steps = <({String key, String labelKey, IconData icon})>[
  (key: 'submitted', labelKey: 'guest.submitted', icon: Icons.inbox_outlined),
  (key: 'in_progress', labelKey: 'guest.inProgress', icon: Icons.schedule),
  (key: 'resolved',
      labelKey: 'guest.resolvedStep',
      icon: Icons.check_circle_outline),
  (key: 'closed', labelKey: 'guest.closedStep', icon: Icons.verified_outlined),
];

/// How far along the stepper a status sits. Everything is at least "submitted",
/// and on_hold pauses at the in-progress stage rather than adding a fifth step.
int _stepIndexFor(String status) => switch (status) {
      TicketStatus.open => 0,
      TicketStatus.inProgress || TicketStatus.onHold => 1,
      TicketStatus.resolved => 2,
      TicketStatus.closed => 3,
      _ => 0,
    };

String _timeAgo(BuildContext context, DateTime when) {
  final diff = DateTime.now().difference(when);
  if (diff.inSeconds < 60) return context.t('guest.justNow');
  if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
  if (diff.inHours < 24) return '${diff.inHours}h ago';
  return '${diff.inDays}d ago';
}

/// Public ticket tracker — the app's equivalent of /guest/track.
///
/// A guest has no session: reference + phone are re-sent on every call, so both
/// are held in memory for the refresh, reply and rating actions.
class GuestTrackPage extends ConsumerStatefulWidget {
  final String? initialReference;
  final String? initialPhone;

  const GuestTrackPage({
    super.key,
    this.initialReference,
    this.initialPhone,
  });

  @override
  ConsumerState<GuestTrackPage> createState() => _GuestTrackPageState();
}

class _GuestTrackPageState extends ConsumerState<GuestTrackPage> {
  late final _reference =
      TextEditingController(text: widget.initialReference ?? '');
  late final _phone = TextEditingController(text: widget.initialPhone ?? '');
  final _reply = TextEditingController();

  GuestTicket? _ticket;
  DateTime? _checkedAt;
  bool _loading = false;
  bool _sending = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    if ((widget.initialReference ?? '').isNotEmpty &&
        (widget.initialPhone ?? '').isNotEmpty) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _track());
    }
  }

  @override
  void dispose() {
    _reference.dispose();
    _phone.dispose();
    _reply.dispose();
    super.dispose();
  }

  Future<void> _track({bool silent = false}) async {
    final reference = _reference.text.trim();
    final phone = _phone.text.trim();
    if (reference.isEmpty || phone.isEmpty) {
      setState(() => _error = context.t('guest.enterBoth'));
      return;
    }
    if (!silent) setState(() => _loading = true);
    setState(() => _error = null);
    try {
      final ticket = await ref
          .read(guestRepositoryProvider)
          .track(reference: reference, phone: phone);
      if (!mounted) return;
      setState(() {
        _ticket = ticket;
        _checkedAt = DateTime.now();
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = describeError(e);
      });
    }
  }

  Future<void> _sendReply() async {
    final body = _reply.text.trim();
    if (body.isEmpty) return;
    setState(() => _sending = true);
    try {
      await ref.read(guestRepositoryProvider).reply(
            reference: _reference.text.trim(),
            phone: _phone.text.trim(),
            body: body,
          );
      _reply.clear();
      await _track(silent: true);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(describeError(e)),
        backgroundColor: Theme.of(context).colorScheme.error,
      ));
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _rate() async {
    var score = 5;
    final comment = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: Text(context.t('guest.rateTitle')),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  for (var i = 1; i <= 5; i++)
                    IconButton(
                      icon: Icon(i <= score ? Icons.star : Icons.star_border,
                          color: const Color(0xFFF59E0B)),
                      onPressed: () => setDialogState(() => score = i),
                    ),
                ],
              ),
              TextField(
                controller: comment,
                maxLines: 3,
                decoration:
                    InputDecoration(
                    labelText: context.t('guest.commentOptional')),
              ),
            ],
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(context, false),
                child: Text(context.t('common.cancel'))),
            FilledButton(
                onPressed: () => Navigator.pop(context, true),
                child: Text(context.t('guest.submit'))),
          ],
        ),
      ),
    );
    if (ok != true) return;
    try {
      await ref.read(guestRepositoryProvider).rate(
            reference: _reference.text.trim(),
            phone: _phone.text.trim(),
            score: score,
            comment: comment.text.trim(),
          );
      await _track(silent: true);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(describeError(e)),
        backgroundColor: Theme.of(context).colorScheme.error,
      ));
    }
  }

  @override
  Widget build(BuildContext context) {
    final ticket = _ticket;

    return Scaffold(
      appBar: AppBar(title: Text(context.t('guest.trackTitle'))),
      body: Column(
        children: [
          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(AppSpacing.lg),
              children: [
                if (ticket == null) ..._searchSection() else ..._ticketSection(ticket),
              ],
            ),
          ),
          if (ticket != null) _replyBar(),
        ],
      ),
    );
  }

  // --- Search ---------------------------------------------------------------

  List<Widget> _searchSection() {
    final theme = Theme.of(context);
    return [
      Text(
        context.t('guest.trackIntro'),
        style: theme.textTheme.bodyMedium
            ?.copyWith(color: theme.colorScheme.onSurfaceVariant),
      ),
      const SizedBox(height: AppSpacing.lg),
      AppCard(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          children: [
            TextField(
              controller: _reference,
              decoration: InputDecoration(
                labelText: context.t('guest.referenceNumber'),
                hintText: context.t('guest.referenceHint'),
                // The server accepts the full serial or a bare numeric id, and
                // the status emails quote the plain id — so say both.
                helperText: context.t('guest.referenceHelp'),
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            TextField(
              controller: _phone,
              keyboardType: TextInputType.phone,
              decoration: InputDecoration(
                  labelText: context.t('guest.phoneNumber')),
            ),
            const SizedBox(height: AppSpacing.lg),
            GradientButton(
              onPressed: _loading ? null : _track,
              icon: Icons.search,
              child: _loading
                  ? const SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: Colors.white))
                  : Text(context.t('guest.trackButton')),
            ),
          ],
        ),
      ),
      if (_error != null) ...[
        const SizedBox(height: AppSpacing.lg),
        Text(_error!,
            textAlign: TextAlign.center,
            style: TextStyle(color: theme.colorScheme.error)),
      ],
      const SizedBox(height: AppSpacing.xl),
      Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text("Don't have a ticket yet?",
              style: theme.textTheme.bodySmall
                  ?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
          TextButton(
            onPressed: () => Navigator.of(context).pushReplacement(
              MaterialPageRoute(builder: (_) => const GuestTicketPage()),
            ),
            child: Text(context.t('guest.submitOne')),
          ),
        ],
      ),
    ];
  }

  // --- Ticket ---------------------------------------------------------------

  List<Widget> _ticketSection(GuestTicket ticket) {
    final theme = Theme.of(context);
    // Older tickets may have no serial, so fall back to #id — the same thing
    // the web tracker does.
    final label =
        ticket.reference.isNotEmpty ? ticket.reference : '#${ticket.id}';

    return [
      // Collapsed search bar: what is being tracked, with a way back.
      Row(
        children: [
          Expanded(
            child: Text(context.tp('guest.tracking', {'ref': label}),
                style: theme.textTheme.bodySmall
                    ?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
          ),
          TextButton(
            onPressed: () => setState(() {
              _ticket = null;
              _error = null;
            }),
            child: Text(context.t('guest.change')),
          ),
        ],
      ),
      const SizedBox(height: AppSpacing.sm),
      Text(ticket.subject, style: theme.textTheme.headlineSmall),
      const SizedBox(height: AppSpacing.md),
      Row(
        children: [
          StatusChip(ticket.status, assigned: ticket.isAssigned),
          const Spacer(),
          TextButton.icon(
            onPressed: () => _track(silent: true),
            icon: const Icon(Icons.refresh, size: 16),
            label: Text(
              _checkedAt == null
                  ? context.t('guest.refresh')
                  : context.tp(
                      'guest.checkedAgo', {'ago': _timeAgo(context, _checkedAt!)}),
              style: theme.textTheme.bodySmall,
            ),
          ),
        ],
      ),
      const SizedBox(height: AppSpacing.lg),
      _Stepper(status: ticket.status),
      const SizedBox(height: AppSpacing.lg),
      AppCard(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Wrap(
          runSpacing: AppSpacing.md,
          children: [
            _MetaCell(
              icon: Icons.folder_outlined,
              label: context.t('tickets.category'),
              value: ticket.category.isEmpty ? '—' : ticket.category,
            ),
            _MetaCell(
              icon: Icons.flag_outlined,
              label: context.t('tickets.priority'),
              value: ticket.priorityDisplay.isEmpty
                  ? '—'
                  : ticket.priorityDisplay,
            ),
            _MetaCell(
              icon: Icons.person_outline,
              label: context.t('guest.handledBy'),
              value: ticket.isAssigned
                  ? (ticket.assignedAgentName.isEmpty
                      ? context.t('tickets.assigned')
                      : ticket.assignedAgentName)
                  : context.t('guest.awaitingAgent'),
            ),
            _MetaCell(
              icon: Icons.event_outlined,
              label: context.t('guest.opened'),
              value: ticket.createdAt == null
                  ? '—'
                  : DateFormat.yMMMd().format(ticket.createdAt!),
            ),
          ],
        ),
      ),
      if (ticket.holdReason.isNotEmpty) ...[
        const SizedBox(height: AppSpacing.md),
        AppCard(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(Icons.pause_circle_outline,
                  size: 18, color: priorityColor(TicketPriority.high)),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(context.t('guest.onHold'),
                        style: theme.textTheme.titleSmall),
                    const SizedBox(height: 2),
                    Text(ticket.holdReason),
                  ],
                ),
              ),
            ],
          ),
        ),
      ],
      const SizedBox(height: AppSpacing.md),
      AppCard(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(context.t('tickets.description'),
                style: theme.textTheme.titleSmall),
            const SizedBox(height: AppSpacing.sm),
            Text(ticket.description),
          ],
        ),
      ),
      const SizedBox(height: AppSpacing.md),
      AppCard(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
                context.tp('guest.conversation',
                    {'count': '${ticket.comments.length}'}),
                style: theme.textTheme.titleSmall),
            const SizedBox(height: AppSpacing.sm),
            if (ticket.comments.isEmpty)
              Text(context.t('guest.noMessages'),
                  style: theme.textTheme.bodySmall
                      ?.copyWith(color: theme.colorScheme.onSurfaceVariant))
            else
              for (final c in ticket.comments)
                Padding(
                  padding: const EdgeInsets.only(bottom: AppSpacing.md),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Text(c.authorName,
                              style: theme.textTheme.labelLarge),
                          const SizedBox(width: 6),
                          if (c.isStaff)
                            Pill(
                                label: context.t('guest.support'),
                                color: const Color(0xFF4F46E5)),
                          const Spacer(),
                          if (c.createdAt != null)
                            Text(DateFormat.MMMd().format(c.createdAt!),
                                style: theme.textTheme.bodySmall?.copyWith(
                                    color: theme.colorScheme.onSurfaceVariant)),
                        ],
                      ),
                      const SizedBox(height: 2),
                      Text(c.body),
                    ],
                  ),
                ),
          ],
        ),
      ),
      if (ticket.status == TicketStatus.closed && ticket.rating == null) ...[
        const SizedBox(height: AppSpacing.md),
        OutlinedButton.icon(
          onPressed: _rate,
          icon: const Icon(Icons.star_border, size: 18),
          label: Text(context.t('guest.rateTitle')),
        ),
      ],
      if (ticket.rating != null) ...[
        const SizedBox(height: AppSpacing.md),
        AppCard(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Row(
            children: [
              Text(context.t('guest.yourRating'),
                  style: theme.textTheme.titleSmall),
              const Spacer(),
              for (var i = 1; i <= 5; i++)
                Icon(i <= ticket.rating! ? Icons.star : Icons.star_border,
                    size: 18, color: const Color(0xFFF59E0B)),
            ],
          ),
        ),
      ],
      const SizedBox(height: AppSpacing.lg),
    ];
  }

  Widget _replyBar() {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 4, 12, 8),
        child: Row(
          children: [
            Expanded(
              child: TextField(
                controller: _reply,
                minLines: 1,
                maxLines: 4,
                decoration: InputDecoration(
                    hintText: context.t('ticket.writeReply'), isDense: true),
              ),
            ),
            const SizedBox(width: 8),
            IconButton.filled(
              onPressed: _sending ? null : _sendReply,
              icon: _sending
                  ? const SizedBox(
                      height: 18,
                      width: 18,
                      child: CircularProgressIndicator(strokeWidth: 2))
                  : const Icon(Icons.send),
            ),
          ],
        ),
      ),
    );
  }
}

/// Horizontal progress through the four tracked stages.
class _Stepper extends StatelessWidget {
  final String status;
  const _Stepper({required this.status});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final current = _stepIndexFor(status);
    final paused = status == TicketStatus.onHold;

    return Row(
      children: [
        for (var i = 0; i < _steps.length; i++) ...[
          Expanded(
            child: Column(
              children: [
                Builder(builder: (context) {
                  final done = i < current;
                  final active = i == current;
                  final color = paused && active
                      ? priorityColor(TicketPriority.high)
                      : (done || active
                          ? theme.colorScheme.primary
                          : theme.colorScheme.outlineVariant);
                  return Container(
                    width: 34,
                    height: 34,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: done || active
                          ? color.withValues(alpha: 0.14)
                          : Colors.transparent,
                      border: Border.all(color: color, width: active ? 2 : 1),
                    ),
                    child: Icon(
                      paused && active ? Icons.pause : _steps[i].icon,
                      size: 16,
                      color: done || active
                          ? color
                          : theme.colorScheme.onSurfaceVariant,
                    ),
                  );
                }),
                const SizedBox(height: 6),
                Text(
                  paused && i == current
                      ? context.t('guest.onHold')
                      : context.t(_steps[i].labelKey),
                  textAlign: TextAlign.center,
                  style: theme.textTheme.labelSmall?.copyWith(
                    color: i <= current
                        ? theme.colorScheme.onSurface
                        : theme.colorScheme.onSurfaceVariant,
                    fontWeight:
                        i == current ? FontWeight.w700 : FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
          if (i < _steps.length - 1)
            Padding(
              padding: const EdgeInsets.only(bottom: 20),
              child: Container(
                width: 16,
                height: 2,
                color: i < current
                    ? theme.colorScheme.primary
                    : theme.colorScheme.outlineVariant,
              ),
            ),
        ],
      ],
    );
  }
}

/// One labelled cell in the ticket's meta grid. Half-width so two sit per row.
class _MetaCell extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;

  const _MetaCell({
    required this.icon,
    required this.label,
    required this.value,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return SizedBox(
      width: (MediaQuery.of(context).size.width - 32 - 32 - 12) / 2,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 16, color: theme.colorScheme.onSurfaceVariant),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label,
                    style: theme.textTheme.labelSmall
                        ?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
                const SizedBox(height: 1),
                Text(value, style: theme.textTheme.bodyMedium),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
