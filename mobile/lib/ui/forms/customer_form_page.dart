import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../core/attachment_picker.dart';
import '../../i18n/i18n.dart';
import '../../models/customer.dart';
import '../../state/providers.dart';
import '../theme.dart';
import '../widgets/attachments_field.dart';
import 'form_scaffold.dart';

final softwareTypesProvider = FutureProvider<List<SoftwareType>>(
  (ref) => ref.watch(miscRepositoryProvider).softwareTypes(),
);

/// One editable branch row in the form.
class _BranchDraft {
  final name = TextEditingController();
  final address = TextEditingController();

  _BranchDraft();

  _BranchDraft.from(CustomerBranch branch) {
    name.text = branch.name;
    address.text = branch.address;
  }

  void dispose() {
    name.dispose();
    address.dispose();
  }

  bool get isEmpty =>
      name.text.trim().isEmpty && address.text.trim().isEmpty;

  Map<String, String?> toJson() => {
        'name': name.text.trim(),
        'address': address.text.trim(),
      };
}

/// One editable licence row. Dates are optional and sent as YYYY-MM-DD.
class _LicenseDraft {
  final name = TextEditingController();
  DateTime? start;
  DateTime? end;

  _LicenseDraft();

  _LicenseDraft.from(CustomerLicense license) {
    name.text = license.name;
    start = license.startDate;
    end = license.endDate;
  }

  void dispose() => name.dispose();

  bool get isEmpty => name.text.trim().isEmpty && start == null && end == null;

  static String? _day(DateTime? d) => d == null
      ? null
      : '${d.year.toString().padLeft(4, '0')}-'
          '${d.month.toString().padLeft(2, '0')}-'
          '${d.day.toString().padLeft(2, '0')}';

  Map<String, String?> toJson() => {
        'name': name.text.trim(),
        'start_date': _day(start),
        'end_date': _day(end),
      };
}

/// Create or edit a customer account, with everything the web form carries:
/// contact details, software type, branches, licences and file attachments.
///
/// Creating is admin-only; editing also opens up to agents when
/// `allow_agent_edit_customers` is on (CustomerViewSet.get_permissions). The
/// caller decides which — this page only draws what it is given.
///
/// Pass [customer] to edit an existing account; omit it to create a new one.
class CustomerFormPage extends ConsumerStatefulWidget {
  final Customer? customer;

  const CustomerFormPage({super.key, this.customer});

  @override
  ConsumerState<CustomerFormPage> createState() => _CustomerFormPageState();
}

class _CustomerFormPageState extends ConsumerState<CustomerFormPage> {
  final _formKey = GlobalKey<FormState>();
  final _username = TextEditingController();
  final _fullName = TextEditingController();
  final _email = TextEditingController();
  final _phone = TextEditingController();
  final _address = TextEditingController();
  final _taxNumber = TextEditingController();
  final _password = TextEditingController();

  /// A SoftwareType *name*; '' means none. The field is free text server-side,
  /// so the dropdown exists only to keep the spelling consistent.
  String _softwareType = '';

  final List<_BranchDraft> _branches = [];
  final List<_LicenseDraft> _licenses = [];
  List<PickedAttachment> _attachments = [];

  Customer? get _editing => widget.customer;

  @override
  void initState() {
    super.initState();
    final c = _editing;
    if (c == null) return;
    _username.text = c.username;
    _fullName.text = c.fullName;
    _email.text = c.email;
    _phone.text = c.phone;
    _address.text = c.address;
    _taxNumber.text = c.taxNumber;
    _softwareType = c.softwareType;
    _branches.addAll(c.branches.map(_BranchDraft.from));
    _licenses.addAll(c.licenses.map(_LicenseDraft.from));
  }

  @override
  void dispose() {
    for (final c in [
      _username,
      _fullName,
      _email,
      _phone,
      _address,
      _taxNumber,
      _password,
    ]) {
      c.dispose();
    }
    for (final b in _branches) {
      b.dispose();
    }
    for (final l in _licenses) {
      l.dispose();
    }
    super.dispose();
  }

