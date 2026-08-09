import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/api_client.dart';
import '../i18n/i18n.dart';
import '../models/project.dart';
import '../models/ticket.dart';
import '../state/preferences.dart';
import '../state/providers.dart';
import '../utils/category_tree.dart';
import 'app_shell.dart';
import 'forms/content_form_pages.dart';
import 'theme.dart';
import 'widgets/chips.dart';

final ticketSettingsProvider = FutureProvider<TicketSettings>(
  (ref) => ref.watch(miscRepositoryProvider).ticketSettings(),
);

/// Presentation metadata for the permission switches, keyed by the same field
/// names the serializer uses.
///
/// The label and the explanation are looked up from the translation table, not
/// taken from `TicketSettings.fields` — that map mirrors the API and is English
/// only. A field missing from here still renders, with a neutral icon and no
/// description, so adding a permission server-side cannot break the screen.
const _permissionDetail = <String, ({IconData icon, String i18n})>{
  'allow_agent_self_assign': (
    icon: Icons.back_hand_outlined,
    i18n: 'selfAssign',
  ),
  'allow_agent_reassign': (icon: Icons.swap_horiz_rounded, i18n: 'reassign'),
  'allow_agent_edit_after_close': (
    icon: Icons.lock_open_rounded,
    i18n: 'editAfterClose',
  ),
  'allow_agent_edit_customers': (
    icon: Icons.badge_outlined,
    i18n: 'editCustomers',
  ),
  'allow_agent_delete': (
    icon: Icons.delete_outline_rounded,
    i18n: 'deleteTicket',
  ),
  'allow_agent_link_customer': (icon: Icons.link_rounded, i18n: 'linkCustomer'),
  'allow_agent_manage_kb': (icon: Icons.menu_book_outlined, i18n: 'manageKb'),
};

/// Personal appearance preferences plus the agent-permission switches.
///
/// Everyone signed in may read the permissions (the ticket UI needs them to
/// know which buttons to show), but only admins may write, so the toggles are
/// disabled for non-admins rather than hidden — matching the web. Appearance is
/// per-device and available to everyone.
class SettingsPage extends ConsumerStatefulWidget {
  const SettingsPage({super.key});

  @override
  ConsumerState<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends ConsumerState<SettingsPage> {
  /// Values the user just toggled, drawn on top of the fetched settings so the
  /// switch moves under the thumb instead of waiting a round trip. Entries are
  /// kept after a successful write — at that point they match what the server
  /// holds — and dropped again only when the write failed.
  final _optimistic = <String, bool>{};

  Future<void> _toggle(String key, bool value) async {
    setState(() => _optimistic[key] = value);
    try {
      await ref.read(miscRepositoryProvider).setTicketSetting(key, value);
      // Other screens read this provider to decide which buttons to draw.
      ref.invalidate(ticketSettingsProvider);
    } catch (e) {
      if (!mounted) return;
      setState(() => _optimistic.remove(key)); // snap the switch back
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(describeError(e)),
        backgroundColor: Theme.of(context).colorScheme.error,
      ));
    }
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(ticketSettingsProvider);
    final user = ref.watch(authProvider).user;
    final canEdit = user?.isAdmin ?? false;
    final theme = Theme.of(context);

    return ShellScaffold(
      title: context.t('settings.title'),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(
            AppSpacing.lg, AppSpacing.lg, AppSpacing.lg, AppSpacing.xl),
        children: [
          const _AppearanceSection(),
          const SizedBox(height: AppSpacing.xl),
          // Only the permissions half depends on the network, so a dead backend
          // still leaves language and theme usable.
          async.when(
            loading: () => const Padding(
              padding: EdgeInsets.symmetric(vertical: AppSpacing.xl),
              child: Center(child: CircularProgressIndicator()),
            ),
            error: (e, _) => ErrorView(
              message: describeError(e),
              onRetry: () => ref.invalidate(ticketSettingsProvider),
            ),
            data: (settings) {
              final keys = TicketSettings.fields.keys.toList();
              bool valueOf(String k) => _optimistic[k] ?? settings[k];
              final enabled = keys.where(valueOf).length;

              return Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  SectionHeader(
                    context.t('settings.permissions'),
                    trailing: canEdit
                        ? Pill(
                            label: '$enabled/${keys.length} '
                                '${context.t('settings.permissionsCount')}',
                            color: theme.colorScheme.primary,
                          )
                        : Pill(
                            label: context.t('common.readOnly'),
                            color: theme.colorScheme.onSurfaceVariant,
                            outlined: true,
                            icon: Icons.lock_outline_rounded,
                          ),
                  ),
                  Text(
                    canEdit
                        ? context.t('settings.permissionsDescription')
                        : context.t('settings.permissionsReadOnly'),
                    style: theme.textTheme.bodySmall
                        ?.copyWith(color: theme.colorScheme.onSurfaceVariant),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  AppCard(
                    padding: const EdgeInsets.symmetric(
                        horizontal: AppSpacing.lg, vertical: AppSpacing.xs),
                    child: Column(
                      children: [
                        for (var i = 0; i < keys.length; i++) ...[
                          if (i > 0)
                            const Divider(
                                height: 1, indent: _PermissionRow.inset),
                          _PermissionRow(
                            icon: _permissionDetail[keys[i]]?.icon ??
                                Icons.tune_rounded,
                            title: _label(context, keys[i]),
                            description: _help(context, keys[i]),
                            value: valueOf(keys[i]),
                            onChanged:
                                canEdit ? (v) => _toggle(keys[i], v) : null,
                          ),
                        ],
                      ],
                    ),
                  ),
                  if (canEdit) ...[
                    const SizedBox(height: AppSpacing.xl),
                    const _CategorySection(),
                  ],
                ],
              );
            },
          ),
        ],
      ),
    );
  }

  /// Falls back to the API's own English label for a field this build does not
  /// know about yet.
  String _label(BuildContext context, String key) {
    final i18n = _permissionDetail[key]?.i18n;
    if (i18n == null) return TicketSettings.fields[key] ?? key;
    return context.t('settings.$i18n');
  }

  String _help(BuildContext context, String key) {
    final i18n = _permissionDetail[key]?.i18n;
    return i18n == null ? '' : context.t('settings.${i18n}Help');
  }
}

