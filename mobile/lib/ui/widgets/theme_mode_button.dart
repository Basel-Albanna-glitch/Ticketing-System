import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../i18n/i18n.dart';
import '../../state/preferences.dart';

/// Compact theme picker for screens that have no Settings to reach.
///
/// The full System/Light/Dark segmented control lives in Settings, but that is
/// behind a login — so the sign-in screen needs its own way in. This is the
/// same [themeModeProvider], just a smaller affordance: the button shows the
/// mode currently in force, and the menu marks which one is selected.
class ThemeModeButton extends ConsumerWidget {
  const ThemeModeButton({super.key});

  static IconData _iconFor(ThemeMode mode) => switch (mode) {
        ThemeMode.system => Icons.brightness_auto_outlined,
        ThemeMode.light => Icons.light_mode_outlined,
        ThemeMode.dark => Icons.dark_mode_outlined,
      };

  static String _labelKeyFor(ThemeMode mode) => switch (mode) {
        ThemeMode.system => 'settings.theme.system',
        ThemeMode.light => 'settings.theme.light',
        ThemeMode.dark => 'settings.theme.dark',
      };

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final mode = ref.watch(themeModeProvider);
    final theme = Theme.of(context);

    return PopupMenuButton<ThemeMode>(
      icon: Icon(_iconFor(mode), color: theme.colorScheme.onSurfaceVariant),
      tooltip: context.t('settings.theme'),
      position: PopupMenuPosition.under,
      onSelected: (value) => ref.read(themeModeProvider.notifier).set(value),
      itemBuilder: (context) => [
        for (final option in ThemeMode.values)
          PopupMenuItem(
            value: option,
            child: Row(
              children: [
                Icon(
                  _iconFor(option),
                  size: 18,
                  color: option == mode
                      ? theme.colorScheme.primary
                      : theme.colorScheme.onSurfaceVariant,
                ),
                const SizedBox(width: 12),
                Text(
                  context.t(_labelKeyFor(option)),
                  style: TextStyle(
                    fontWeight:
                        option == mode ? FontWeight.w700 : FontWeight.w400,
                    color: option == mode ? theme.colorScheme.primary : null,
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}