  Future<DateTime?> _pickDate(DateTime? initial) {
    final now = DateTime.now();
    return showDatePicker(
      context: context,
      initialDate: initial ?? now,
      firstDate: DateTime(now.year - 10),
      lastDate: DateTime(now.year + 20),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final softwareTypes =
        ref.watch(softwareTypesProvider).valueOrNull ?? const [];
    final editing = _editing != null;

    return FormScaffold(
      title: context.t(editing ? 'customers.edit' : 'customers.new'),
      formKey: _formKey,
      submitLabel: context
          .t(editing ? 'common.saveChanges' : 'customers.createCustomer'),
      headerIcon: Icons.apartment_outlined,
      headerTitle:
          context.t(editing ? 'customers.editTitle' : 'customers.addTitle'),
      headerSubtitle: context.t('customers.subtitle'),
      fields: (context) => [
        FormSection(
          icon: Icons.person_outline,
          title: context.t('customers.identity'),
          subtitle: context.t('customers.identitySubtitle'),
          children: [
            FormTextField(
                controller: _fullName,
                label: context.t('customers.fullName'),
                required: true,
                icon: Icons.badge_outlined),
            FormTextField(
                controller: _taxNumber,
                label: context.t('customers.taxNumber'),
                icon: Icons.receipt_long_outlined,
                last: true),
          ],
        ),
        FormSection(
          icon: Icons.lock_outline,
          title: context.t('customers.signIn'),
          subtitle: context.t('customers.signInSubtitle'),
          children: [
            // Locked once the account exists: the web's edit form omits
            // `username` from its payload, so it is effectively immutable.
            FormTextField(
              controller: _username,
              label: context.t('auth.username'),
              required: !editing,
              enabled: !editing,
              icon: Icons.alternate_email,
              helper: editing ? context.t('customers.usernameLocked') : null,
            ),
            // On edit the password is optional — the serializer only calls
            // set_password when a non-empty one is sent, so a blank field
            // leaves the customer's existing password alone.
            FormTextField(
              controller: _password,
              label: context.t(editing ? 'customers.newPassword' : 'auth.password'),
              required: !editing,
              obscure: true,
              icon: Icons.key_outlined,
              helper: editing
                  ? context.t('customers.passwordKeep')
                  : context.t('customers.passwordHelp'),
              validator: (v) {
                final value = v ?? '';
                if (editing && value.isEmpty) return null;
                return value.length < 8
                    ? context.t('customers.passwordShort')
                    : null;
              },
              last: true,
            ),
          ],
        ),
        FormSection(
          icon: Icons.contact_phone_outlined,
          title: context.t('customers.contact'),
          subtitle: context.t('customers.contactSubtitle'),
          children: [
            FormTextField(
                controller: _email,
                label: context.t('customers.email'),
                keyboardType: TextInputType.emailAddress,
                icon: Icons.mail_outline),
            FormTextField(
                controller: _phone,
                label: context.t('customers.phone'),
                keyboardType: TextInputType.phone,
                icon: Icons.phone_outlined),
            FormTextField(
                controller: _address,
                label: context.t('customers.address'),
                maxLines: 2,
                icon: Icons.location_on_outlined,
                last: true),
          ],
        ),
        FormSection(
          icon: Icons.memory_outlined,
          title: context.t('customers.software'),
          subtitle: context.t('customers.softwareSubtitle'),
          children: [
            DropdownButtonFormField<String>(
              // Values are names, not ids. A customer saved with a name that
              // has since been renamed or removed would otherwise have no
              // matching item and the dropdown would assert, so that value is
              // added back as its own entry.
              initialValue: _softwareType.isEmpty ? '' : _softwareType,
              isExpanded: true,
              decoration: InputDecoration(
                  labelText: context.t('customers.softwareType')),
              items: [
                DropdownMenuItem(value: '', child: Text(context.t('common.select'))),
                for (final s in softwareTypes)
                  DropdownMenuItem(value: s.name, child: Text(s.name)),
                if (_softwareType.isNotEmpty &&
                    !softwareTypes.any((s) => s.name == _softwareType))
                  DropdownMenuItem(
                    value: _softwareType,
                    child: Text('$_softwareType '
                        '(${context.t('customers.softwareUnlisted')})'),
                  ),
              ],
              onChanged: (v) => setState(() => _softwareType = v ?? ''),
            ),
          ],
        ),
        AppCard(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Column(children: [
        _GroupHeader(
          title: context.t('customers.branches'),
          count: _branches.length,
          onAdd: () => setState(() => _branches.add(_BranchDraft())),
        ),
        for (var i = 0; i < _branches.length; i++)
          Padding(
            padding: const EdgeInsets.only(bottom: AppSpacing.md),
            child: AppCard(
              padding: const EdgeInsets.fromLTRB(12, 12, 12, 4),
              child: Column(
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text('${context.t('customers.branch')} ${i + 1}',
                            style: theme.textTheme.labelMedium),
                      ),
                      IconButton(
                        icon: const Icon(Icons.delete_outline),
                        onPressed: () => setState(() {
                          _branches.removeAt(i).dispose();
                        }),
                      ),
                    ],
                  ),
                  FormTextField(
                      controller: _branches[i].name,
                      label: context.t('customers.branchName')),
                  FormTextField(
                      controller: _branches[i].address,
                      label: context.t('customers.address')),
                ],
              ),
            ),
          ),

          ]),
        ),
        const SizedBox(height: AppSpacing.md),
        AppCard(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Column(children: [
        _GroupHeader(
          title: context.t('customers.licenses'),
          count: _licenses.length,
          onAdd: () => setState(() => _licenses.add(_LicenseDraft())),
        ),
        for (var i = 0; i < _licenses.length; i++)
          Padding(
            padding: const EdgeInsets.only(bottom: AppSpacing.md),
            child: AppCard(
              padding: const EdgeInsets.fromLTRB(12, 12, 12, 8),
              child: Column(
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text('${context.t('customers.license')} ${i + 1}',
                            style: theme.textTheme.labelMedium),
                      ),
                      IconButton(
                        icon: const Icon(Icons.delete_outline),
                        onPressed: () => setState(() {
                          _licenses.removeAt(i).dispose();
                        }),
                      ),
                    ],
                  ),
                  FormTextField(
                      controller: _licenses[i].name,
                      label: context.t('customers.licenseName')),
                  Row(
                    children: [
                      Expanded(
                        child: _DateField(
                          label: context.t('customers.start'),
                          value: _licenses[i].start,
                          onPick: () async {
                            final d = await _pickDate(_licenses[i].start);
                            if (d != null) {
                              setState(() => _licenses[i].start = d);
                            }
                          },
                          onClear: () =>
                              setState(() => _licenses[i].start = null),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: _DateField(
                          label: context.t('customers.end'),
                          value: _licenses[i].end,
                          onPick: () async {
                            final d = await _pickDate(_licenses[i].end);
                            if (d != null) {
                              setState(() => _licenses[i].end = d);
                            }
                          },
                          onClear: () =>
                              setState(() => _licenses[i].end = null),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),

          ]),
        ),
        const SizedBox(height: AppSpacing.md),
        AppCard(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: AttachmentsField(
            attachments: _attachments,
            onChanged: (files) => setState(() => _attachments = files),
          ),
        ),
      ],
      onSubmit: () {
        final repo = ref.read(miscRepositoryProvider);
        // Blank rows are dropped rather than sent: the server skips them
        // anyway, and sending them would create empty records if that ever
        // changed.
        final branches = [
          for (final b in _branches)
            if (!b.isEmpty) b.toJson(),
        ];
        final licenses = [
          for (final l in _licenses)
            if (!l.isEmpty) l.toJson(),
        ];
        final attachmentPaths = [for (final f in _attachments) f.path];

        final c = _editing;
        if (c == null) {
          return repo.createCustomer(
            username: _username.text.trim(),
            fullName: _fullName.text.trim(),
            password: _password.text,
            email: _email.text.trim(),
            phone: _phone.text.trim(),
            address: _address.text.trim(),
            taxNumber: _taxNumber.text.trim(),
            softwareType: _softwareType,
            branches: branches,
            licenses: licenses,
            attachmentPaths: attachmentPaths,
          );
        }
        return repo.updateCustomer(
          id: c.id,
          fullName: _fullName.text.trim(),
          password: _password.text,
          email: _email.text.trim(),
          phone: _phone.text.trim(),
          address: _address.text.trim(),
          taxNumber: _taxNumber.text.trim(),
          softwareType: _softwareType,
          branches: branches,
          licenses: licenses,
          attachmentPaths: attachmentPaths,
        );
      },
    );
  }
}

class _GroupHeader extends StatelessWidget {
  final String title;
  final int count;
  final VoidCallback onAdd;

