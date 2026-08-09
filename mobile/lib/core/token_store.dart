import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Persists the JWT pair between launches.
///
/// SIMPLE_JWT has ROTATE_REFRESH_TOKENS on (backend/config/settings.py:181), so
/// every refresh returns a *new* refresh token and invalidates nothing until it
/// is used — meaning the new one must be written back or the next refresh after
/// this one fails. [save] is therefore called on refresh as well as on login.
class TokenStore {
  static const _accessKey = 'access_token';
  static const _refreshKey = 'refresh_token';

  final FlutterSecureStorage _storage;

  TokenStore([FlutterSecureStorage? storage])
      : _storage = storage ??
            const FlutterSecureStorage(
              aOptions: AndroidOptions(encryptedSharedPreferences: true),
            );

  String? _cachedAccess;

  /// Kept in memory so the request interceptor stays synchronous-ish on the hot
  /// path; secure storage reads hit the platform channel and are comparatively
  /// slow to do on every single request.
  String? get cachedAccess => _cachedAccess;

  Future<String?> readAccess() async {
    _cachedAccess ??= await _storage.read(key: _accessKey);
    return _cachedAccess;
  }

  Future<String?> readRefresh() => _storage.read(key: _refreshKey);

  Future<void> save({required String access, String? refresh}) async {
    _cachedAccess = access;
    await _storage.write(key: _accessKey, value: access);
    if (refresh != null) {
      await _storage.write(key: _refreshKey, value: refresh);
    }
  }

  Future<void> clear() async {
    _cachedAccess = null;
    await _storage.delete(key: _accessKey);
    await _storage.delete(key: _refreshKey);
  }
}
