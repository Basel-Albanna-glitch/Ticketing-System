import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/notifications_service.dart';
import 'core/push_service.dart';
import 'i18n/i18n.dart';
import 'state/notification_watcher.dart';
import 'state/preferences.dart';
import 'state/providers.dart';
import 'state/ticket_list_controller.dart';
import 'ui/app_shell.dart';
import 'ui/login_page.dart';
import 'ui/theme.dart';
import 'ui/ticket_detail_page.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // Creates the channel and asks for the Android 13+ permission before any
  // notification is raised.
  await NotificationsService.init();
  // Must follow the channel being created: a push naming a channel Android does
  // not know yet would arrive silently. Never throws — see PushService.init.
  await PushService.init();

  // Read the stored language and theme *before* the first frame and seed the
  // providers with them, so an Arabic user never sees a flash of English (and
  // an RTL-to-LTR relayout) on launch.
  final prefs = PrefsStore.defaults();
  final language = await prefs.readLanguage();
  final themeMode = await prefs.readThemeMode();

  runApp(
    ProviderScope(
      overrides: [
        prefsStoreProvider.overrideWithValue(prefs),
        languageProvider.overrideWith(
          (ref) => LanguageController(prefs, language),
        ),
        themeModeProvider.overrideWith(
          (ref) => ThemeModeController(prefs, themeMode),
        ),
      ],
      child: const HermesApp(),
    ),
  );
}

class HermesApp extends ConsumerWidget {
  const HermesApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authProvider);

    // The ticket list is a long-lived provider, so it has to be dropped when the
    // session changes — otherwise signing in as someone else briefly shows the
    // previous user's tickets.
    ref.listen(authProvider, (previous, next) {
      if (previous?.user?.id == next.user?.id) return;
      ref.invalidate(ticketListProvider);

      // Polling only makes sense while somebody is signed in, and the baseline
      // must be dropped so a new user is not judged against the old one's ids.
      final watcher = ref.read(notificationWatcherProvider);
      watcher.reset();
      if (next.isSignedIn) watcher.start();
    });

    // Tapping a notification opens its ticket.
    NotificationsService.onTicketTap = (ticketId) {
      NotificationsService.navigatorKey.currentState?.push(
        MaterialPageRoute(builder: (_) => TicketDetailPage(ticketId: ticketId)),
      );
    };

    final language = ref.watch(languageProvider);

    return MaterialApp(
      title: 'Hermes Support',
      navigatorKey: NotificationsService.navigatorKey,
      debugShowCheckedModeBanner: false,
      theme: buildTheme(Brightness.light),
      darkTheme: buildTheme(Brightness.dark),
      themeMode: ref.watch(themeModeProvider),
      // Setting the locale is what flips the whole tree to RTL for Arabic —
      // Directionality follows from it, so layouts mirror without any per-widget
      // work as long as they use start/end rather than left/right.
      locale: language.locale,
      supportedLocales: [for (final l in AppLanguage.values) l.locale],
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      // One entry point for both roles: the server decides what the session can
      // see, and TicketsPage adapts its rows and actions to user.isStaff.
      home: switch (auth) {
        AuthState(restoring: true) => const _Splash(),
        AuthState(isSignedIn: true) => const AppShell(),
        _ => const LoginPage(),
      },
    );
  }
}

class _Splash extends StatelessWidget {
  const _Splash();

  @override
  Widget build(BuildContext context) {
    return const Scaffold(body: Center(child: CircularProgressIndicator()));
  }
}
