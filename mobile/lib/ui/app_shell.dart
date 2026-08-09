import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/config.dart';
import '../i18n/i18n.dart';
import '../models/user.dart';
import '../state/providers.dart';
import 'account_page.dart';
import 'agents_page.dart';
import 'calendar_page.dart';
import 'customers_page.dart';
import 'dashboard_page.dart';
import 'kb_list_page.dart';
import 'notifications_page.dart';
import 'projects_page.dart';
import 'todo_page.dart';
import 'reports_page.dart';
import 'settings_page.dart';
import 'tickets_page.dart';

/// A destination in the drawer. Roles mirror NAV_ITEMS in
/// frontend/src/components/layout/Sidebar.jsx so the two clients agree on who
/// sees what — the server enforces it regardless.
class NavItem {
  /// Translation key, not display text — this list is built once at startup but
  /// has to re-read in the current language on every rebuild, so the label is
  /// resolved in [label] rather than stored.
  final String labelKey;

  final IconData icon;
  final List<String> roles;
  final Widget Function() build;

  /// Optional shorter label key for the bottom tab, where space is tight
  /// ("Knowledge base" does not fit under an icon).
  final String? tabLabelKey;

  const NavItem({
    required this.labelKey,
    required this.icon,
    required this.roles,
    required this.build,
    this.tabLabelKey,
  });

  String label(BuildContext context) => context.t(labelKey);

  String shortLabel(BuildContext context) =>
      context.t(tabLabelKey ?? labelKey);

  bool allows(AppUser? user) => user != null && roles.contains(user.role);
}

final navItems = <NavItem>[
  NavItem(
    labelKey: 'nav.dashboard',
    icon: Icons.dashboard_outlined,
    roles: const ['customer', 'agent', 'admin'],
    build: () => const DashboardPage(),
  ),
  NavItem(
    labelKey: 'nav.tickets',
    icon: Icons.confirmation_number_outlined,
    roles: const ['customer', 'agent', 'admin'],
    build: () => const TicketsPage(),
  ),
  NavItem(
    labelKey: 'nav.calendar',
    icon: Icons.calendar_month_outlined,
    roles: const ['customer', 'agent', 'admin'],
    build: () => const CalendarPage(),
  ),
  NavItem(
    labelKey: 'nav.kb',
    tabLabelKey: 'kb.tabShort',
    icon: Icons.menu_book_outlined,
    roles: const ['customer', 'agent', 'admin'],
    build: () => const KbListPage(),
  ),
  NavItem(
    labelKey: 'nav.projects',
    icon: Icons.view_kanban_outlined,
    roles: const ['agent', 'admin'],
    build: () => const ProjectsPage(),
  ),
  NavItem(
    labelKey: 'nav.todo',
    icon: Icons.checklist_outlined,
    roles: const ['agent', 'admin'],
    build: () => const TodoPage(),
  ),
  NavItem(
    labelKey: 'nav.customers',
    icon: Icons.people_outline,
    roles: const ['agent', 'admin'],
    build: () => const CustomersPage(),
  ),
  NavItem(
    labelKey: 'nav.agents',
    icon: Icons.badge_outlined,
    roles: const ['admin'],
    build: () => const AgentsPage(),
  ),
  NavItem(
    labelKey: 'nav.reports',
    icon: Icons.insights_outlined,
    roles: const ['admin'],
    build: () => const ReportsPage(),
  ),
  NavItem(
    labelKey: 'nav.notifications',
    icon: Icons.notifications_outlined,
    roles: const ['customer', 'agent', 'admin'],
    build: () => const NotificationsPage(),
  ),
  NavItem(
    labelKey: 'nav.account',
    icon: Icons.person_outline,
    roles: const ['customer', 'agent', 'admin'],
    build: () => const AccountPage(),
  ),
  NavItem(
    labelKey: 'nav.settings',
    icon: Icons.settings_outlined,
    roles: const ['customer', 'agent', 'admin'],
    build: () => const SettingsPage(),
  ),
];

/// Key for the shell's Scaffold.
///
/// Pages build their own nested Scaffold, so `Scaffold.of` inside a page finds
/// that inner one — which has no drawer. The menu button therefore needs a
/// direct handle on the outer Scaffold to open it.
final shellScaffoldKeyProvider =
    Provider<GlobalKey<ScaffoldState>>((ref) => GlobalKey<ScaffoldState>());

/// How many destinations get a bottom tab; the rest live in the drawer.
const _tabCount = 4;

/// Hosts the drawer, the bottom tabs, and swaps the body between destinations.
class AppShell extends ConsumerStatefulWidget {
  const AppShell({super.key});

  @override
  ConsumerState<AppShell> createState() => _AppShellState();
}

