import 'dart:async';

import 'package:dio/dio.dart';

import 'config.dart';
import 'token_store.dart';

/// Raised when the session cannot be recovered and the user must log in again.
class SessionExpired implements Exception {
  const SessionExpired();
  @override
  String toString() => 'Session expired';
}

/// A readable message pulled out of a DRF error body.
///
/// DRF answers with either {"detail": "..."} or a field map
/// {"subject": ["This field is required."]}; both shapes are flattened here so
/// the UI can show something better than "400".
String describeError(Object error) {
  if (error is SessionExpired) return 'Your session expired. Please log in again.';
  if (error is! DioException) return error.toString();

  if (error.type == DioExceptionType.connectionError ||
      error.type == DioExceptionType.connectionTimeout) {
    return 'Cannot reach the server at ${ApiConfig.baseUrl}.\n'
        'Check that Django is running and that the address is right for this '
        'device (Android emulators need 10.0.2.2, real phones need your LAN IP).';
  }

  final data = error.response?.data;
  if (data is Map) {
    final detail = data['detail'];
    if (detail is String) return detail;
    final parts = <String>[];
    data.forEach((key, value) {
      final text = value is List ? value.join(' ') : '$value';
      parts.add(key == 'non_field_errors' ? text : '$key: $text');
    });
    if (parts.isNotEmpty) return parts.join('\n');
  }
  if (data is String && data.isNotEmpty) return data;
  return error.message ?? 'Request failed';
}

/// Dio wrapper that attaches the bearer token and silently renews it.
///
/// Access tokens last 30 minutes (backend/config/settings.py:179), so a 401
/// mid-session is routine rather than exceptional. The interceptor refreshes
/// once and replays the failed request; only if the refresh itself fails does
/// the user get bounced to the login screen via [onSessionExpired].
class ApiClient {
  final Dio dio;
  final TokenStore tokens;

  /// Held so that N requests failing at once trigger one refresh, not N.
  Future<bool>? _refreshInFlight;

  void Function()? onSessionExpired;

  ApiClient({TokenStore? tokenStore, Dio? client})
      : tokens = tokenStore ?? TokenStore(),
        dio = client ??
            Dio(BaseOptions(
              baseUrl: ApiConfig.apiRoot,
              connectTimeout: const Duration(seconds: 15),
              receiveTimeout: const Duration(seconds: 20),
              contentType: Headers.jsonContentType,
            )) {
    dio.interceptors.add(InterceptorsWrapper(
      onRequest: _onRequest,
      onError: _onError,
    ));
  }

  Future<void> _onRequest(
      RequestOptions options, RequestInterceptorHandler handler) async {
    if (options.extra['skipAuth'] != true) {
      final token = await tokens.readAccess();
      if (token != null) {
        options.headers['Authorization'] = 'Bearer $token';
      }
    }
    handler.next(options);
  }

  Future<void> _onError(
      DioException error, ErrorInterceptorHandler handler) async {
    final response = error.response;
    final isAuthFailure = response?.statusCode == 401;
    final alreadyRetried = error.requestOptions.extra['retried'] == true;
    final isAuthCall = error.requestOptions.extra['skipAuth'] == true;

    if (!isAuthFailure || alreadyRetried || isAuthCall) {
      return handler.next(error);
    }

    final refreshed = await _refresh();
    if (!refreshed) {
      onSessionExpired?.call();
      return handler.next(error);
    }

    try {
      final options = error.requestOptions;
      options.extra['retried'] = true;
      final token = await tokens.readAccess();
      options.headers['Authorization'] = 'Bearer $token';
      final retry = await dio.fetch(options);
      return handler.resolve(retry);
    } on DioException catch (e) {
      return handler.next(e);
    }
  }

  Future<bool> _refresh() {
    // Collapse concurrent refreshes: whoever arrives while one is running waits
    // on the same future instead of burning the (rotating) refresh token twice.
    return _refreshInFlight ??= _doRefresh().whenComplete(() {
      _refreshInFlight = null;
    });
  }

  Future<bool> _doRefresh() async {
    final refresh = await tokens.readRefresh();
    if (refresh == null) return false;
    try {
      final res = await dio.post(
        '/token/refresh/',
        data: {'refresh': refresh},
        options: Options(extra: {'skipAuth': true}),
      );
      final data = res.data as Map;
      await tokens.save(
        access: data['access'] as String,
        // Rotation is enabled, so a new refresh token comes back with the
        // access token and must replace the stored one.
        refresh: data['refresh'] as String?,
      );
      return true;
    } on DioException {
      await tokens.clear();
      return false;
    }
  }
}
