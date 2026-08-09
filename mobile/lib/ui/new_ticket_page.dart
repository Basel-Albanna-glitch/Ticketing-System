import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../core/api_client.dart';
import '../core/attachment_picker.dart';
import '../i18n/i18n.dart';
import '../i18n/labels.dart';
import '../models/customer.dart';
import '../models/ticket.dart';
import '../models/user.dart';
import '../state/providers.dart';
import '../utils/category_tree.dart';
import 'forms/form_scaffold.dart';
import 'theme.dart';
import 'widgets/attachments_field.dart';
import 'widgets/chips.dart';
import 'widgets/pickers.dart';

final _categoriesProvider = FutureProvider<List<Category>>(
  (ref) => ref.watch(ticketRepositoryProvider).categories(),
);

final _staffAgentsProvider = FutureProvider<List<AppUser>>(
  (ref) => ref.watch(ticketRepositoryProvider).agents(),
);

/// Ticket creation for every role.
///
/// The form changes shape by role, following what the API accepts:
///  * customer — subject/category/priority/description only; the server sets
///    the customer and forces start_date to today.
///  * agent    — must also pick the customer (and optionally their branch).
///  * admin    — may additionally assign agents; the first picked becomes the
///    assignee and the rest become collaborators.
class NewTicketPage extends ConsumerStatefulWidget {
  const NewTicketPage({super.key});

  @override
  ConsumerState<NewTicketPage> createState() => _NewTicketPageState();
}

class _NewTicketPageState extends ConsumerState<NewTicketPage> {
  final _formKey = GlobalKey<FormState>();
  final _subject = TextEditingController();
  final _description = TextEditingController();

  int? _rootCategoryId;
  int? _subCategoryId;
  String _priority = TicketPriority.medium;

  /// The ticket is filed against the most specific choice made.
  int? get _categoryId => _subCategoryId ?? _rootCategoryId;

  Customer? _customer;
  CustomerBranch? _branch;
  DateTime? _startDate;
  final List<AppUser> _agents = [];
  List<PickedAttachment> _attachments = [];
  bool _saving = false;

  @override
  void dispose() {
    _subject.dispose();
    _description.dispose();
    super.dispose();
  }

  Future<void> _pickCustomer() async {
    final picked = await showCustomerPicker(context);
    if (picked == null) return;
    setState(() {
      _customer = picked;
      // Branches belong to the customer, so a stale one must not survive.
      _branch = null;
    });
  }