class _AppShellState extends ConsumerState<AppShell> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).user;
    final items = navItems.where((i) => i.allows(user)).toList();
    if (items.isEmpty) return const SizedBox.shrink();

    final index = _index.clamp(0, items.length - 1);
    final tabs = items.take(_tabCount).toList();
    final key = ref.watch(shellScaffoldKeyProvider);

    return Scaffold(
      key: key,
      drawer: _Drawer(
        user: user,
        items: items,
        selected: index,
        onSelect: (i) {
          setState(() => _index = i);
          Navigator.pop(context);
        },
        onSignOut: () {
          Navigator.pop(context);
          ref.read(authProvider.notifier).logout();
        },
      ),
      body: items[index].build(),
      bottomNavigationBar: NavigationBar(
        // Anything past the first few destinations is reachable through the
        // drawer, so "More" stays highlighted while one of those is open.
        selectedIndex: index < tabs.length ? index : tabs.length,
        onDestinationSelected: (i) {
          if (i < tabs.length) {
            setState(() => _index = i);
          } else {
            key.currentState?.openDrawer();
          }
        },
        destinations: [
          for (final item in tabs)
            NavigationDestination(
              icon: Icon(item.icon),
              label: item.shortLabel(context),
            ),
          NavigationDestination(
            icon: const Icon(Icons.menu),
            label: context.t('nav.more'),
          ),
        ],
      ),
    );
  }
}

/// Scaffold wrapper used by every destination so they all get the same drawer
/// button and notification bell without repeating the plumbing.
class ShellScaffold extends ConsumerWidget {
  final String title;
  final Widget body;
  final Widget? floatingActionButton;
  final PreferredSizeWidget? bottom;
  final List<Widget> actions;
  final bool showBell;

  const ShellScaffold({
    super.key,
    required this.title,
    required this.body,
    this.floatingActionButton,
    this.bottom,
    this.actions = const [],
    this.showBell = true,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final unread = ref.watch(unreadCountProvider);
    return Scaffold(
      appBar: AppBar(
        // Explicit: this page's own Scaffold has no drawer, so AppBar would not
        // draw a menu button on its own. It opens the shell's drawer directly.
        leading: IconButton(
          icon: const Icon(Icons.menu),
          tooltip: context.t('common.menu'),
          onPressed: () =>
              ref.read(shellScaffoldKeyProvider).currentState?.openDrawer(),
        ),
        title: Text(title),
        actions: [
          ...actions,
          if (showBell)
            Stack(
              alignment: Alignment.center,
              children: [
                IconButton(
                  icon: const Icon(Icons.notifications_outlined),
                  tooltip: context.t('nav.notifications'),
                  onPressed: () => Navigator.of(context).push(
                    MaterialPageRoute(
                        builder: (_) => const NotificationsPage(standalone: true)),
                  ),
                ),
                if (unread > 0)
                  Positioned(
                    top: 8,
                    right: 8,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                      decoration: BoxDecoration(
                        color: Theme.of(context).colorScheme.error,
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text(
                        unread > 99 ? '99+' : '$unread',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          color: Theme.of(context).colorScheme.onError,
                        ),
                      ),
                    ),
                  ),
              ],
            ),
        ],
        bottom: bottom,
      ),
      body: body,
      floatingActionButton: floatingActionButton,
    );
  }
}

class _Drawer extends StatelessWidget {
  final AppUser? user;
  final List<NavItem> items;
  final int selected;
  final ValueChanged<int> onSelect;
  final VoidCallback onSignOut;

  const _Drawer({
    required this.user,
    required this.items,
    required this.selected,
    required this.onSelect,
    required this.onSignOut,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Drawer(
      child: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 20, 16, 16),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 24,
                    backgroundColor: theme.colorScheme.primaryContainer,
                    foregroundImage: user?.avatarUrl == null
                        ? null
                        : NetworkImage(user!.avatarUrl!),
                    child: Text(
                      user?.initials ?? '?',
                      style: TextStyle(
                        color: theme.colorScheme.onPrimaryContainer,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          user?.fullName ?? '',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: theme.textTheme.titleSmall
                              ?.copyWith(fontWeight: FontWeight.w700),
                        ),
                        Text(
                          // Admins and agents share a UI, so showing the role
                          // is the only way to tell which one you are.
                          user == null ? '' : _roleLabel(context, user!.role),
                          style: theme.textTheme.bodySmall
                              ?.copyWith(color: theme.colorScheme.outline),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const Divider(height: 1),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.symmetric(vertical: 8),
                children: [
                  for (var i = 0; i < items.length; i++)
                    ListTile(
                      leading: Icon(items[i].icon),
                      title: Text(items[i].label(context)),
                      selected: i == selected,
                      selectedColor: theme.colorScheme.primary,
                      onTap: () => onSelect(i),
                    ),
                ],
              ),
            ),
            const Divider(height: 1),
            ListTile(
              leading: const Icon(Icons.logout),
              title: Text(context.t('common.signOut')),
              onTap: onSignOut,
            ),
            Padding(
              padding: const EdgeInsets.all(12),
              child: Text(
                ApiConfig.baseUrl,
                style: theme.textTheme.bodySmall
                    ?.copyWith(color: theme.colorScheme.outline),
              ),
            ),
          ],
        ),
      ),
    );
  }

  static String _roleLabel(BuildContext context, String role) =>
      switch (role) {
        'admin' => context.t('role.admin'),
        'agent' => context.t('role.agent'),
        _ => context.t('role.customer'),
      };
}
