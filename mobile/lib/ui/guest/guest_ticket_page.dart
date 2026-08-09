import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api_client.dart';
import '../../core/attachment_picker.dart';
import '../../i18n/i18n.dart';
import '../../i18n/labels.dart';
import '../../models/ticket.dart';
import '../../state/providers.dart';
import '../../utils/category_tree.dart';
import '../theme.dart';
import '../widgets/attachments_field.dart';
import '../widgets/chips.dart';
import 'guest_track_page.dart';

final publicCategoriesProvider = FutureProvider<List<Category>>(
  (ref) => ref.watch(guestRepositoryProvider).categories(),
);

/// Submit a ticket without an account — the app's equivalent of /guest/new.
///
/// The form is split into "About you" and "Your request" rather than presented
/// as one long column: the two halves ask for completely different things, and
/// grouping them makes an eleven-field form read as two short ones.
class GuestTicketPage extends ConsumerStatefulWidget {
  const GuestTicketPage({super.key});

  @override
  ConsumerState<GuestTicketPage> createState() => _GuestTicketPageState();
}

class _GuestTicketPageState extends ConsumerState<GuestTicketPage> {
  final _formKey = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _company = TextEditingController();
  final _branch = TextEditingController();
  final _phone = TextEditingController();
  final _email = TextEditingController();
  final _subject = TextEditingController();
  final _description = TextEditingController();

  /// Whether the guest ticked "this is for a specific branch". The name they then
  /// type is free text — a guest has no customer, so no CustomerBranch to pick from.
  bool _hasBranch = false;
  int? _rootCategoryId;
  int? _subCategoryId;
  String _priority = TicketPriority.medium;
  List<PickedAttachment> _attachments = [];
  bool _saving = false;

  int? get _categoryId => _subCategoryId ?? _rootCategoryId;

