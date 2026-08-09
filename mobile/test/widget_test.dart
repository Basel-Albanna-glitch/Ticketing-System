// Smoke test: with no stored tokens the app must settle on the login screen
// rather than the ticket list.
//
// Replaces the `flutter create` template test, which referenced MyApp — this
// app's root widget is HermesApp.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:hermes_tickets/main.dart';

void main() {
  testWidgets('shows the sign-in form when signed out', (tester) async {
    await tester.pumpWidget(const ProviderScope(child: HermesApp()));

    // First frame is the restore splash.
    expect(find.byType(CircularProgressIndicator), findsOneWidget);

    // Secure storage has no tokens under the test binding, so the restore
    // resolves to a signed-out state.
    await tester.pumpAndSettle();

    expect(find.text('Sign in'), findsOneWidget);
    expect(find.text('Username'), findsOneWidget);
  });
}
