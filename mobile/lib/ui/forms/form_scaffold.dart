import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../i18n/i18n.dart';
import '../theme.dart';

/// Shared chrome for every "create X" screen: an intro, grouped sections, one
/// primary action, and uniform error reporting.
///
/// Every create endpoint enforces its own permissions, so a rejected save comes
/// back as a 403 with a readable message. [FormScaffold] surfaces the server's
/// wording verbatim rather than inventing its own — the API explains *why*
/// (e.g. an agent lacking the manage-knowledge-base permission) better than the
/// client can guess.
class FormScaffold extends StatefulWidget {
  final String title;
  final String submitLabel;
  final List<Widget> Function(BuildContext context) fields;
  final GlobalKey<FormState> formKey;

  /// Optional heading above the fields.
  final IconData? headerIcon;
  final String? headerTitle;
  final String? headerSubtitle;

  /// Performs the save. Return value is passed back through `Navigator.pop`.
  final Future<void> Function() onSubmit;

  const FormScaffold({
    super.key,
    required this.title,
    required this.formKey,
    required this.fields,
    required this.onSubmit,
    required this.submitLabel,
    this.headerIcon,
    this.headerTitle,
    this.headerSubtitle,
  });

  @override
  State<FormScaffold> createState() => _FormScaffoldState();
}

class _FormScaffoldState extends State<FormScaffold> {
  bool _saving = false;

  Future<void> _submit() async {
    if (!widget.formKey.currentState!.validate()) {
      // Fields are spread across cards, so the offending one can be off-screen;
      // silence would look like a broken button.
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(context.t('guest.checkFields'))),
      );
      return;
    }
    setState(() => _saving = true);
    try {
      await widget.onSubmit();
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } catch (e) {
      if (!mounted) return;
      setState(() => _saving = false);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(describeError(e)),
        backgroundColor: Theme.of(context).colorScheme.error,
      ));
    }
  }

  @override
  Widget build(BuildContext context) {
    final showHeader = widget.headerTitle != null;

    return Scaffold(
      appBar: AppBar(title: Text(widget.title)),
      body: Form(
        key: widget.formKey,
        child: ListView(
          padding: const EdgeInsets.all(AppSpacing.lg),
          children: [
            if (showHeader) ...[
              FormIntro(
                icon: widget.headerIcon ?? Icons.edit_note_rounded,
                title: widget.headerTitle!,
                subtitle: widget.headerSubtitle ?? '',
              ),
              const SizedBox(height: AppSpacing.xl),
            ],
            ...widget.fields(context),
            const SizedBox(height: AppSpacing.xl),
            GradientButton(
              onPressed: _saving ? null : _submit,
              icon: _saving ? null : Icons.check_rounded,
              child: _saving
                  ? const SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: Colors.white),
                    )
                  : Text(widget.submitLabel),
            ),
            const SizedBox(height: AppSpacing.lg),
            Center(
              child: Text(
                context.t('forms.requiredNote'),
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant),
              ),
            ),
            const SizedBox(height: AppSpacing.xl),
          ],
        ),
      ),
    );
  }
}

/// Gradient mark plus a line explaining what the screen is for.
class FormIntro extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;

  const FormIntro({
    super.key,
    required this.icon,
    required this.title,
    this.subtitle = '',
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Row(
      children: [
        Container(
          width: 46,
          height: 46,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            gradient: const LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [Color(0xFF6366F1), seedColor],
            ),
          ),
          child: Icon(icon, color: Colors.white, size: 24),
        ),
        const SizedBox(width: AppSpacing.md),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: theme.textTheme.titleMedium),
              if (subtitle.isNotEmpty)
                Text(subtitle,
                    style: theme.textTheme.bodySmall?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant)),
            ],
          ),
        ),
      ],
    );
  }
}

/// A titled group of fields on its own surface. Splitting a long form into
/// labelled groups makes it read as several short ones.
class FormSection extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final List<Widget> children;

  const FormSection({
    super.key,
    required this.icon,
    required this.title,
    required this.children,
    this.subtitle = '',
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.md),
      child: AppCard(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, size: 18, color: theme.colorScheme.primary),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(title, style: theme.textTheme.titleSmall),
                      if (subtitle.isNotEmpty)
                        Text(subtitle,
                            style: theme.textTheme.bodySmall?.copyWith(
                                color: theme.colorScheme.onSurfaceVariant)),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.lg),
            ...children,
          ],
        ),
      ),
    );
  }
}

/// Standard text field for these forms — consistent spacing and validation.
class FormTextField extends StatelessWidget {
  final TextEditingController controller;
  final String label;
  final bool required;
  final bool obscure;
  final int minLines;
  final int maxLines;
  final TextInputType? keyboardType;
  final String? helper;
  final IconData? icon;
  final String? Function(String?)? validator;

  /// Greys the field out and blocks input, for values that exist but cannot be
  /// changed here (an account's username, say).
  final bool enabled;

  /// Suppresses the trailing gap, so the last field in a section does not leave
  /// a dead strip above the card edge.
  final bool last;

  const FormTextField({
    super.key,
    required this.controller,
    required this.label,
    this.required = false,
    this.obscure = false,
    this.minLines = 1,
    this.maxLines = 1,
    this.keyboardType,
    this.helper,
    this.icon,
    this.validator,
    this.enabled = true,
    this.last = false,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: last ? 0 : AppSpacing.md),
      child: TextFormField(
        controller: controller,
        enabled: enabled,
        obscureText: obscure,
        minLines: obscure ? 1 : minLines,
        maxLines: obscure ? 1 : maxLines,
        keyboardType: keyboardType,
        autocorrect: !obscure,
        textInputAction:
            maxLines > 1 ? TextInputAction.newline : TextInputAction.next,
        decoration: InputDecoration(
          labelText: required ? '$label *' : label,
          helperText: helper,
          prefixIcon: icon == null ? null : Icon(icon, size: 20),
          alignLabelWithHint: maxLines > 1,
        ),
        validator: validator ??
            (required
                ? (v) => (v == null || v.trim().isEmpty)
                    ? '$label is required'
                    : null
                : null),
      ),
    );
  }
}
