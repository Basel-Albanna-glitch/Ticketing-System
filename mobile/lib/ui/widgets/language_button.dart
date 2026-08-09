import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../i18n/i18n.dart';
import '../../state/preferences.dart';

/// Compact language picker for screens reached before signing in.
///
/// The Settings screen has the full segmented control, but it is behind a
/// login — and someone who cannot read the English sign-in screen is exactly
/// the person who needs to switch language. Each option is written in its own
/// language so it stays readable whichever one is active.
class LanguageButton extends ConsumerWidget {
  const LanguageButton({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final current = ref.watch(languageProvider);
    final theme = Theme.of(context);

    return PopupMenuButton<AppLanguage>(
      icon: Icon(Icons.translate_rounded,
          color: theme.colorScheme.onSurfaceVariant),
      tooltip: context.t('settings.language'),
      position: PopupMenuPosition.under,
      onSelected: (value) => ref.read(languageProvider.notifier).set(value),
      itemBuilder: (context) => [
        for (final option in AppLanguage.values)
          PopupMenuItem(
            value: option,
            child: Row(
              children: [
                SizedBox(
                  width: 18,
                  child: option == current
                      ? Icon(Icons.check_rounded,
                          size: 18, color: theme.colorScheme.primary)
                      : null,
                ),
                const SizedBox(width: 12),
                Text(
                  option.label,
                  style: TextStyle(
                    fontWeight:
                        option == current ? FontWeight.w700 : FontWeight.w400,
                    color: option == current ? theme.colorScheme.primary : null,
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}
