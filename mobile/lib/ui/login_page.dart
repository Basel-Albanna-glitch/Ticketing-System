import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/config.dart';
import '../i18n/i18n.dart';
import '../state/providers.dart';
import 'guest/guest_ticket_page.dart';
import 'guest/guest_track_page.dart';
import 'theme.dart';
import 'widgets/language_button.dart';
import 'widgets/theme_mode_button.dart';

class LoginPage extends ConsumerStatefulWidget {
  const LoginPage({super.key});

  @override
  ConsumerState<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends ConsumerState<LoginPage> {
  final _formKey = GlobalKey<FormState>();
  final _username = TextEditingController();
  final _password = TextEditingController();
  bool _obscure = true;

  @override
  void dispose() {
    _username.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    FocusScope.of(context).unfocus();
    await ref
        .read(authProvider.notifier)
        .login(_username.text.trim(), _password.text);
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authProvider);
    final theme = Theme.of(context);

    return Scaffold(
      body: SafeArea(
        // Stacked rather than placed in the Column so the sign-in card stays
        // vertically centred; a top row would push it down.
        child: Stack(
          children: [
            Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 420),
                  child: Form(
                    key: _formKey,
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Center(
                          child: Container(
                            width: 64,
                            height: 64,
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(20),
                              gradient: const LinearGradient(
                                begin: Alignment.topLeft,
                                end: Alignment.bottomRight,
                                colors: [Color(0xFF6366F1), seedColor],
                              ),
                              boxShadow: [
                                BoxShadow(
                                  color: seedColor.withValues(alpha: 0.35),
                                  blurRadius: 24,
                                  offset: const Offset(0, 10),
                                ),
                              ],
                            ),
                            child: const Icon(Icons.confirmation_number_rounded,
                                size: 32, color: Colors.white),
                          ),
                        ),
                        const SizedBox(height: AppSpacing.xl),
                        Text(context.t('common.appName'),
                            textAlign: TextAlign.center,
                            style: theme.textTheme.headlineSmall),
                        const SizedBox(height: AppSpacing.xs),
                        Text(context.t('auth.signInToAccount'),
                            textAlign: TextAlign.center,
                            style: theme.textTheme.bodyMedium?.copyWith(
                                color: theme.colorScheme.onSurfaceVariant)),
                        const SizedBox(height: 28),
                        TextFormField(
                          controller: _username,
                          autocorrect: false,
                          textInputAction: TextInputAction.next,
                          decoration: InputDecoration(
                            labelText: context.t('auth.username'),
                            prefixIcon: const Icon(Icons.person_outline),
                          ),
                          validator: (v) => (v == null || v.trim().isEmpty)
                              ? context.t('auth.enterUsername')
                              : null,
                        ),
                        const SizedBox(height: 12),
                        TextFormField(
                          controller: _password,
                          obscureText: _obscure,
                          onFieldSubmitted: (_) => _submit(),
                          decoration: InputDecoration(
                            labelText: context.t('auth.password'),
                            prefixIcon: const Icon(Icons.lock_outline),
                            suffixIcon: IconButton(
                              icon: Icon(_obscure
                                  ? Icons.visibility_outlined
                                  : Icons.visibility_off_outlined),
                              onPressed: () =>
                                  setState(() => _obscure = !_obscure),
                            ),
                          ),
                          validator: (v) => (v == null || v.isEmpty)
                              ? context.t('auth.enterPassword')
                              : null,
                        ),
                        if (auth.error != null) ...[
                          const SizedBox(height: 16),
                          Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: theme.colorScheme.errorContainer,
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Text(
                              auth.error!,
                              style: TextStyle(
                                  color: theme.colorScheme.onErrorContainer),
                            ),
                          ),
                        ],
                        const SizedBox(height: AppSpacing.xl),
                        GradientButton(
                          onPressed: auth.loading ? null : _submit,
                          child: auth.loading
                              ? const SizedBox(
                                  height: 20,
                                  width: 20,
                                  child: CircularProgressIndicator(
                                      strokeWidth: 2, color: Colors.white))
                              : Text(context.t('auth.signIn')),
                        ),
                        const SizedBox(height: AppSpacing.xl),
                        // Guests have no account by definition, so these are the
                        // only way into the public flows.
                        Row(
                          children: [
                            Expanded(
                                child: Divider(
                                    color: theme.colorScheme.outlineVariant)),
                            Padding(
                              padding:
                                  const EdgeInsets.symmetric(horizontal: 12),
                              child: Text(context.t('common.or'),
                                  style: theme.textTheme.bodySmall?.copyWith(
                                      color:
                                          theme.colorScheme.onSurfaceVariant)),
                            ),
                            Expanded(
                                child: Divider(
                                    color: theme.colorScheme.outlineVariant)),
                          ],
                        ),
                        const SizedBox(height: AppSpacing.lg),
                        OutlinedButton.icon(
                          onPressed: () => Navigator.of(context).push(
                            MaterialPageRoute(
                                builder: (_) => const GuestTicketPage()),
                          ),
                          icon: const Icon(Icons.edit_note, size: 18),
                          label: Text(context.t('auth.submitNoAccount')),
                        ),
                        const SizedBox(height: AppSpacing.sm),
                        OutlinedButton.icon(
                          onPressed: () => Navigator.of(context).push(
                            MaterialPageRoute(
                                builder: (_) => const GuestTrackPage()),
                          ),
                          icon: const Icon(Icons.search, size: 18),
                          label: Text(context.t('auth.trackExisting')),
                        ),
                        const SizedBox(height: AppSpacing.xl),
                        // Surfaced deliberately: the wrong host is the single most
                        // common reason a first run fails, and it is invisible
                        // otherwise.
                        Text(
                          ApiConfig.baseUrl,
                          textAlign: TextAlign.center,
                          style: theme.textTheme.bodySmall
                              ?.copyWith(color: theme.colorScheme.outline),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
            // Directional so it sits top-left in Arabic.
            const PositionedDirectional(
              top: 4,
              end: 4,
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [LanguageButton(), ThemeModeButton()],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
