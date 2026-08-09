import 'dart:io' show Platform;

import 'package:flutter/foundation.dart' show kIsWeb, kReleaseMode;

/// Where the Django backend lives.
///
/// A release build ships to real phones, which can only reach the deployed
/// server, so it defaults to [_productionBaseUrl]. Debug and profile builds
/// default to whatever the local dev server looks like from the current target:
/// `localhost` does not mean the same thing everywhere, since the Android
/// emulator runs behind its own NAT and reaches the host machine at the fixed
/// alias 10.0.2.2, while the iOS simulator shares the host's loopback.
///
/// Either default can be replaced at build time, which is also how you point a
/// debug build at a real phone's view of your machine (its LAN IP) or at a
/// staging server:
///
///   flutter run --dart-define=API_BASE_URL=http://192.168.1.20:8000
///
/// A host reached this way must appear in DJANGO_ALLOWED_HOSTS or Django will
/// reject the request. The deployed server already lists its own IP; for a LAN
/// address add it to backend/.env and serve with `runserver 0.0.0.0:8000`.
class ApiConfig {
  const ApiConfig._();

  /// The deployed stack. nginx fronts everything on port 80, so unlike the dev
  /// server there is no :8000 here — gunicorn is not exposed directly.
  ///
  /// Plain http:// only works because android:usesCleartextTraffic is set in
  /// the manifest. Both that and this URL want revisiting once the API is
  /// behind a domain and TLS.
  static const String _productionBaseUrl = 'http://13.63.20.134';

  static const String _override =
      String.fromEnvironment('API_BASE_URL', defaultValue: '');

  static String get baseUrl {
    if (_override.isNotEmpty) return _override;
    if (kReleaseMode) return _productionBaseUrl;
    if (kIsWeb) return 'http://127.0.0.1:8000';
    if (Platform.isAndroid) return 'http://10.0.2.2:8000';
    return 'http://127.0.0.1:8000';
  }

  /// Every REST route is mounted under /api/ (see backend/config/urls.py).
  static String get apiRoot => '$baseUrl/api';

  /// Uploaded files come back from DRF as paths relative to the host
  /// (e.g. /media/avatars/3.png), so they need the host prefixed before an
  /// Image.network can load them. Absolute URLs are passed through untouched.
  static String? mediaUrl(String? path) {
    if (path == null || path.isEmpty) return null;
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    return '$baseUrl$path';
  }
}
