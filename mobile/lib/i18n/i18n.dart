import 'package:flutter/material.dart';

import 'strings.dart';

/// The languages the app ships, mirroring `LANGUAGES` in
/// `frontend/src/i18n/translations.js`.
enum AppLanguage {
  en('en', 'English'),
  ar('ar', 'العربية');

  const AppLanguage(this.code, this.label);

  final String code;

  /// Shown in the language picker — always written in the language itself, so
  /// it is readable to someone who cannot read the current one.
  final String label;

  Locale get locale => Locale(code);

  static AppLanguage fromCode(String? code) => AppLanguage.values.firstWhere(
        (l) => l.code == code,
        orElse: () => AppLanguage.en,
      );
}

/// Looks [key] up in [lang], falling back to English and then to the key
/// itself. Same degradation as the web: a screen that has not been translated
/// yet shows English rather than blanks, and a typo'd key shows the key rather
/// than an empty widget.
String translate(String key, String lang) =>
    translations[lang]?[key] ?? translations['en']?[key] ?? key;

extension I18n on BuildContext {
  /// Translates using the locale currently applied to the widget tree.
  ///
  /// Reading the locale from `Localizations` rather than from a provider means
  /// this works anywhere below `MaterialApp` — including inside dialogs and
  /// plain `StatelessWidget`s that never take a `WidgetRef`.
  String t(String key) =>
      translate(key, Localizations.localeOf(this).languageCode);

  /// [t] with `{placeholder}` substitution, for the handful of strings that
  /// embed a value. Keeping the placeholder inside the translated string lets
  /// Arabic put the value where its grammar wants it, which concatenating in
  /// Dart would not.
  String tp(String key, Map<String, String> params) {
    var out = t(key);
    params.forEach((k, v) => out = out.replaceAll('{$k}', v));
    return out;
  }

  bool get isRtl => Directionality.of(this) == TextDirection.rtl;
}
