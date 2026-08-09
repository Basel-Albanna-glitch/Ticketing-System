import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../i18n/i18n.dart';
import '../../i18n/labels.dart';
import '../../models/article.dart';
import '../../models/customer.dart';
import '../../models/project.dart';
import '../../models/ticket.dart';
import '../../state/providers.dart';
import '../../utils/category_tree.dart';
import '../agents_page.dart';
import '../customers_page.dart';
import '../theme.dart';
import 'form_scaffold.dart';

final _categoriesProvider = FutureProvider<List<Category>>(
  (ref) => ref.watch(ticketRepositoryProvider).categories(),
);

/// Create or edit a knowledge-base article. Admin-only unless agents have been
/// granted the manage-knowledge-base permission in settings — the same rule
/// ArticleViewSet.get_permissions applies to both create and update.
///
/// Pass [article] to edit an existing one; omit it to create.
class ArticleFormPage extends ConsumerStatefulWidget {
  final Article? article;

  const ArticleFormPage({super.key, this.article});

  @override
  ConsumerState<ArticleFormPage> createState() => _ArticleFormPageState();
}

class _ArticleFormPageState extends ConsumerState<ArticleFormPage> {
  final _formKey = GlobalKey<FormState>();
  final _title = TextEditingController();
  final _body = TextEditingController();
  int? _categoryId;
  bool _published = true;

  Article? get _editing => widget.article;

  @override
  void initState() {
    super.initState();
    final a = _editing;
    if (a == null) return;
    _title.text = a.title;
    _body.text = a.body ?? '';
    _categoryId = a.category?.id;
    _published = a.isPublished;
  }

  @override
  void dispose() {
    _title.dispose();
    _body.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final categories = ref.watch(_categoriesProvider).valueOrNull ?? const [];
    final editing = _editing != null;

    return FormScaffold(
      title: context.t(editing ? 'kb.edit' : 'kb.new'),
      formKey: _formKey,
      submitLabel:
          context.t(editing ? 'common.saveChanges' : 'kb.createArticle'),
      headerIcon: Icons.menu_book_outlined,
      headerTitle: context.t(editing ? 'kb.editTitle' : 'kb.writeTitle'),
      headerSubtitle: context.t('kb.subtitle'),
      fields: (context) => [
        FormSection(
          icon: Icons.title,
          title: context.t('kb.articleSection'),
          subtitle: context.t('kb.articleSectionHelp'),
          children: [
            FormTextField(
                controller: _title,
                label: context.t('kb.titleField'),
                required: true),
            DropdownButtonFormField<int>(
              initialValue: _categoryId,
              isExpanded: true,
              decoration:
                  InputDecoration(labelText: context.t('kb.categoryField')),
              items: [
                // Explicit empty choice so an article that has a category can
                // have it taken away again — `category_id` is allow_null.
                DropdownMenuItem(value: null, child: Text(context.t('common.select'))),
                for (final c in categories)
                  DropdownMenuItem(value: c.id, child: Text(c.name)),
              ],
              onChanged: (v) => setState(() => _categoryId = v),
            ),
          ],
        ),
        FormSection(
          icon: Icons.notes_outlined,
          title: context.t('kb.content'),
          children: [
            FormTextField(
              controller: _body,
              label: context.t('kb.body'),
              required: true,
              minLines: 8,
              maxLines: 20,
              last: true,
            ),
          ],
        ),
        FormSection(
          icon: Icons.visibility_outlined,
          title: context.t('kb.visibility'),
          children: [
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(context.t('kb.published')),
              subtitle: Text(context.t('kb.publishedHelp')),
              value: _published,
              onChanged: (v) => setState(() => _published = v),
            ),
          ],
        ),
      ],
      onSubmit: () {
        final repo = ref.read(miscRepositoryProvider);
        final a = _editing;
        if (a == null) {
          return repo.createArticle(
            title: _title.text.trim(),
            body: _body.text.trim(),
            categoryId: _categoryId,
            isPublished: _published,
          );
        }
        return repo.updateArticle(
          a.id,
          title: _title.text.trim(),
          body: _body.text.trim(),
          categoryId: _categoryId,
          isPublished: _published,
        );
      },
    );
  }
}

/// Create or edit a project. Any staff member may. Passing [project] switches
/// the page to editing: the fields are prefilled and the save patches instead
/// of posting.
class ProjectFormPage extends ConsumerStatefulWidget {
  const ProjectFormPage({super.key, this.project});

