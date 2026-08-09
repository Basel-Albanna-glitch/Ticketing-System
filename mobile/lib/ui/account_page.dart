import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/api_client.dart';
import '../i18n/i18n.dart';
import '../i18n/labels.dart';
import '../state/providers.dart';
import 'app_shell.dart';
import 'theme.dart';
import 'widgets/chips.dart';

final _preferencesProvider = FutureProvider<Map<String, bool>>(
  (ref) => ref.watch(miscRepositoryProvider).notificationPreferences(),
);

/// Field name -> translation key. Resolved at draw time, not stored as text.
const _preferenceLabels = {
  'email_on_new_comment': 'account.emailOnComment',
  'email_on_status_change': 'account.emailOnStatus',
  'email_on_assignment': 'account.emailOnAssignment',
};

class AccountPage extends ConsumerStatefulWidget {
  const AccountPage({super.key});

  @override
  ConsumerState<AccountPage> createState() => _AccountPageState();
}

class _AccountPageState extends ConsumerState<AccountPage> {
  final _fullName = TextEditingController();
  final _email = TextEditingController();
  bool _savingProfile = false;
  bool _seeded = false;

  @override
  void dispose() {
    _fullName.dispose();
    _email.dispose();
    super.dispose();
  }

  void _toast(String message, {bool error = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(message),
      backgroundColor: error ? Theme.of(context).colorScheme.error : null,
    ));
  }

  Future<void> _saveProfile() async {
    // Resolved up front: reading it after the awaits would be a use of
    // BuildContext across an async gap.
    final done = context.t('account.profileSaved');
    setState(() => _savingProfile = true);
    try {
      await ref.read(miscRepositoryProvider).updateProfile(
            fullName: _fullName.text.trim(),
            email: _email.text.trim(),
          );
      // Re-read /auth/me/ so the drawer header and initials update too.
      await ref.read(authProvider.notifier).reloadUser();
      _toast(done);
    } catch (e) {
      _toast(describeError(e), error: true);
    } finally {
      if (mounted) setState(() => _savingProfile = false);
    }
  }

  Future<void> _changePassword() async {
    final result = await showDialog<_PasswordInput>(
      context: context,
      builder: (_) => const _PasswordDialog(),
    );
    if (result == null) return;
    if (!mounted) return;
    final done = context.t('account.passwordChanged');
    try {
      await ref.read(miscRepositoryProvider).changePassword(
            oldPassword: result.oldPassword,
            newPassword: result.newPassword,
            confirmPassword: result.confirmPassword,
          );
      _toast(done);
    } catch (e) {
      _toast(describeError(e), error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).user;
    final prefs = ref.watch(_preferencesProvider);
    final theme = Theme.of(context);

    // Seed the fields once, so typing is not overwritten on later rebuilds.
    if (!_seeded && user != null) {
      _fullName.text = user.fullName;
      _email.text = user.email;
      _seeded = true;
    }

    return ShellScaffold(
      title: context.t('account.title'),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Center(
            child: CircleAvatar(
              radius: 40,
              backgroundColor: theme.colorScheme.primaryContainer,
              foregroundImage:
                  user?.avatarUrl == null ? null : NetworkImage(user!.avatarUrl!),
              child: Text(
                user?.initials ?? '?',
                style: theme.textTheme.headlineSmall?.copyWith(
                  color: theme.colorScheme.onPrimaryContainer,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ),
          const SizedBox(height: 8),
          Center(
            child: Text('@${user?.username ?? ''}',
                style: theme.textTheme.bodySmall
                    ?.copyWith(color: theme.colorScheme.outline)),
          ),
          const SizedBox(height: 24),
          AppCard(
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(context.t('account.profile'),
                      style: theme.textTheme.titleSmall
                          ?.copyWith(fontWeight: FontWeight.w700)),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _fullName,
                    decoration: InputDecoration(
                        labelText: context.t('account.fullName')),
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: _email,
                    keyboardType: TextInputType.emailAddress,
                    decoration: InputDecoration(
                        labelText: context.t('account.email')),
                  ),
                  const SizedBox(height: 14),
                  FilledButton(
                    onPressed: _savingProfile ? null : _saveProfile,
                    child: _savingProfile
                        ? const SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(strokeWidth: 2))
                        : Text(context.t('account.saveProfileButton')),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
          AppCard(
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(context.t('account.notifications'),
                      style: theme.textTheme.titleSmall
                          ?.copyWith(fontWeight: FontWeight.w700)),
                  const SizedBox(height: 4),
                  prefs.when(
                    loading: () => const Padding(
                      padding: EdgeInsets.all(16),
                      child: Center(child: CircularProgressIndicator()),
                    ),
                    error: (e, _) => ErrorView(
                      message: describeError(e),
                      onRetry: () => ref.invalidate(_preferencesProvider),
                    ),
                    data: (values) => Column(
                      children: [
                        for (final entry in _preferenceLabels.entries)
                          SwitchListTile(
                            contentPadding: EdgeInsets.zero,
                            title: Text(context.t(entry.value)),
                            value: values[entry.key] ?? true,
                            onChanged: (v) async {
                              try {
                                await ref
                                    .read(miscRepositoryProvider)
                                    .setNotificationPreference(entry.key, v);
                                ref.invalidate(_preferencesProvider);
                              } catch (e) {
                                _toast(describeError(e), error: true);
                              }
                            },
                          ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
          AppCard(
            child: ListTile(
              leading: const Icon(Icons.lock_outline),
              title: Text(context.t('account.changePassword')),
              trailing: Icon(forwardChevron(context)),
              onTap: _changePassword,
            ),
          ),
          const SizedBox(height: 24),
          OutlinedButton.icon(
            onPressed: () => ref.read(authProvider.notifier).logout(),
            icon: const Icon(Icons.logout),
            label: Text(context.t('common.signOut')),
          ),
        ],
      ),
    );
  }
}

class _PasswordInput {
  final String oldPassword;
  final String newPassword;
  final String confirmPassword;

  const _PasswordInput(this.oldPassword, this.newPassword, this.confirmPassword);
}

class _PasswordDialog extends StatefulWidget {
  const _PasswordDialog();

  @override
  State<_PasswordDialog> createState() => _PasswordDialogState();
}

class _PasswordDialogState extends State<_PasswordDialog> {
  final _old = TextEditingController();
  final _new = TextEditingController();
  final _confirm = TextEditingController();
  String? _error;

  @override
  void dispose() {
    _old.dispose();
    _new.dispose();
    _confirm.dispose();
    super.dispose();
  }

  void _submit() {
    // The server enforces both rules too; checking here avoids a pointless
    // round trip and keeps the dialog open with the message in place.
    if (_new.text.length < 8) {
      setState(() => _error = context.t('account.passwordTooShort'));
      return;
    }
    if (_new.text != _confirm.text) {
      setState(() => _error = context.t('account.passwordMismatch'));
      return;
    }
    Navigator.pop(context, _PasswordInput(_old.text, _new.text, _confirm.text));
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(context.t('account.changePassword')),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          TextField(
            controller: _old,
            obscureText: true,
            decoration: InputDecoration(
                labelText: context.t('account.currentPassword')),
          ),
          const SizedBox(height: 8),
          TextField(
            controller: _new,
            obscureText: true,
            decoration: InputDecoration(
                labelText: context.t('account.newPassword')),
          ),
          const SizedBox(height: 8),
          TextField(
            controller: _confirm,
            obscureText: true,
            decoration: InputDecoration(
                labelText: context.t('account.confirmNewPassword')),
          ),
          if (_error != null) ...[
            const SizedBox(height: 10),
            Text(_error!,
                style: TextStyle(color: Theme.of(context).colorScheme.error)),
          ],
        ],
      ),
      actions: [
        TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text(context.t('common.cancel'))),
        FilledButton(
            onPressed: _submit, child: Text(context.t('account.change'))),
      ],
    );
  }
}
