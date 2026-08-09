import 'package:flutter/material.dart';

import '../models/ticket.dart';

/// Design tokens for the "Elevated / Premium" language the web app uses,
/// ported so the two clients look like one product.
///
/// Web equivalents (frontend/src/index.css + components/ui/*):
///   radius   cards `rounded-2xl` · inputs/buttons `rounded-xl` · badges pill
///   shadows  soft layered `shadow-soft` / `shadow-soft-lg`
///   dark     translucent white surfaces + hairlines, not solid greys
class AppRadius {
  const AppRadius._();
  static const card = 16.0;
  static const control = 12.0;
  static const pill = 999.0;
}

class AppSpacing {
  const AppSpacing._();
  static const xs = 4.0;
  static const sm = 8.0;
  static const md = 12.0;
  static const lg = 16.0;
  static const xl = 24.0;
}

/// Indigo accent, chosen over violet/blue/emerald for the web app.
const seedColor = Color(0xFF4F46E5);
const _indigoLight = Color(0xFF6366F1);

/// Soft layered shadow. Two stacked shadows — a tight contact shadow plus a
/// wide diffuse one — read as depth without the muddy grey of a single blur.
List<BoxShadow> softShadow(Brightness brightness, {bool large = false}) {
  if (brightness == Brightness.dark) {
    // On dark surfaces a shadow is nearly invisible; depth comes from the
    // translucent surface and hairline instead.
    return const [];
  }
  return [
    BoxShadow(
      color: const Color(0xFF0F172A).withValues(alpha: large ? 0.08 : 0.05),
      blurRadius: large ? 24 : 12,
      offset: Offset(0, large ? 8 : 3),
    ),
    BoxShadow(
      color: const Color(0xFF0F172A).withValues(alpha: 0.04),
      blurRadius: 2,
      offset: const Offset(0, 1),
    ),
  ];
}

ThemeData buildTheme(Brightness brightness) {
  final isDark = brightness == Brightness.dark;
  final scheme = ColorScheme.fromSeed(
    seedColor: seedColor,
    brightness: brightness,
  ).copyWith(
    surface: isDark ? const Color(0xFF11141C) : Colors.white,
    outlineVariant: isDark
        ? Colors.white.withValues(alpha: 0.10)
        : const Color(0xFFE5E7EB),
  );

  final base = ThemeData(useMaterial3: true, colorScheme: scheme);

  return base.copyWith(
    scaffoldBackgroundColor:
        isDark ? const Color(0xFF080A11) : const Color(0xFFF6F7FB),
    // Tighter tracking on display sizes; the default Material scale is loose
    // for a dense, information-heavy product like this.
    textTheme: base.textTheme.copyWith(
      headlineSmall: base.textTheme.headlineSmall?.copyWith(
        fontWeight: FontWeight.w700,
        letterSpacing: -0.5,
      ),
      titleLarge: base.textTheme.titleLarge?.copyWith(
        fontWeight: FontWeight.w700,
        letterSpacing: -0.3,
      ),
      titleMedium: base.textTheme.titleMedium?.copyWith(
        fontWeight: FontWeight.w600,
        letterSpacing: -0.2,
      ),
      labelSmall: base.textTheme.labelSmall?.copyWith(
        letterSpacing: 0.4,
        fontWeight: FontWeight.w600,
      ),
    ),
    appBarTheme: AppBarTheme(
      backgroundColor:
          isDark ? const Color(0xFF080A11) : const Color(0xFFF6F7FB),
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: false,
      titleTextStyle: base.textTheme.titleLarge?.copyWith(
        fontWeight: FontWeight.w700,
        letterSpacing: -0.3,
        color: scheme.onSurface,
      ),
      iconTheme: IconThemeData(color: scheme.onSurface),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: isDark ? Colors.white.withValues(alpha: 0.04) : Colors.white,
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppRadius.control),
        borderSide: BorderSide(color: scheme.outlineVariant),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppRadius.control),
        borderSide: BorderSide(color: scheme.outlineVariant),
      ),
      // Stands in for the web's `focus:ring-4 ring-indigo-500/15` glow.
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppRadius.control),
        borderSide: BorderSide(color: scheme.primary, width: 2),
      ),
      floatingLabelStyle: TextStyle(color: scheme.primary),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size.fromHeight(50),
        textStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.control),
        ),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        minimumSize: const Size(0, 42),
        side: BorderSide(color: scheme.outlineVariant),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.control),
        ),
      ),
    ),
    chipTheme: base.chipTheme.copyWith(
      shape: const StadiumBorder(),
      side: BorderSide(color: scheme.outlineVariant),
      backgroundColor: isDark ? Colors.white.withValues(alpha: 0.04) : Colors.white,
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: isDark
          ? const Color(0xFF0D1017)
          : Colors.white.withValues(alpha: 0.96),
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      height: 66,
      indicatorColor: scheme.primary.withValues(alpha: isDark ? 0.22 : 0.12),
      indicatorShape: const StadiumBorder(),
      labelTextStyle: WidgetStatePropertyAll(
        TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w600,
          color: scheme.onSurfaceVariant,
        ),
      ),
    ),
    dividerTheme: DividerThemeData(color: scheme.outlineVariant, thickness: 1),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadius.control),
      ),
    ),
    dialogTheme: DialogThemeData(
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadius.card),
      ),
    ),
    bottomSheetTheme: const BottomSheetThemeData(
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
    ),
  );
}

