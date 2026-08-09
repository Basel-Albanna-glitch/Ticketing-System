import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

/// Raises real system notifications — heads-up banner, sound, and an entry in
/// the notification shade, the same as any messaging app.
///
/// These are *local* notifications triggered by polling the API, not push. The
/// difference only shows when the app is fully killed: Android will not wake it
/// to poll, so nothing arrives until it is next opened. Delivery while closed
/// needs Firebase Cloud Messaging, which requires a Firebase project.
class NotificationsService {
  static final _plugin = FlutterLocalNotificationsPlugin();

  /// Tapping a notification needs to open a ticket from outside the widget
  /// tree, so navigation goes through the app's navigator key.
  static final navigatorKey = GlobalKey<NavigatorState>();

  /// Called with a ticket id when a notification is tapped.
  static void Function(int ticketId)? onTicketTap;

  static const _channel = AndroidNotificationChannel(
    'ticket_updates',
    'Ticket updates',
    description: 'New tickets, status changes, replies and assignments.',
    importance: Importance.high,
  );

  static bool _ready = false;

  static Future<void> init() async {
    if (_ready) return;
    // No web implementation exists for this plugin, and main() awaits this —
    // an unguarded failure here would stop the app booting rather than merely
    // disabling notifications.
    if (kIsWeb) return;

    try {
      // Android draws the small icon from its alpha channel only, tinting it
      // white — a full-colour launcher icon would appear as a solid white
      // square in the status bar, so this is a dedicated silhouette of the
      // logo mark.
      const settings = InitializationSettings(
        android: AndroidInitializationSettings('ic_notification'),
      );
      await _plugin.initialize(
        settings,
        onDidReceiveNotificationResponse: (response) {
          final payload = response.payload;
          if (payload == null || payload.isEmpty) return;
          final ticketId = int.tryParse(payload);
          if (ticketId != null) onTicketTap?.call(ticketId);
        },
      );

      final android = _plugin.resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin>();
      if (android != null) {
        // The channel must exist before anything can post to it, and its
        // importance is what makes the notification appear as a banner rather
        // than silently in the shade.
        await android.createNotificationChannel(_channel);
        // Android 13+ requires explicit permission; older versions grant it.
        await android.requestNotificationsPermission();
      }

      _ready = true;
    } catch (e) {
      // Notifications are a nice-to-have; never let them block startup.
      debugPrint('notifications unavailable: $e');
    }
  }

  static Future<void> show({
    required int id,
    required String title,
    required String body,
    int? ticketId,
  }) async {
    if (!_ready) return;
    try {
      await _plugin.show(
        id,
        title,
        body,
        NotificationDetails(
          android: AndroidNotificationDetails(
            _channel.id,
            _channel.name,
            channelDescription: _channel.description,
            icon: 'ic_notification',
            // Tints the small icon and the app name in the shade with the
            // Hermes blue rather than Android's default grey.
            color: const Color(0xFF1F3A8A),
            importance: Importance.high,
            priority: Priority.high,
            // Long messages get expanded text rather than being cut off.
            styleInformation: BigTextStyleInformation(body),
          ),
        ),
        payload: ticketId?.toString(),
      );
    } catch (e) {
      // A notification failing must never take down the poller behind it.
      debugPrint('notification failed: $e');
    }
  }
}