  @override
  void dispose() {
    for (final c in [
      _name,
      _company,
      _branch,
      _phone,
      _email,
      _subject,
      _description
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) {
      // With the fields split across cards the offending one can be off-screen,
      // so say what happened rather than silently doing nothing.
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(context.t('guest.checkFields'))),
      );
      return;
    }
    setState(() => _saving = true);
    try {
      final ticket = await ref.read(guestRepositoryProvider).submit(
            name: _name.text.trim(),
            phone: _phone.text.trim(),
            company: _company.text.trim(),
            // An unticked box must never submit a branch, even if one was typed
            // and then hidden again.
            branch: _hasBranch ? _branch.text.trim() : '',
            email: _email.text.trim(),
            subject: _subject.text.trim(),
            description: _description.text.trim(),
            categoryId: _categoryId!,
            priority: _priority,
            attachmentPaths: [for (final a in _attachments) a.path],
          );
      if (!mounted) return;
      await _showReference(ticket.reference, ticket.id);
    } catch (e) {
      if (!mounted) return;
      setState(() => _saving = false);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(describeError(e)),
        backgroundColor: Theme.of(context).colorScheme.error,
      ));
    }
  }

  /// The reference number is the only route back to the ticket, so it gets a
  /// dialog that cannot be dismissed by tapping away.
  Future<void> _showReference(String reference, int id) async {
    final theme = Theme.of(context);
    final label = reference.isNotEmpty ? reference : '#$id';

    await showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        icon: Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: const Color(0xFF059669).withValues(alpha: 0.12),
            shape: BoxShape.circle,
          ),
          child: const Icon(Icons.check_rounded,
              color: Color(0xFF059669), size: 26),
        ),
        title: Text(context.t('guest.ticketSubmitted')),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              context.t('guest.saveReference'),
              textAlign: TextAlign.center,
              style: theme.textTheme.bodyMedium
                  ?.copyWith(color: theme.colorScheme.onSurfaceVariant),
            ),
            const SizedBox(height: AppSpacing.lg),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 14),
              decoration: BoxDecoration(
                color: theme.colorScheme.primary.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(AppRadius.control),
                border: Border.all(
                    color: theme.colorScheme.primary.withValues(alpha: 0.25)),
              ),
              child: SelectableText(
                label,
                textAlign: TextAlign.center,
                style: theme.textTheme.titleLarge?.copyWith(
                  letterSpacing: 0.5,
                  color: theme.colorScheme.primary,
                ),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.pop(context);
              Navigator.pop(context);
            },
            child: Text(context.t('common.done')),
          ),
          FilledButton(
            onPressed: () {
              Navigator.pop(context);
              Navigator.pushReplacement(
                context,
                MaterialPageRoute(
                  builder: (_) => GuestTrackPage(
                    initialReference: label.replaceFirst('#', ''),
                    initialPhone: _phone.text.trim(),
                  ),
                ),
              );
            },
            child: Text(context.t('guest.trackIt')),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final async = ref.watch(publicCategoriesProvider);

    return Scaffold(
      appBar: AppBar(title: Text(context.t('guest.submitTitle'))),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => ErrorView(
          message: describeError(e),
          onRetry: () => ref.invalidate(publicCategoriesProvider),
        ),
        data: (categories) {
          final subs = childrenOf(categories, _rootCategoryId);
          return Form(
            key: _formKey,
            child: ListView(
              padding: const EdgeInsets.all(AppSpacing.lg),
              children: [
                _Intro(),
                const SizedBox(height: AppSpacing.xl),

                _Section(
                  icon: Icons.person_outline,
                  title: context.t('guest.aboutYou'),
                  subtitle: context.t('guest.aboutYouHelp'),
                  children: [
                    _field(_name, context.t('guest.yourName'), required: true),
                    _field(
                      _phone,
                      context.t('guest.phoneNumber'),
                      required: true,
                      keyboardType: TextInputType.phone,
                      helper: context.t('guest.phoneHelp'),
                      validator: (v) {
                        final digits =
                            (v ?? '').replaceAll(RegExp(r'\D'), '').length;
                        // Mirrors validate_guest_phone on the server.
                        return digits < 6 ? context.t('guest.validPhone') : null;
                      },
                    ),
                    _field(_company, context.t('guest.company')),
                    CheckboxListTile(
                      value: _hasBranch,
                      // Clearing on untick keeps the hidden value out of state.
                      onChanged: (v) => setState(() {
                        _hasBranch = v ?? false;
                        if (!_hasBranch) _branch.clear();
                      }),
                      title: Text(context.t('guest.hasBranch'),
                          style: theme.textTheme.bodyMedium),
                      controlAffinity: ListTileControlAffinity.leading,
                      contentPadding: EdgeInsets.zero,
                      dense: true,
                    ),
                    if (_hasBranch)
                      _field(
                        _branch,
                        context.t('guest.branchName'),
                        required: true,
                        helper: context.t('guest.branchHelp'),
                      ),
                    _field(
                      _email,
                      'Email',
                      keyboardType: TextInputType.emailAddress,
                      helper: context.t('guest.emailHelp'),
                      last: true,
                    ),
                  ],
                ),

                const SizedBox(height: AppSpacing.md),

                _Section(
                  icon: Icons.support_agent_outlined,
                  title: context.t('guest.yourRequest'),
                  subtitle: context.t('guest.yourRequestHelp'),
                  children: [
                    _field(
                      _subject,
                      context.t('tickets.subject'),
                      required: true,
                      validator: (v) {
                        if (v == null || v.trim().isEmpty) {
                          return context.t('guest.subjectRequired');
                        }
                        // The server rejects a subject with no letters at all.
                        return RegExp(r'[^\W\d_]').hasMatch(v)
                            ? null
                            : context.t('guest.subjectText');
                      },
                    ),
                    DropdownButtonFormField<int>(
                      initialValue: _rootCategoryId,
                      isExpanded: true,
                      decoration: InputDecoration(
                          labelText: context.t('tickets.categoryRequired')),
                      items: [
                        for (final c in rootCategories(categories))
                          DropdownMenuItem(value: c.id, child: Text(c.name)),
                      ],
                      onChanged: (v) => setState(() {
                        _rootCategoryId = v;
                        _subCategoryId = null;
                      }),
                      validator: (v) =>
                          v == null ? context.t('tickets.pickCategory') : null,
                    ),
                    if (subs.isNotEmpty) ...[
                      const SizedBox(height: AppSpacing.md),
                      DropdownButtonFormField<int>(
                        initialValue: _subCategoryId,
                        isExpanded: true,
                        decoration:
                            InputDecoration(
                              labelText: context.t('tickets.subcategoryOptional')),
                        items: [
                          for (final c in subs)
                            DropdownMenuItem(value: c.id, child: Text(c.name)),
                        ],
                        onChanged: (v) => setState(() => _subCategoryId = v),
                      ),
                    ],
                    const SizedBox(height: AppSpacing.lg),
                    Text(context.t('tickets.howUrgent'),
                        style: theme.textTheme.labelLarge),
                    const SizedBox(height: AppSpacing.sm),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        for (final p in TicketPriority.all)
                          ChoiceChip(
                            label: Text(priorityLabel(context, p)),
                            selected: _priority == p,
                            // Tint the selection with the priority's own colour
                            // so urgency reads at a glance.
                            selectedColor:
                                priorityColor(p).withValues(alpha: 0.16),
                            side: BorderSide(
                              color: _priority == p
                                  ? priorityColor(p)
                                  : theme.colorScheme.outlineVariant,
                            ),
                            labelStyle: TextStyle(
                              color: _priority == p
                                  ? priorityColor(p)
                                  : theme.colorScheme.onSurface,
                              fontWeight: _priority == p
                                  ? FontWeight.w700
                                  : FontWeight.w500,
                            ),
                            showCheckmark: false,
                            onSelected: (_) => setState(() => _priority = p),
                          ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    _field(
                      _description,
                      context.t('tickets.describeError'),
                      required: true,
                      minLines: 5,
                      maxLines: 10,
                      helper: context.t('tickets.describeHelp'),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    AttachmentsField(
                      title: context.t('guest.attachmentsOptional'),
                      attachments: _attachments,
                      onChanged: (files) =>
                          setState(() => _attachments = files),
                    ),
                  ],
                ),

                const SizedBox(height: AppSpacing.xl),
                GradientButton(
                  onPressed: _saving ? null : _submit,
                  icon: _saving ? null : Icons.send_rounded,
                  child: _saving
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: Colors.white))
                      : Text(context.t('guest.submitTicket')),
                ),
                const SizedBox(height: AppSpacing.lg),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(context.t('guest.alreadyHave'),
                        style: theme.textTheme.bodySmall?.copyWith(
                            color: theme.colorScheme.onSurfaceVariant)),
                    TextButton(
                      onPressed: () => Navigator.of(context).pushReplacement(
                        MaterialPageRoute(
                            builder: (_) => const GuestTrackPage()),
                      ),
                      child: Text(context.t('guest.trackIt')),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.lg),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _field(
    TextEditingController controller,
    String label, {
    bool required = false,
    int minLines = 1,
    int maxLines = 1,
    TextInputType? keyboardType,
    String? helper,
    String? Function(String?)? validator,
    bool last = false,
  }) {
    return Padding(
      padding: EdgeInsets.only(bottom: last ? 0 : AppSpacing.md),
      child: TextFormField(
        controller: controller,
        minLines: minLines,
        maxLines: maxLines,
        keyboardType: keyboardType,
        textInputAction:
            maxLines > 1 ? TextInputAction.newline : TextInputAction.next,
        decoration: InputDecoration(
          labelText: required ? '$label *' : label,
          helperText: helper,
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

class _Intro extends StatelessWidget {
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
          child: const Icon(Icons.edit_note_rounded,
              color: Colors.white, size: 24),
        ),
        const SizedBox(width: AppSpacing.md),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(context.t('guest.noAccount'),
                  style: theme.textTheme.titleMedium),
              Text(
                context.t('guest.noAccountHelp'),
                style: theme.textTheme.bodySmall
                    ?.copyWith(color: theme.colorScheme.onSurfaceVariant),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// A titled group of fields on its own surface.
class _Section extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final List<Widget> children;

  const _Section({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.children,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return AppCard(
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
    );
  }
}
