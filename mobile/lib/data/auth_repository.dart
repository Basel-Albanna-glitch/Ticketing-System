import 'package:dio/dio.dart';

import '../core/api_client.dart';
import '../models/user.dart';

class AuthRepository {
  final ApiClient api;

  AuthRepository(this.api);

  /// Exchange credentials for a JWT pair.
  ///
  /// The User model's USERNAME_FIELD is 'username' (accounts/models.py:54), so
  /// SimpleJWT's default view expects a username here — an email will not work.
  Future<AppUser> login({
    required String username,
    required String password,
  }) async {
    final res = await api.dio.post(
      '/token/',
      data: {'username': username, 'password': password},
      // No bearer header on the login call itself, and a 401 here means bad
      // credentials — it must not kick off a refresh attempt.
      options: Options(extra: {'skipAuth': true}),
    );
    final data = res.data as Map;
    await api.tokens.save(
      access: data['access'] as String,
      refresh: data['refresh'] as String,
    );
    return me();
  }

  Future<AppUser> me() async {
    final res = await api.dio.get('/auth/me/');
    return AppUser.fromJson(res.data as Map<String, dynamic>);
  }

  /// Restore a session from stored tokens on cold start, or null if there is
  /// nothing usable. The interceptor handles an expired access token, so only a
  /// dead refresh token ends up here as a null.
  Future<AppUser?> restore() async {
    if (await api.tokens.readRefresh() == null) return null;
    try {
      return await me();
    } on DioException {
      await api.tokens.clear();
      return null;
    }
  }

  Future<void> logout() => api.tokens.clear();
}
