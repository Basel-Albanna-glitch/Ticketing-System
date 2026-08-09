import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../i18n/i18n.dart';

/// Language and theme choices, persisted between launches.
///
/// These ride in flutter_secure_storage rather than shared_preferences purely
/// to avoid adding a second storage plugin for two short strings — the app
/// already depends on it for the JWT pair. Nothing here is a secret.
class PrefsStore {
  static const _languageKey = 'pref_language';
  static const _themeModeKey = 'pref_theme_mode';

  final FlutterSecureStorage _storage;

  const PrefsStore(this._storage);

  static const _defaultStorage = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  );

  factory PrefsStore.defaults() => const PrefsStore(_defaultStorage);

  Future<AppLanguage> readLanguage() async =>
      AppLanguage.fromCode(await _storage.read(key: _languageKey));

  Future<void> writeLanguage(AppLanguage value) =>
      _storage.write(key: _languageKey, value: value.code);

  Future<ThemeMode> readThemeMode() async {
    final raw = await _storage.read(key: _themeModeKey);
    return ThemeMode.values.firstWhere(
      (m) => m.name == raw,
      orElse: () => ThemeMode.system,
    );
  }

  Future<void> writeThemeMode(ThemeMode value) =>
      _storage.write(key: _themeModeKey, value: value.name);
}

final prefsStoreProvider = Provider<PrefsStore>((ref) => PrefsStore.defaults());

/// Both controllers are seeded with the stored value by an override in `main`,
/// so the first frame is already in the right language and theme — reading them
/// asynchronously here would flash English/system on every launch.
class LanguageController extends StateNotifier<AppLanguage> {
  LanguageController(this._store, AppLanguage initial) : super(initial);

  final PrefsStore _store;

  Future<void> set(AppLanguage value) async {
    if (value == state) return;
    state = value;
    await _store.writeLanguage(value);
  }
}

class ThemeModeController extends StateNotifier<ThemeMode> {
  ThemeModeController(this._store, ThemeMode initial) : super(initial);

  final PrefsStore _store;

  Future<void> set(ThemeMode value) async {
    if (value == state) return;
    state = value;
    await _store.writeThemeMode(value);
  }
}

/// Overridden in `main` with the persisted value; the defaults here are what a
/// fresh install gets.
final languageProvider =
    StateNotifierProvider<LanguageController, AppLanguage>(
  (ref) => LanguageController(ref.watch(prefsStoreProvider), AppLanguage.en),
);

final themeModeProvider = StateNotifierProvider<ThemeModeController, ThemeMode>(
  (ref) => ThemeModeController(ref.watch(prefsStoreProvider), ThemeMode.system),
);