  const _GroupHeader({
    required this.title,
    required this.count,
    required this.onAdd,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Row(
        children: [
          Expanded(
            child: Text(
              count == 0 ? title : '$title ($count)',
              style: theme.textTheme.titleSmall
                  ?.copyWith(fontWeight: FontWeight.w700),
            ),
          ),
          TextButton.icon(
            onPressed: onAdd,
            icon: const Icon(Icons.add, size: 18),
            label: const Text('Add'),
          ),
        ],
      ),
    );
  }
}

class _DateField extends StatelessWidget {
  final String label;
  final DateTime? value;
  final VoidCallback onPick;
  final VoidCallback onClear;

  const _DateField({
    required this.label,
    required this.value,
    required this.onPick,
    required this.onClear,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onPick,
      borderRadius: BorderRadius.circular(AppRadius.control),
      child: InputDecorator(
        decoration: InputDecoration(
          labelText: label,
          isDense: true,
          suffixIcon: value == null
              ? const Icon(Icons.calendar_today_outlined, size: 18)
              : IconButton(
                  icon: const Icon(Icons.close, size: 18),
                  onPressed: onClear,
                ),
        ),
        child: Text(
          value == null ? '—' : DateFormat.yMMMd().format(value!),
          style: Theme.of(context).textTheme.bodyMedium,
        ),
      ),
    );
  }
}