  final Project? project;

  @override
  ConsumerState<ProjectFormPage> createState() => _ProjectFormPageState();
}

class _ProjectFormPageState extends ConsumerState<ProjectFormPage> {
  final _formKey = GlobalKey<FormState>();
  late final _name = TextEditingController(text: widget.project?.name ?? '');
  late final _description =
      TextEditingController(text: widget.project?.description ?? '');
  late String _status = widget.project?.status ?? 'open';
  Customer? _customer;
  CustomerBranch? _branch;
  late final Set<int> _assigneeIds = {
    for (final a in widget.project?.assignees ?? const []) a.id,
  };
  late DateTime? _startDate = widget.project?.startDate;
  late DateTime? _endDate = widget.project?.endDate;

  /// The customer and branch objects arrive with the customer list, which loads
  /// after the first build \u2014 so the prefill happens there, once, rather than in
  /// initState where the list is not yet available.
  bool _linkPrefilled = false;

  void _prefillLink(List<Customer> customers) {
    if (_linkPrefilled) return;
    final existing = widget.project?.customer;
    if (existing == null) {
      _linkPrefilled = customers.isNotEmpty;
      return;
    }
    for (final c in customers) {
      if (c.id != existing.id) continue;
      _customer = c;
      final branchName = widget.project?.branchName;
      if (branchName != null) {
        for (final b in c.branches) {
          if (b.name == branchName) _branch = b;
        }
      }
      _linkPrefilled = true;
      return;
    }
  }

  @override
  void dispose() {
    _name.dispose();
    _description.dispose();
    super.dispose();
  }

  Future<void> _pickDate(bool isStart) async {
    final picked = await showDatePicker(
      context: context,
      initialDate: (isStart ? _startDate : _endDate) ?? DateTime.now(),
      firstDate: DateTime(2020),
      lastDate: DateTime(2100),
    );
    if (picked == null) return;
    setState(() {
      if (isStart) {
        _startDate = picked;
      } else {
        _endDate = picked;
      }
    });
  }

  String _stamp(DateTime? d) => d == null ? '\u2014' : '${d.day}/${d.month}/${d.year}';

  /// The API's project dates are plain dates, not instants.
  static String? _dateOnly(DateTime? v) => v == null
      ? null
      : '${v.year.toString().padLeft(4, '0')}-'
          '${v.month.toString().padLeft(2, '0')}-'
          '${v.day.toString().padLeft(2, '0')}';