/// The standard panel: hairline border, soft shadow in light mode, translucent
/// white in dark. Every list row, section and tile is built on this so surfaces
/// stay consistent.
class AppCard extends StatelessWidget {
  final Widget child;
  final VoidCallback? onTap;
  final EdgeInsetsGeometry? padding;
  final bool large;

  const AppCard({
    super.key,
    required this.child,
    this.onTap,
    this.padding,
    this.large = false,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final radius = BorderRadius.circular(AppRadius.card);

    return DecoratedBox(
      decoration: BoxDecoration(
        color: isDark ? Colors.white.withValues(alpha: 0.05) : theme.colorScheme.surface,
        borderRadius: radius,
        border: Border.all(color: theme.colorScheme.outlineVariant),
        boxShadow: softShadow(theme.brightness, large: large),
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: radius,
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          borderRadius: radius,
          onTap: onTap,
          child: padding == null
              ? child
              : Padding(padding: padding!, child: child),
        ),
      ),
    );
  }
}

/// Primary action with the web's vertical gradient + inset top highlight.
class GradientButton extends StatelessWidget {
  final Widget child;
  final VoidCallback? onPressed;
  final IconData? icon;

  const GradientButton({
    super.key,
    required this.child,
    this.onPressed,
    this.icon,
  });

  @override
  Widget build(BuildContext context) {
    final enabled = onPressed != null;
    final radius = BorderRadius.circular(AppRadius.control);

    return Opacity(
      opacity: enabled ? 1 : 0.5,
      child: DecoratedBox(
        decoration: BoxDecoration(
          borderRadius: radius,
          gradient: const LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [_indigoLight, seedColor],
          ),
          boxShadow: enabled
              ? [
                  BoxShadow(
                    color: seedColor.withValues(alpha: 0.35),
                    blurRadius: 16,
                    offset: const Offset(0, 6),
                  ),
                ]
              : null,
          // Inset ring: a hairline of white on top sells the raised edge.
          border: Border.all(color: Colors.white.withValues(alpha: 0.18)),
        ),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            borderRadius: radius,
            onTap: onPressed,
            child: Container(
              height: 50,
              alignment: Alignment.center,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  if (icon != null) ...[
                    Icon(icon, size: 18, color: Colors.white),
                    const SizedBox(width: 8),
                  ],
                  DefaultTextStyle.merge(
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w600,
                      fontSize: 15,
                    ),
                    child: child,
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Accent palette for stat tiles, mirroring the web StatTile `color` prop.
enum TileColor { indigo, blue, amber, green }

extension TileColorValue on TileColor {
  Color get color => switch (this) {
        TileColor.indigo => seedColor,
        TileColor.blue => const Color(0xFF2563EB),
        TileColor.amber => const Color(0xFFD97706),
        TileColor.green => const Color(0xFF059669),
      };
}

/// Gradient-tinted surface with a coloured icon chip — the web's StatTile.
class StatTile extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final TileColor color;

  const StatTile({
    super.key,
    required this.label,
    required this.value,
    required this.icon,
    this.color = TileColor.indigo,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final accent = color.color;

    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(AppRadius.card),
        border: Border.all(color: theme.colorScheme.outlineVariant),
        boxShadow: softShadow(theme.brightness),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            accent.withValues(alpha: isDark ? 0.16 : 0.10),
            isDark ? Colors.white.withValues(alpha: 0.03) : Colors.white,
          ],
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: theme.textTheme.labelSmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
                Container(
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(
                    color: accent.withValues(alpha: isDark ? 0.24 : 0.14),
                    borderRadius: BorderRadius.circular(9),
                  ),
                  child: Icon(icon, size: 15, color: accent),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              value,
              style: theme.textTheme.headlineMedium?.copyWith(
                fontWeight: FontWeight.w700,
                letterSpacing: -1,
                color: theme.colorScheme.onSurface,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Consistent heading above a group of content.
class SectionHeader extends StatelessWidget {
  final String title;
  final Widget? trailing;

  const SectionHeader(this.title, {super.key, this.trailing});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Row(
        children: [
          Expanded(
            child: Text(
              title.toUpperCase(),
              style: theme.textTheme.labelSmall?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
                letterSpacing: 0.8,
              ),
            ),
          ),
          if (trailing != null) trailing!,
        ],
      ),
    );
  }
}

/// Status colours, kept in one place so the list, the detail header and the
/// filter chips cannot disagree.
Color statusColor(String status, ColorScheme scheme) => switch (status) {
      TicketStatus.open => const Color(0xFF64748B),
      TicketStatus.inProgress => const Color(0xFF2563EB),
      TicketStatus.onHold => const Color(0xFFD97706),
      TicketStatus.resolved => const Color(0xFF059669),
      TicketStatus.closed => const Color(0xFF475569),
      _ => scheme.primary,
    };

Color priorityColor(String priority) => switch (priority) {
      TicketPriority.low => const Color(0xFF64748B),
      TicketPriority.medium => const Color(0xFF0891B2),
      TicketPriority.high => const Color(0xFFEA580C),
      TicketPriority.urgent => const Color(0xFFDC2626),
      _ => const Color(0xFF64748B),
    };
