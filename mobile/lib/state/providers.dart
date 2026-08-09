import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/api_client.dart';
import '../core/push_service.dart';
import '../data/auth_repository.dart';
import '../data/guest_repository.dart';
import '../data/misc_repository.dart';
import '../data/reports_repository.dart';
import '../data/ticket_repository.dart';
import '../models/dashboard.dart';
import '../models/notification.dart';
import '../models/user.dart';

final apiClientProvider = Provider<ApiClient>((ref) {
  final client = ApiClient();
  // A refresh failure has to invalidate the session from outside the widget
  // tree, since it can happen during any background request.
  client.onSessionExpired = () => ref.read(authProvider.notifier).sessionExpired();
  return client;
});

final authRepositoryProvider = Provider<AuthRepository>(
  (ref) => AuthRepository(ref.watch(apiClientProvider)),
);

final ticketRepositoryProvider = Provider<TicketRepository>(
  (ref) => TicketRepository(ref.watch(apiClientProvider)),
);

final miscRepositoryProvider = Provider<MiscRepository>(
  (ref) => MiscRepository(ref.watch(apiClientProvider)),
);

/// Public endpoints — usable while signed out.
final guestRepositoryProvider = Provider<GuestRepository>(
  (ref) => GuestRepository(ref.watch(apiClientProvider)),
);

final reportsRepositoryProvider = Provider<ReportsRepository>(
  (ref) => ReportsRepository(ref.watch(apiClientProvider)),
);

final dashboardProvider = FutureProvider<DashboardData>(
  (ref) => ref.watch(miscRepositoryProvider).dashboard(),
);

final notificationsProvider = FutureProvider<List<AppNotification>>(
  (ref) => ref.watch(miscRepositoryProvider).notifications(),
);

/// Drives the badge on the app bar's bell.
final unreadCountProvider = Provider<int>((ref) {
  return ref.watch(notificationsProvider).maybeWhen(
        data: (list) => list.where((n) => !n.isRead).length,
        orElse: () => 0,
      );
});

/// Null while signed out; the signed-in user otherwise.
///
/// [restoring] and [loading] are deliberately separate: the first covers the
/// cold-start token check, which owns the whole screen, while the second covers
/// an in-progress sign-in, which must leave the login form on screen so the
/// user keeps seeing what they typed.
class AuthState {
  final AppUser? user;
  final bool restoring;
  final bool loading;
  final String? error;

  const AuthState({
    this.user,
    this.restoring = false,
    this.loading = false,
    this.error,
  });

  bool get isSignedIn => user != null;
}

class AuthController extends StateNotifier<AuthState> {
  final Ref ref;

  AuthController(this.ref) : super(const AuthState(restoring: true)) {
    _restore();
  }

  Future<void> _restore() async {
    final user = await ref.read(authRepositoryProvider).restore();
    if (mounted) state = AuthState(user: user);
    // Re-register on every launch, not just at sign-in: FCM rotates tokens on
    // its own schedule, and one the server has not been told about stops
    // receiving without any visible failure.
    if (user != null) _registerForPush();
  }

  Future<bool> login(String username, String password) async {
    state = const AuthState(loading: true);
    try {
      final user = await ref
          .read(authRepositoryProvider)
          .login(username: username, password: password);
      state = AuthState(user: user);
      _registerForPush();
      return true;
    } catch (e) {
      state = AuthState(error: describeError(e));
      return false;
    }
  }

  /// Deliberately not awaited: push is a background nicety, and the sign-in must
  /// not sit on a network round trip to Firebase before showing the app.
  void _registerForPush() {
    PushService.register(ref.read(apiClientProvider));
  }

  /// Re-fetch /auth/me/ after the profile or avatar changes so the drawer
  /// header and initials stay in step with the server.
  Future<void> reloadUser() async {
    if (!state.isSignedIn) return;
    final user = await ref.read(authRepositoryProvider).me();
    if (mounted) state = AuthState(user: user);
  }

  Future<void> logout() async {
    // Before the tokens go: the unregister call is authenticated, and leaving the
    // registration behind would deliver this user's alerts to whoever signs in on
    // this phone next.
    await PushService.unregister(ref.read(apiClientProvider));
    await ref.read(authRepositoryProvider).logout();
    state = const AuthState();
  }

  void sessionExpired() {
    if (state.isSignedIn) {
      state = const AuthState(error: 'Your session expired. Please log in again.');
    }
  }
}

final authProvider = StateNotifierProvider<AuthController, AuthState>(
  (ref) => AuthController(ref),
);