/// Per-device preferences: language and theme. Deliberately above the
/// permissions, and outside the async block, because they belong to the person
/// holding the phone rather than to the organisation.
class _AppearanceSection extends ConsumerWidget {
  const _AppearanceSection();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final language = ref.watch(languageProvider);
    final themeMode = ref.watch(themeModeProvider);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SectionHeader(context.t('settings.appearance')),
        Text(
          context.t('settings.appearanceDescription'),
          style: theme.textTheme.bodySmall
              ?.copyWith(color: theme.colorScheme.onSurfaceVariant),
        ),
        const SizedBox(height: AppSpacing.md),
        AppCard(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _PreferenceLabel(
                icon: Icons.translate_rounded,
                label: context.t('settings.language'),
              ),
              const SizedBox(height: AppSpacing.sm),
              SegmentedButton<AppLanguage>(
                segments: [
                  for (final l in AppLanguage.values)
                    ButtonSegment(value: l, label: Text(l.label)),
                ],
                selected: {language},
                showSelectedIcon: false,
                onSelectionChanged: (s) =>
                    ref.read(languageProvider.notifier).set(s.first),
              ),
              const SizedBox(height: AppSpacing.lg),
              _PreferenceLabel(
                icon: Icons.brightness_6_outlined,
                label: context.t('settings.theme'),
              ),
              const SizedBox(height: AppSpacing.sm),
              SegmentedButton<ThemeMode>(
                segments: [
                  ButtonSegment(
                    value: ThemeMode.system,
                    icon: const Icon(Icons.phone_android_rounded, size: 16),
                    label: Text(context.t('settings.theme.system')),
                  ),
                  ButtonSegment(
                    value: ThemeMode.light,
                    icon: const Icon(Icons.light_mode_outlined, size: 16),
                    label: Text(context.t('settings.theme.light')),
                  ),
                  ButtonSegment(
                    value: ThemeMode.dark,
                    icon: const Icon(Icons.dark_mode_outlined, size: 16),
                    label: Text(context.t('settings.theme.dark')),
                  ),
                ],
                selected: {themeMode},
                showSelectedIcon: false,
                onSelectionChanged: (s) =>
                    ref.read(themeModeProvider.notifier).set(s.first),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _PreferenceLabel extends StatelessWidget {
  final IconData icon;
  final String label;

  const _PreferenceLabel({required this.icon, required this.label});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Row(
      children: [
        Icon(icon, size: 18, color: theme.colorScheme.onSurfaceVariant),
        const SizedBox(width: AppSpacing.sm),
        Text(
          label,
          style: theme.textTheme.bodyMedium
              ?.copyWith(fontWeight: FontWeight.w600),
        ),
      ],
    );
  }
}

/// One permission: tinted icon chip, label, plain-language explanation, switch.
/// The chip picks up the accent colour when the permission is on, so the set of
/// granted permissions is readable at a glance without parsing every switch.
class _PermissionRow extends StatelessWidget {
  final IconData icon;
  final String title;
  final String description;
  final bool value;
  final ValueChanged<bool>? onChanged;

  /// Icon chip width + gutter — dividers indent by this so they line up with
  /// the text column rather than cutting under the icons.
  static const inset = 34.0 + AppSpacing.md;

  const _PermissionRow({
    required this.icon,
    required this.title,
    required this.description,
    required this.value,
    this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final readOnly = onChanged == null;
    final tint =
        value ? theme.colorScheme.primary : theme.colorScheme.onSurfaceVariant;

    return Opacity(
      opacity: readOnly ? 0.65 : 1,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
        child: Row(
          children: [
            Container(
              width: 34,
              height: 34,
              decoration: BoxDecoration(
                color: tint.withValues(
                  alpha: value ? (isDark ? 0.24 : 0.12) : (isDark ? 0.10 : 0.06),
                ),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, size: 17, color: tint),
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: theme.textTheme.bodyMedium
                        ?.copyWith(fontWeight: FontWeight.w600),
                  ),
                  if (description.isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Text(
                      description,
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant,
                        height: 1.3,
                      ),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            Switch(value: value, onChanged: onChanged),
          ],
        ),
      ),
    );
  }
}

/// Read-only view of the category tree with a create action. Editing and
/// deleting stay on the web for now; deletion in particular has rules the
/// server enforces (a category with children or tickets cannot be removed).
class _CategorySection extends ConsumerWidget {
  const _CategorySection();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final async = ref.watch(settingsCategoriesProvider);
    final total = async.valueOrNull?.length;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SectionHeader(
          context.t('settings.categories'),
          trailing: total == null
              ? null
              : Pill(
                  label: '$total ${context.t('common.total')}',
                  color: theme.colorScheme.onSurfaceVariant,
                  outlined: true,
                ),
        ),
        Text(
          context.t('settings.categoriesDescription'),
          style: theme.textTheme.bodySmall
              ?.copyWith(color: theme.colorScheme.onSurfaceVariant),
        ),
        const SizedBox(height: AppSpacing.md),
        AppCard(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: async.when(
            loading: () => const Padding(
              padding: EdgeInsets.all(AppSpacing.lg),
              child: Center(child: CircularProgressIndicator()),
            ),
            error: (e, _) => ErrorView(
              message: describeError(e),
              onRetry: () => ref.invalidate(settingsCategoriesProvider),
            ),
            data: (categories) {
              final roots = rootCategories(categories);
              return Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (roots.isEmpty)
                    Padding(
                      padding:
                          const EdgeInsets.symmetric(vertical: AppSpacing.lg),
                      child: Text(
                        context.t('settings.categoriesEmpty'),
                        textAlign: TextAlign.center,
                        style: theme.textTheme.bodySmall?.copyWith(
                            color: theme.colorScheme.onSurfaceVariant),
                      ),
                    )
                  else
                    for (var i = 0; i < roots.length; i++) ...[
                      if (i > 0)
                        const Padding(
                          padding:
                              EdgeInsets.symmetric(vertical: AppSpacing.sm),
                          child: Divider(height: 1),
                        ),
                      _CategoryGroup(
                        root: roots[i],
                        children: childrenOf(categories, roots[i].id),
                      ),
                    ],
                  const SizedBox(height: AppSpacing.lg),
                  OutlinedButton.icon(
                    onPressed: () async {
                      final created = await Navigator.of(context).push<bool>(
                        MaterialPageRoute(
                            builder: (_) => const CategoryFormPage()),
                      );
                      if (created == true) {
                        ref.invalidate(settingsCategoriesProvider);
                      }
                    },
                    icon: const Icon(Icons.add, size: 18),
                    label: Text(context.t('settings.newCategory')),
                  ),
                ],
              );
            },
          ),
        ),
      ],
    );
  }
}

