import 'dart:io' show Platform;

import 'package:flutter/foundation.dart' show kIsWeb;

/// Where the Django backend lives, resolved per platform.
///
/// `localhost` does not mean the same thing on every target: the Android
/// emulator runs behind its own NAT and reaches the host machine at the fixed
/// alias 10.0.2.2, while the iOS simulator shares the host's loopback. A real
/// phone can reach neither and needs the host's LAN IP, so that case must be
/// supplied explicitly at build time:
///
///   flutter run --dart-define=API_BASE_URL=http://192.168.1.20:8000
///
/// Remember to add that IP to DJANGO_ALLOWED_HOSTS in backend/.env and to start
/// the server with `runserver 0.0.0.0:8000`, or Django will reject the request.
class ApiConfig {
  const ApiConfig._();

  static const String _override =
      String.fromEnvironment('API_BASE_URL', defaultValue: '');

  static String get baseUrl {
    if (_override.isNotEmpty) return _override;
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
