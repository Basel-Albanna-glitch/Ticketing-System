import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/notifications_service.dart';
import '../models/notification.dart';
import 'providers.dart';

/// Polls the notifications endpoint and raises a system notification for each
/// genuinely new one.
///
/// The backend already creates a Notification row for the events we care about
/// — a new ticket, a status change, an assignment, a reply — so there is
/// nothing to add server-side: watching that one endpoint covers all of them.
class NotificationWatcher {
  final Ref ref;
  Timer? _timer;

  /// Highest id already seen. Seeded from the first poll so opening the app
  /// does not fire a notification for every unread message that was already
  /// there — only things that arrive afterwards.
  int? _highestSeen;

  NotificationWatcher(this.ref);

  static const _interval = Duration(seconds: 30);

  void start() {
    stop();
    // Poll immediately to seed the baseline, then on a timer.
    _poll();
    _timer = Timer.periodic(_interval, (_) => _poll());
  }

  void stop() {
    _timer?.cancel();
    _timer = null;
  }

  /// Forget the baseline so a different user does not inherit it.
  void reset() {
    stop();
    _highestSeen = null;
  }

  Future<void> _poll() async {
    List<AppNotification> items;
    try {
      items = await ref.read(miscRepositoryProvider).notifications();
    } catch (_) {
      // Offline or the server is down — try again on the next tick.
      return;
    }
    if (items.isEmpty) return;

    final highest =
        items.map((n) => n.id).reduce((a, b) => a > b ? a : b);

    if (_highestSeen == null) {
      _highestSeen = highest;
      // Keep the badge in step even on the seeding pass.
      ref.invalidate(notificationsProvider);
      return;
    }

    final fresh = items
        .where((n) => n.id > _highestSeen! && !n.isRead)
        .toList()
      // Oldest first, so the newest ends up on top of the shade.
      ..sort((a, b) => a.id.compareTo(b.id));

    for (final n in fresh) {
      await NotificationsService.show(
        id: n.id,
        title: _titleFor(n),
        body: n.message,
        ticketId: n.ticketId,
      );
    }

    if (fresh.isNotEmpty) {
      _highestSeen = highest;
      ref.invalidate(notificationsProvider);
    } else {
      _highestSeen = highest;
    }
  }

  /// A short heading above the server's message.
  ///
  /// Notification.Kind only defines general / new_ticket / license_expiry, so
  /// there is no distinct kind for a status change or an assignment — those all
  /// arrive as `general` and their message already says which. The heading
  /// therefore stays generic rather than claiming something it cannot know.
  static String _titleFor(AppNotification n) => switch (n.kind) {
        'new_ticket' => 'New ticket',
        'license_expiry' => 'License expiring',
        _ => 'Ticket update',
      };
}

final notificationWatcherProvider = Provider<NotificationWatcher>((ref) {
  final watcher = NotificationWatcher(ref);
  ref.onDispose(watcher.stop);
  return watcher;
});