/// A top-level category and its children, drawn as a labelled group rather than
/// a flat indented list so the nesting survives long names wrapping.
class _CategoryGroup extends StatelessWidget {
  final Category root;
  final List<Category> children;

  const _CategoryGroup({required this.root, required this.children});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final accent = theme.colorScheme.primary;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Container(
              width: 30,
              height: 30,
              decoration: BoxDecoration(
                color: accent.withValues(alpha: isDark ? 0.20 : 0.10),
                borderRadius: BorderRadius.circular(9),
              ),
              child: Icon(Icons.folder_rounded, size: 16, color: accent),
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Text(
                root.name,
                style: theme.textTheme.bodyMedium
                    ?.copyWith(fontWeight: FontWeight.w600),
              ),
            ),
            if (children.isNotEmpty)
              Text(
                '${children.length}',
                style: theme.textTheme.labelSmall
                    ?.copyWith(color: theme.colorScheme.onSurfaceVariant),
              ),
          ],
        ),
        // Children hang off a rail dropped from the folder icon's centre, which
        // reads as nesting without needing a second icon on every row. The rail
        // uses `start` padding, not `left`, so it mirrors in Arabic.
        for (final child in children)
          IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Container(
                  width: 15,
                  margin: const EdgeInsetsDirectional.only(start: 14.5),
                  decoration: BoxDecoration(
                    border: BorderDirectional(
                      start: BorderSide(color: theme.colorScheme.outlineVariant),
                    ),
                  ),
                ),
                Expanded(
                  child: Padding(
                    padding: const EdgeInsetsDirectional.only(
                        start: AppSpacing.sm, top: 9, bottom: 3),
                    child: Text(
                      child.name,
                      style: theme.textTheme.bodySmall
                          ?.copyWith(color: theme.colorScheme.onSurfaceVariant),
                    ),
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}

final settingsCategoriesProvider = FutureProvider<List<Category>>(
  (ref) => ref.watch(ticketRepositoryProvider).categories(),
);
