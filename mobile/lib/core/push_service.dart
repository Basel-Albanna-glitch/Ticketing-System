import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';

import 'api_client.dart';
import 'notifications_service.dart';

/// Firebase Cloud Messaging: alerts that arrive with the app closed.
///
/// This complements rather than replaces [NotificationsService] and the poller
/// behind it. The split of responsibilities:
///
///  * app killed or backgrounded — Android draws the pushed message itself from
///    the `notification` block the server sends, on the `ticket_updates` channel.
///  * app in the foreground — FCM hands the message to [FirebaseMessaging.onMessage]
///    and draws nothing, so it is rendered here through [NotificationsService] and
///    ends up looking identical to a polled one.
///
/// Every entry point is guarded: without `android/app/google-services.json` the
/// Firebase init throws, and the app must still start and work on polling alone.
class PushService {
  static bool _ready = false;

  /// The token last registered with the API, kept so logout can unregister the
  /// exact value the server holds.
  static String? _registered;

  static Future<void> init() async {
    if (_ready || kIsWeb) return;
    try {
      await Firebase.initializeApp();

      // Android 13+ gates the notification permission; NotificationsService also
      // asks, and asking twice is harmless — the OS shows one prompt and later
      // calls return the stored answer.
      await FirebaseMessaging.instance.requestPermission();

      FirebaseMessaging.onMessage.listen(_showForeground);
      FirebaseMessaging.onMessageOpenedApp.listen(_openFromMessage);

      // A tap that launched the app from cold has no listener to catch it — the
      // message waits here instead.
      final initial = await FirebaseMessaging.instance.getInitialMessage();
      if (initial != null) _openFromMessage(initial);

      _ready = true;
    } catch (e) {
      // No google-services.json, no Play Services, no network at boot — none of
      // these should stop the app launching. Polling still delivers while open.
      debugPrint('push unavailable: $e');
    }
  }

  /// Tell the API which device this is, so pushes can reach it.
  ///
  /// Called after every sign-in and on each launch of an already-signed-in app:
  /// FCM rotates tokens on its own schedule, and a rotated token the server has
  /// not been told about is one that silently stops receiving.
  static Future<void> register(ApiClient api) async {
    if (!_ready) return;
    try {
      final token = await FirebaseMessaging.instance.getToken();
      if (token == null) return;
      await _post(api, token);
      // Registering the replacement is what keeps delivery alive across a
      // rotation; the server moves the row, so the old token needs no cleanup.
      FirebaseMessaging.instance.onTokenRefresh.listen((fresh) => _post(api, fresh));
    } catch (e) {
      debugPrint('push registration failed: $e');
    }
  }

  /// Drop this device's registration. Must run *before* the tokens are cleared,
  /// since the call itself needs the session that is about to end.
  ///
  /// Skipping this would leave the phone subscribed to the departing user's
  /// alerts, which the next person to sign in on it would then receive.
  static Future<void> unregister(ApiClient api) async {
    if (!_ready) return;
    try {
      final token = _registered ?? await FirebaseMessaging.instance.getToken();
      if (token != null) {
        await api.dio.post('/devices/unregister/', data: {'token': token});
      }
      // Forces a fresh token for whoever signs in next, so a stale copy of this
      // one cannot be used to reach them.
      await FirebaseMessaging.instance.deleteToken();
      _registered = null;
    } catch (e) {
      // A failed unregister must never block signing out; the server prunes the
      // token anyway once FCM reports it dead.
      debugPrint('push unregister failed: $e');
    }
  }

  static Future<void> _post(ApiClient api, String token) async {
    await api.dio.post('/devices/', data: {
      'token': token,
      'platform': defaultTargetPlatform == TargetPlatform.iOS ? 'ios' : 'android',
    });
    _registered = token;
  }

  static void _showForeground(RemoteMessage message) {
    final notification = message.notification;
    if (notification == null) return;
    NotificationsService.show(
      // The server sends the Notification row's own id, which is what the poller
      // uses too — so whichever arrives second replaces the first in the shade
      // instead of showing the same alert twice.
      id: _int(message.data['notification_id']) ?? message.hashCode,
      title: notification.title ?? 'Ticket update',
      body: notification.body ?? '',
      ticketId: _int(message.data['ticket_id']),
    );
  }

  static void _openFromMessage(RemoteMessage message) {
    final ticketId = _int(message.data['ticket_id']);
    if (ticketId != null) NotificationsService.onTicketTap?.call(ticketId);
  }

  /// FCM data values are always strings, so ids arrive as text.
  static int? _int(Object? value) =>
      value == null ? null : int.tryParse(value.toString());
}
