import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../core/api_client.dart';
import '../i18n/i18n.dart';
import '../i18n/labels.dart';
import '../models/notification.dart';
import '../state/providers.dart';
import 'app_shell.dart';
import 'theme.dart';
import 'ticket_detail_page.dart';
import 'widgets/chips.dart';

/// Shown either as a drawer destination or pushed from the app-bar bell, in
/// which case [standalone] gives it a back button instead of the menu.
class NotificationsPage extends ConsumerWidget {
  final bool standalone;
  const NotificationsPage({super.key, this.standalone = false});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(notificationsProvider);
    final unread = ref.watch(unreadCountProvider);

    final body = async.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => ErrorView(
        message: describeError(e),
        onRetry: () => ref.invalidate(notificationsProvider),
      ),
      data: (list) => RefreshIndicator(
        onRefresh: () async => ref.invalidate(notificationsProvider),
        child: list.isEmpty
            ? ListView(children: [
                EmptyState(
                  icon: Icons.notifications_none_rounded,
                  title: context.t('notifications.caughtUp'),
                  subtitle: context.t('notifications.caughtUpHint'),
                ),
              ])
            : ListView.separated(
                padding: const EdgeInsets.all(16),
                itemCount: list.length,
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                itemBuilder: (context, i) => _NotificationRow(
                  notification: list[i],
                  onTap: () async {
                    final n = list[i];
                    if (!n.isRead) {
                      await ref.read(miscRepositoryProvider).markRead(n.id);
                      ref.invalidate(notificationsProvider);
                    }
                    if (!context.mounted || n.ticketId == null) return;
                    Navigator.of(context).push(MaterialPageRoute(
                      builder: (_) => TicketDetailPage(ticketId: n.ticketId!),
                    ));
                  },
                ),
              ),
      ),
    );

    final markAll = IconButton(
      icon: const Icon(Icons.done_all),
      tooltip: context.t('notifications.markAllRead'),
      onPressed: unread == 0
          ? null
          : () async {
              await ref.read(miscRepositoryProvider).markAllRead();
              ref.invalidate(notificationsProvider);
            },
    );

    if (standalone) {
      return Scaffold(
        appBar: AppBar(
            title: Text(context.t('notifications.title')), actions: [markAll]),
        body: body,
      );
    }
    return ShellScaffold(
      title: context.t('notifications.title'),
      showBell: false,
      actions: [markAll],
      body: body,
    );
  }
}

class _NotificationRow extends StatelessWidget {
  final AppNotification notification;
  final VoidCallback onTap;

  const _NotificationRow({required this.notification, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return AppCard(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // An unread marker rather than a background tint: the row keeps the
            // same surface as every other card in the app.
            Padding(
              padding: const EdgeInsets.only(top: 5, right: 10),
              child: Container(
                width: 8,
                height: 8,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: notification.isRead
                      ? Colors.transparent
                      : theme.colorScheme.primary,
                ),
              ),
            ),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    notification.message,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      fontWeight: notification.isRead
                          ? FontWeight.w400
                          : FontWeight.w600,
                    ),
                  ),
                  if (notification.createdAt != null) ...[
                    const SizedBox(height: 4),
                    Text(
                      DateFormat.MMMd().add_jm().format(notification.createdAt!),
                      style: theme.textTheme.bodySmall
                          ?.copyWith(color: theme.colorScheme.outline),
                    ),
                  ],
                ],
              ),
            ),
            if (notification.ticketId != null)
              Icon(forwardChevron(context), color: theme.colorScheme.outline),
          ],
        ),
      ),
    );
  }
}