  Future<void> _pickAgents() async {
    final agents = await ref.read(_staffAgentsProvider.future);
    if (!mounted) return;
    final selected = _agents.map((a) => a.id).toList();

    final result = await showModalBottomSheet<List<int>>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (context) => StatefulBuilder(
        builder: (context, setSheetState) => SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 4),
                child: Text(context.t('tickets.assignAgents'),
                    style: const TextStyle(fontWeight: FontWeight.w700)),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                child: Text(
                  context.t('tickets.assignAgentsHelp'),
                  style: const TextStyle(fontSize: 12),
                ),
              ),
              Flexible(
                child: ListView(
                  shrinkWrap: true,
                  children: [
                    for (final a in agents)
                      CheckboxListTile(
                        title: Text(a.fullName),
                        subtitle: selected.indexOf(a.id) == 0
                            ? Text(context.t('tickets.assigneeLabel'))
                            : null,
                        value: selected.contains(a.id),
                        onChanged: (v) => setSheetState(() {
                          if (v == true) {
                            selected.add(a.id);
                          } else {
                            selected.remove(a.id);
                          }
                        }),
                      ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(12),
                child: FilledButton(
                  onPressed: () => Navigator.pop(context, selected),
                  child: Text(context.t('common.done')),
                ),
              ),
            ],
          ),
        ),
      ),
    );
    if (result == null) return;
    final byId = {for (final a in agents) a.id: a};
    setState(() {
      _agents
        ..clear()
        ..addAll(result.map((id) => byId[id]).whereType<AppUser>());
    });
  }

  Future<void> _submit(bool isStaff, bool isAdmin) async {
    if (!_formKey.currentState!.validate()) return;
    if (isStaff && _customer == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(context.t('tickets.pickCustomer'))),
      );
      return;
    }

    setState(() => _saving = true);
    try {
      final ticket = await ref.read(ticketRepositoryProvider).create(
            subject: _subject.text.trim(),
            description: _description.text.trim(),
            categoryId: _categoryId!,
            priority: _priority,
            customerId: isStaff ? _customer!.id : null,
            branchId: _branch?.id,
            startDate: isStaff ? _startDate : null,
            assignedAgentIds:
                isAdmin ? _agents.map((a) => a.id).toList() : const [],
            attachmentPaths: [for (final a in _attachments) a.path],
          );
      if (!mounted) return;
      Navigator.of(context).pop(true);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
            content: Text(context
                .tp('tickets.createdRef', {'ref': ticket.reference}))),
      );
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
    final categories = ref.watch(_categoriesProvider);
    final user = ref.watch(authProvider).user;
    final isStaff = user?.isStaff ?? false;
    final isAdmin = user?.isAdmin ?? false;
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(title: Text(context.t('tickets.new'))),
      body: categories.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => ErrorView(
          message: describeError(e),
          onRetry: () => ref.invalidate(_categoriesProvider),
        ),
        data: (list) {
          final subs = childrenOf(list, _rootCategoryId);
          return Form(
          key: _formKey,
          child: ListView(
            padding: const EdgeInsets.all(AppSpacing.lg),
            children: [
              FormIntro(
                icon: Icons.confirmation_number_outlined,
                title: context.t(isStaff ? 'tickets.raiseTitle' : 'tickets.tellUs'),
                subtitle: isStaff
                    ? context.t('tickets.filedAgainst')
                    : context.t('tickets.weWillGetBack'),
              ),
              const SizedBox(height: AppSpacing.xl),

              if (isStaff)
                FormSection(
                  icon: Icons.person_search_outlined,
                  title: context.t('tickets.customer'),
                  subtitle: context.t('tickets.whoFor'),
                  children: [
                    AppCard(
                      onTap: _pickCustomer,
                      child: ListTile(
                        contentPadding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 2),
                        leading: CircleAvatar(
                          backgroundColor:
                              theme.colorScheme.primaryContainer,
                          child: Text(
                            _customer?.initials ?? '?',
                            style: TextStyle(
                              color: theme.colorScheme.onPrimaryContainer,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                        title: Text(_customer?.fullName ??
                            context.t('tickets.selectCustomer')),
                        subtitle: Text(_customer == null
                            ? context.t('tickets.requiredStaff')
                            : '@${_customer!.username}'),
                        trailing: Icon(forwardChevron(context)),
                      ),
                    ),
                    if (_customer != null &&
                        _customer!.branches.isNotEmpty) ...[
                      const SizedBox(height: AppSpacing.md),
                      DropdownButtonFormField<int>(
                        initialValue: _branch?.id,
                        isExpanded: true,
                        decoration: InputDecoration(
                            labelText: context.t('tickets.branchOptional')),
                        items: [
                          for (final b in _customer!.branches)
                            DropdownMenuItem(value: b.id, child: Text(b.name)),
                        ],
                        onChanged: (v) => setState(() {
                          final matches =
                              _customer!.branches.where((b) => b.id == v);
                          _branch = matches.isEmpty ? null : matches.first;
                        }),
                      ),
                    ],
                  ],
                ),

              FormSection(
                icon: Icons.support_agent_outlined,
                title: context.t('tickets.theRequest'),
                subtitle: context.t('tickets.requestSubtitle'),
                children: [
                  TextFormField(
                    controller: _subject,
                    maxLength: 200,
                    decoration: InputDecoration(
                        labelText: context.t('tickets.subjectRequired')),
                    validator: (v) => (v == null || v.trim().isEmpty)
                        ? context.t('tickets.giveTitle')
                        : null,
                  ),
                  DropdownButtonFormField<int>(
                    initialValue: _rootCategoryId,
                    isExpanded: true,
                    decoration: InputDecoration(
                        labelText: context.t('tickets.categoryRequired')),
                    items: [
                      for (final c in rootCategories(list))
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
                  TextFormField(
                    controller: _description,
                    minLines: 5,
                    maxLines: 10,
                    decoration: InputDecoration(
                      labelText: context.t('tickets.describeRequired'),
                      alignLabelWithHint: true,
                      helperText:
                          context.t('tickets.describeHelp'),
                    ),
                    validator: (v) => (v == null || v.trim().isEmpty)
                        ? context.t('tickets.describeError')
                        : null,
                  ),
                ],
              ),

              if (isStaff)
                FormSection(
                  icon: Icons.tune,
                  title: context.t('tickets.scheduling'),
                  subtitle: context.t('tickets.schedulingSubtitle'),
                  children: [
                    AppCard(
                      onTap: () async {
                        final now = DateTime.now();
                        final picked = await showDatePicker(
                          context: context,
                          initialDate: _startDate ?? now,
                          firstDate: now.subtract(const Duration(days: 365)),
                          lastDate: now.add(const Duration(days: 365)),
                        );
                        if (picked != null) {
                          setState(() => _startDate = picked);
                        }
                      },
                      child: ListTile(
                        contentPadding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 2),
                        leading: const Icon(Icons.event_outlined),
                        title: Text(_startDate == null
                            ? context.t('tickets.startDate')
                            : DateFormat.yMMMd().format(_startDate!)),
                        subtitle: _startDate == null
                            ? Text(context.t('tickets.defaultsToday'))
                            : null,
                        trailing: _startDate == null
                            ? Icon(forwardChevron(context))
                            : IconButton(
                                icon: const Icon(Icons.close),
                                onPressed: () =>
                                    setState(() => _startDate = null),
                              ),
                      ),
                    ),
                    if (isAdmin) ...[
                      const SizedBox(height: AppSpacing.md),
                      AppCard(
                        onTap: _pickAgents,
                        child: ListTile(
                          contentPadding: const EdgeInsets.symmetric(
                              horizontal: 12, vertical: 2),
                          leading: const Icon(Icons.people_alt_outlined),
                          title: Text(_agents.isEmpty
                              ? 'Assign agents'
                              : _agents.map((a) => a.fullName).join(', ')),
                          subtitle: Text(_agents.length > 1
                              ? '${_agents.first.fullName} is the assignee'
                              : 'Optional'),
                          trailing: Icon(forwardChevron(context)),
                        ),
                      ),
                    ],
                  ],
                ),

              FormSection(
                icon: Icons.attach_file,
                title: context.t('attachments.title'),
                subtitle: context.t('tickets.attachmentsHelp'),
                children: [
                  AttachmentsField(
                    title: 'Files',
                    attachments: _attachments,
                    onChanged: (files) => setState(() => _attachments = files),
                  ),
                ],
              ),

              const SizedBox(height: 24),
              FilledButton(
                onPressed: _saving ? null : () => _submit(isStaff, isAdmin),
                child: _saving
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(strokeWidth: 2))
                    : const Text('Create ticket'),
              ),
            ],
          ),
          );
        },
      ),
    );
  }
}