  @override
  Widget build(BuildContext context) {
    final editing = widget.project != null;

    return FormScaffold(
      title: context.t(editing ? 'projects.edit' : 'projects.new'),
      formKey: _formKey,
      submitLabel:
          context.t(editing ? 'common.save' : 'projects.createProject'),
      headerIcon: Icons.view_kanban_outlined,
      headerTitle: context.t('projects.startProject'),
      headerSubtitle: context.t('projects.startSubtitle'),
      fields: (context) {
        // Branches belong to exactly one customer, so the picker only offers the
        // selected customer's own \u2014 the API rejects anything else.
        final customers =
            ref.watch(customersProvider).valueOrNull?.results ?? const <Customer>[];
        final agents = ref.watch(agentsProvider).valueOrNull ?? const <Agent>[];
        _prefillLink(customers);
        final branches = _customer?.branches ?? const <CustomerBranch>[];

        return [
          FormSection(
            icon: Icons.folder_outlined,
            title: context.t('projects.project'),
            children: [
              FormTextField(
                  controller: _name,
                  label: context.t('forms.name'),
                  required: true),
              FormTextField(
                controller: _description,
                label: context.t('projects.description'),
                minLines: 3,
                maxLines: 8,
              ),
              DropdownButtonFormField<String>(
                initialValue: _status,
                decoration: InputDecoration(labelText: context.t('tickets.status')),
                items: [
                  DropdownMenuItem(
                      value: 'open', child: Text(context.t('projects.statusOpen'))),
                  DropdownMenuItem(
                      value: 'closed', child: Text(context.t('projects.statusClosed'))),
                ],
                onChanged: (v) => setState(() => _status = v ?? 'open'),
              ),
            ],
          ),
          FormSection(
            icon: Icons.people_outline,
            title: context.t('projects.whoFor'),
            children: [
              DropdownButtonFormField<Customer?>(
                initialValue: _customer,
                isExpanded: true,
                decoration: InputDecoration(labelText: context.t('tickets.customer')),
                items: [
                  DropdownMenuItem(
                      value: null, child: Text(context.t('projects.noCustomer'))),
                  ...customers.map(
                      (c) => DropdownMenuItem(value: c, child: Text(c.fullName))),
                ],
                // Changing customer must not leave their branch behind.
                onChanged: (c) => setState(() {
                  _customer = c;
                  _branch = null;
                }),
              ),
              if (branches.isNotEmpty)
                DropdownButtonFormField<CustomerBranch?>(
                  initialValue: _branch,
                  isExpanded: true,
                  decoration: InputDecoration(labelText: context.t('projects.branch')),
                  items: [
                    DropdownMenuItem(
                        value: null, child: Text(context.t('projects.noBranch'))),
                    ...branches.map(
                        (b) => DropdownMenuItem(value: b, child: Text(b.name))),
                  ],
                  onChanged: (b) => setState(() => _branch = b),
                ),
              const SizedBox(height: 8),
              Text(context.t('projects.assignees'),
                  style: Theme.of(context).textTheme.labelLarge),
              Wrap(
                spacing: 8,
                children: [
                  for (final a in agents)
                    FilterChip(
                      label: Text(a.fullName),
                      selected: _assigneeIds.contains(a.id),
                      onSelected: (on) => setState(() {
                        if (on) {
                          _assigneeIds.add(a.id);
                        } else {
                          _assigneeIds.remove(a.id);
                        }
                      }),
                    ),
                ],
              ),
            ],
          ),
          FormSection(
            icon: Icons.event_outlined,
            title: context.t('projects.window'),
            children: [
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.play_arrow_outlined),
                title: Text(context.t('todo.from')),
                subtitle: Text(_stamp(_startDate)),
                trailing: _startDate == null
                    ? null
                    : IconButton(
                        icon: const Icon(Icons.clear),
                        onPressed: () => setState(() => _startDate = null)),
                onTap: () => _pickDate(true),
              ),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.flag_outlined),
                title: Text(context.t('todo.to')),
                subtitle: Text(_stamp(_endDate)),
                trailing: _endDate == null
                    ? null
                    : IconButton(
                        icon: const Icon(Icons.clear),
                        onPressed: () => setState(() => _endDate = null)),
                onTap: () => _pickDate(false),
              ),
            ],
          ),
        ];
      },
      onSubmit: () {
        final repo = ref.read(miscRepositoryProvider);
        if (widget.project == null) {
          return repo.createProject(
            name: _name.text.trim(),
            description: _description.text.trim(),
            status: _status,
            customerId: _customer?.id,
            branchId: _branch?.id,
            assigneeIds: _assigneeIds.toList(),
            startDate: _startDate,
            endDate: _endDate,
          );
        }
        // Nulls are meaningful here: they clear a link or a date.
        return repo.updateProject(widget.project!.id, {
          'name': _name.text.trim(),
          'description': _description.text.trim(),
          'status': _status,
          'customer_id': _customer?.id,
          'branch_id': _customer == null ? null : _branch?.id,
          'assignee_ids': _assigneeIds.toList(),
          'start_date': _dateOnly(_startDate),
          'end_date': _dateOnly(_endDate),
        });
      },
    );
  }
}

/// Create a task on a project board. The column it lands in is [initialStatus],
/// so creating from a column header drops the card straight into that column.
class TaskFormPage extends ConsumerStatefulWidget {
  final int projectId;
  final String initialStatus;

  const TaskFormPage({
    super.key,
    required this.projectId,
    this.initialStatus = TaskStatus.todo,
  });

  @override
  ConsumerState<TaskFormPage> createState() => _TaskFormPageState();
}

class _TaskFormPageState extends ConsumerState<TaskFormPage> {
  final _formKey = GlobalKey<FormState>();
  final _title = TextEditingController();
  final _description = TextEditingController();
  late String _status = widget.initialStatus;
  String _priority = TicketPriority.medium;

