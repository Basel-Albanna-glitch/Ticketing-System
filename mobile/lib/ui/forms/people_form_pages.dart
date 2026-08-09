import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../i18n/i18n.dart';
import '../../state/providers.dart';
import '../theme.dart';
import 'form_scaffold.dart';

/// Create a staff account. Admin-only; role must be agent or admin.
class AgentFormPage extends ConsumerStatefulWidget {
  const AgentFormPage({super.key});

  @override
  ConsumerState<AgentFormPage> createState() => _AgentFormPageState();
}

class _AgentFormPageState extends ConsumerState<AgentFormPage> {
  final _formKey = GlobalKey<FormState>();
  final _username = TextEditingController();
  final _fullName = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  String _role = 'agent';
  bool _available = true;

  @override
  void dispose() {
    for (final c in [_username, _fullName, _email, _password]) {
      c.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return FormScaffold(
      title: context.t('agents.new'),
      formKey: _formKey,
      submitLabel: context.t('agents.create'),
      headerIcon: Icons.badge_outlined,
      headerTitle: context.t('agents.addTitle'),
      headerSubtitle: context.t('agents.addSubtitle'),
      fields: (context) => [
        FormSection(
          icon: Icons.person_outline,
          title: context.t('agents.identity'),
          subtitle: context.t('agents.identitySubtitle'),
          children: [
            FormTextField(
                controller: _fullName,
                label: context.t('customers.fullName'),
                required: true,
                icon: Icons.badge_outlined),
            FormTextField(
                controller: _email,
                label: context.t('customers.email'),
                keyboardType: TextInputType.emailAddress,
                icon: Icons.mail_outline,
                last: true),
          ],
        ),
        FormSection(
          icon: Icons.lock_outline,
          title: context.t('agents.signIn'),
          subtitle: context.t('agents.signInSubtitle'),
          children: [
            FormTextField(
                controller: _username,
                label: context.t('auth.username'),
                required: true,
                icon: Icons.alternate_email),
            FormTextField(
              controller: _password,
              label: context.t('auth.password'),
              required: true,
              obscure: true,
              icon: Icons.key_outlined,
              helper: context.t('customers.passwordHelp'),
              validator: (v) =>
                  (v == null || v.length < 8)
                      ? context.t('customers.passwordShort')
                      : null,
              last: true,
            ),
          ],
        ),
        FormSection(
          icon: Icons.tune,
          title: context.t('agents.roleAvailability'),
          subtitle: context.t('agents.roleSubtitle'),
          children: [
            DropdownButtonFormField<String>(
              initialValue: _role,
              decoration: InputDecoration(labelText: context.t('agents.role')),
              items: [
                DropdownMenuItem(
                    value: 'agent', child: Text(context.t('role.agent'))),
                DropdownMenuItem(
                    value: 'admin', child: Text(context.t('role.admin'))),
              ],
              onChanged: (v) => setState(() => _role = v ?? 'agent'),
            ),
            const SizedBox(height: AppSpacing.sm),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(context.t('agents.availableForAssignment')),
              subtitle: Text(
                context.t('agents.availableHelp'),
                style: theme.textTheme.bodySmall
                    ?.copyWith(color: theme.colorScheme.onSurfaceVariant),
              ),
              value: _available,
              onChanged: (v) => setState(() => _available = v),
            ),
          ],
        ),
      ],
      onSubmit: () => ref.read(miscRepositoryProvider).createAgent(
            username: _username.text.trim(),
            fullName: _fullName.text.trim(),
            password: _password.text,
            email: _email.text.trim(),
            role: _role,
            isAvailable: _available,
          ),
    );
  }
}