  @override
  void dispose() {
    _title.dispose();
    _description.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FormScaffold(
      title: context.t('projects.newTask'),
      formKey: _formKey,
      submitLabel: context.t('projects.createTask'),
      headerIcon: Icons.check_box_outlined,
      headerTitle: context.t('projects.addTaskTitle'),
      headerSubtitle: context.t('projects.taskSubtitle'),
      fields: (context) => [
        FormSection(
          icon: Icons.title,
          title: context.t('projects.task'),
          children: [
            FormTextField(
                controller: _title,
                label: context.t('forms.title'),
                required: true),
            FormTextField(
              controller: _description,
              label: context.t('projects.description'),
              minLines: 3,
              maxLines: 8,
              last: true,
            ),
          ],
        ),
        FormSection(
          icon: Icons.tune,
          title: context.t('projects.placement'),
          subtitle: context.t('projects.placementSubtitle'),
          children: [
            DropdownButtonFormField<String>(
              initialValue: _status,
              decoration:
                  InputDecoration(labelText: context.t('projects.column')),
              items: [
                for (final s in TaskStatus.all)
                  DropdownMenuItem(value: s, child: Text(taskStatusLabel(context, s))),
              ],
              onChanged: (v) => setState(() => _status = v ?? TaskStatus.todo),
            ),
            const SizedBox(height: AppSpacing.md),
            DropdownButtonFormField<String>(
              initialValue: _priority,
              decoration:
                  InputDecoration(labelText: context.t('tickets.priority')),
              items: [
                for (final p in TicketPriority.all)
                  DropdownMenuItem(
                      value: p, child: Text(priorityLabel(context, p))),
              ],
              onChanged: (v) =>
                  setState(() => _priority = v ?? TicketPriority.medium),
            ),
          ],
        ),
      ],
      onSubmit: () async {
        await ref.read(miscRepositoryProvider).createTask(
              projectId: widget.projectId,
              title: _title.text.trim(),
              description: _description.text.trim(),
              status: _status,
              priority: _priority,
            );
      },
    );
  }
}

/// Create a category or sub-category. Admin-only.
class CategoryFormPage extends ConsumerStatefulWidget {
  const CategoryFormPage({super.key});

  @override
  ConsumerState<CategoryFormPage> createState() => _CategoryFormPageState();
}

class _CategoryFormPageState extends ConsumerState<CategoryFormPage> {
  final _formKey = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _description = TextEditingController();
  int? _parentId;
  String _priority = TicketPriority.medium;

  @override
  void dispose() {
    _name.dispose();
    _description.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final categories = ref.watch(_categoriesProvider).valueOrNull ?? const [];
    // Only top-level categories are offered as parents: the data nests one
    // level, and deeper trees would need the picker to nest too.
    final parents = rootCategories(categories);

    return FormScaffold(
      title: context.t('settings.newCategory'),
      formKey: _formKey,
      submitLabel: 'Create category',
      headerIcon: Icons.folder_outlined,
      headerTitle: 'Add a category',
      headerSubtitle: context.t('settings.categoryHelp'),
      fields: (context) => [
        FormSection(
          icon: Icons.label_outline,
          title: context.t('tickets.category'),
          children: [
        FormTextField(
            controller: _name,
            label: context.t('forms.name'),
            required: true),
        DropdownButtonFormField<int>(
          initialValue: _parentId,
          isExpanded: true,
          decoration: InputDecoration(
            labelText: context.t('settings.parentCategory'),
            helperText: context.t('settings.parentHelp'),
          ),
          items: [
            const DropdownMenuItem(value: null, child: Text('— None —')),
            for (final c in parents)
              DropdownMenuItem(value: c.id, child: Text(c.name)),
          ],
          onChanged: (v) => setState(() => _parentId = v),
        ),
        const SizedBox(height: 12),
        DropdownButtonFormField<String>(
          initialValue: _priority,
          decoration: InputDecoration(
              labelText: context.t('settings.defaultPriority')),
          items: [
            for (final p in TicketPriority.all)
              DropdownMenuItem(
                  value: p, child: Text(priorityLabel(context, p))),
          ],
          onChanged: (v) =>
              setState(() => _priority = v ?? TicketPriority.medium),
        ),
        const SizedBox(height: AppSpacing.md),
        FormTextField(
          controller: _description,
          label: context.t('projects.description'),
          minLines: 2,
          maxLines: 5,
          last: true,
        ),
          ],
        ),
      ],
      onSubmit: () => ref.read(miscRepositoryProvider).createCategory(
            name: _name.text.trim(),
            description: _description.text.trim(),
            priority: _priority,
            parentId: _parentId,
          ),
    );
  }
}
