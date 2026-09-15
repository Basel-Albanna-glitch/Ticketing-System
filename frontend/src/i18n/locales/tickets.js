// Tickets area: list, detail, create pages and their supporting components.
export default {
  en: {
    // List page
    'tickets.create': 'Create Ticket',
    'tickets.exportExcel': 'Export to Excel',
    'tickets.columns': 'Columns',
    'tickets.columnsHidden': 'hidden',
    'tickets.showAllColumns': 'Show all',
    'tickets.columnsSaveError': 'Could not save.',
    'tickets.loadError': 'Failed to load tickets.',
    'tickets.notFound': 'Ticket not found',
    'tickets.notFoundHint': 'It may have been deleted.',
    'tickets.emptyTitle': 'No tickets found',
    'tickets.emptyDescription': 'Try adjusting your filters.',

    // Table columns
    'tickets.parentCategory': 'Parent category',
    'tickets.subCategory': 'Sub-category',
    'tickets.customerPriority': 'Requested priority',
    'tickets.categoryPriority': 'Pre-defined priority',

    // Filters
    'tickets.allStatuses': 'All statuses',
    'tickets.selectedSuffix': ' selected',
    'tickets.searchBySubject': 'Search by subject...',
    'tickets.searchSubjectOrCustomer': 'Subject or customer...',

    // Shared labels
    'tickets.guest': 'Guest',
    'tickets.overdue': 'Overdue',
    'tickets.none': 'None',
    'tickets.clear': 'Clear',

    // Detail page — banners
    'tickets.watchingPrefix': "You're viewing this ticket. Only ",
    'tickets.theAssignedAgent': 'the assigned agent',
    'tickets.watchingSuffix': ' can respond or make changes.',
    'tickets.closedLocked':
      'This ticket is closed and locked for editing. An admin can reopen it or enable editing of closed tickets in settings.',
    'tickets.actionsLockedUntilStart':
      'Actions are locked until this ticket’s start date',

    // Detail page — hero & sections
    'tickets.onHold': 'On hold:',
    'tickets.comments': 'Comments',
    'tickets.details': 'Details',
    'tickets.editDetails': 'Edit details',
    'tickets.editDetailsError': 'Could not save the changes. Please try again.',
    'tickets.activityHistory': 'Activity history',
    'tickets.collaboratingAgents': 'Collaborating agents',

    // Detail page — action groups
    'tickets.linkCustomer': 'Link customer',
    'tickets.removeCustomer': 'Remove customer',
    'tickets.editCustomer': 'Edit customer',
    'tickets.assignedTo': 'Assigned to',
    'tickets.openFor': 'Open for',
    'tickets.resolvedIn': 'Resolved in',
    'tickets.noticeStatusUpdated': 'Status updated',
    'tickets.updatePriority': 'Update priority',
    'tickets.useCategoryPriority': 'Use pre-defined priority',
    'tickets.categoryPriorityHint':
      "Applies to this ticket only — the category's own pre-defined priority is unchanged.",
    'tickets.noticePriorityUpdated': 'Priority updated',
    'tickets.noticeDueDateSet': 'Due date updated',
    'tickets.noticeDueDateCleared': 'Due date cleared',
    'tickets.noticeCollaboratorAdded': 'Collaborator added',
    'tickets.noticeCollaboratorRemoved': 'Collaborator removed',
    'tickets.noticeCustomerLinked': 'Customer linked',
    'tickets.noticeCustomerRemoved': 'Customer removed',
    'tickets.assignAgent': 'Assign agent',
    'tickets.collaborators': 'Collaborators',
    'tickets.assignment': 'Assignment',
    'tickets.reassign': 'Reassign',
    'tickets.dangerZone': 'Danger zone',
    'tickets.assignToAgent': 'Assign to agent',
    'tickets.assign': 'Assign',
    'tickets.addCollaboratingAgent': 'Add collaborating agent',
    'tickets.addCollaborator': 'Add collaborator',
    'tickets.unassignMyself': 'Unassign myself',
    'tickets.assignToMe': 'Assign to me',
    'tickets.reassignToAnother': 'Reassign to another agent',
    'tickets.updateStatus': 'Update status',
    'tickets.reasonForHold': 'Reason for hold',
    'tickets.holdReasonPlaceholder': 'Why is this ticket on hold?',
    'tickets.phases': 'Work phases',
    'tickets.phasesDescription': 'Optional — log each step of the work as it happens.',
    'tickets.noPhases': 'No phases logged yet.',
    'tickets.phasePlaceholder': 'What was done in this phase?',
    'tickets.addPhase': 'Add phase',
    'tickets.assignBeforeStatus': 'Assign this ticket to an agent before its status can be changed.',
    'tickets.setDueDate': 'Set due date',
    'tickets.deleteTicket': 'Delete ticket',
    'tickets.confirmDeletePrefix': 'Delete ticket ',
    'tickets.confirmDeleteSuffix':
      '? This permanently removes it along with all its comments, attachments and activity. This cannot be undone.',
    'tickets.confirmSelfAssignPrefix': 'Take ticket ',
    'tickets.confirmSelfAssignSuffix':
      '? It becomes yours to resolve, and you cannot unassign yourself afterwards.',
    'tickets.confirmAssignPrefix': 'Assign ticket ',
    'tickets.confirmAssignMiddle': ' to ',
    'tickets.confirmAssignSuffix': '? They will be notified that it is theirs to handle.',
    'tickets.confirmReassignPrefix': 'Hand ticket ',
    'tickets.confirmReassignMiddle': ' over to ',
    'tickets.confirmReassignSuffix': '? You will lose access to it once it is reassigned.',

    // Create page
    'tickets.createError': 'Failed to create ticket.',
    'tickets.subjectMustContainText': 'The subject must contain text, not just numbers or symbols.',
    'tickets.createdSuccess': 'Ticket created successfully',
    'tickets.keepReference': 'Keep this reference number to track your ticket.',
    'tickets.ticketNumber': 'Ticket number',
    'tickets.viewTicket': 'View ticket',
    'tickets.createAnother': 'Create another',
    'tickets.newTicket': 'New ticket',
    'tickets.selectCustomer': 'Select a customer',
    'tickets.branch': 'Branch',
    'tickets.selectBranch': 'Select a branch',
    'tickets.categoryPriorityByAdmin': 'Pre-defined priority (set by admin):',
    'tickets.attachment': 'Attachment',
    'tickets.assignToAgents': 'Assign to agents',
    'tickets.selectAgent': 'Select an agent…',
    'tickets.primary': 'Primary',
    'tickets.primaryHint':
      'The first selected agent is the primary assignee; the rest are added as collaborators.',

    // Category cascader
    'tickets.selectCategory': 'Select a category',
    'tickets.selectSubCategory': 'Select a sub-category (optional)',

    // Comment thread
    'tickets.noComments': 'No comments yet.',
    'tickets.writeReply': 'Write a reply...',
    'tickets.reply': 'Reply',
    'tickets.onlyAssignedCanRespond': 'Only the assigned agent can respond to this ticket.',

    // Activity timeline
    'tickets.noActivity': 'No activity yet.',
    'tickets.system': 'System',

    // Attachments
    'tickets.noAttachments': 'No attachments.',
  },
  ar: {
    // List page
    'tickets.create': 'إنشاء تذكرة',
    'tickets.exportExcel': 'تصدير إلى Excel',
    'tickets.columns': 'الأعمدة',
    'tickets.columnsHidden': 'مخفية',
    'tickets.showAllColumns': 'إظهار الكل',
    'tickets.columnsSaveError': 'تعذّر الحفظ.',
    'tickets.loadError': 'تعذّر تحميل التذاكر.',
    'tickets.notFound': 'التذكرة غير موجودة',
    'tickets.notFoundHint': 'ربما تم حذفها.',
    'tickets.emptyTitle': 'لا توجد تذاكر',
    'tickets.emptyDescription': 'حاول تعديل عوامل التصفية.',

    // Table columns
    'tickets.parentCategory': 'الفئة الرئيسية',
    'tickets.subCategory': 'الفئة الفرعية',
    'tickets.customerPriority': 'الأولوية المطلوبة',
    'tickets.categoryPriority': 'الأولوية المحددة مسبقًا',

    // Filters
    'tickets.allStatuses': 'كل الحالات',
    'tickets.selectedSuffix': ' محدّدة',
    'tickets.searchBySubject': 'ابحث حسب الموضوع...',
    'tickets.searchSubjectOrCustomer': 'الموضوع أو العميل...',

    // Shared labels
    'tickets.guest': 'زائر',
    'tickets.overdue': 'متأخرة',
    'tickets.none': 'لا يوجد',
    'tickets.clear': 'مسح',

    // Detail page — banners
    'tickets.watchingPrefix': 'أنت تُطالع هذه التذكرة. لا يمكن الرد أو إجراء تغييرات إلا لـ ',
    'tickets.theAssignedAgent': 'الوكيل المُعيَّن',
    'tickets.watchingSuffix': '.',
    'tickets.closedLocked':
      'هذه التذكرة مغلقة ومقفلة للتعديل. يمكن للمدير إعادة فتحها أو تفعيل تعديل التذاكر المغلقة من الإعدادات.',
    'tickets.actionsLockedUntilStart':
      'الإجراءات مقفلة حتى تاريخ بدء هذه التذكرة',

    // Detail page — hero & sections
    'tickets.onHold': 'معلّقة:',
    'tickets.comments': 'التعليقات',
    'tickets.details': 'التفاصيل',
    'tickets.editDetails': 'تعديل التفاصيل',
    'tickets.editDetailsError': 'تعذّر حفظ التغييرات. يرجى المحاولة مرة أخرى.',
    'tickets.activityHistory': 'سجل النشاط',
    'tickets.collaboratingAgents': 'الوكلاء المتعاونون',

    // Detail page — action groups
    'tickets.linkCustomer': 'ربط بعميل',
    'tickets.removeCustomer': 'إزالة العميل',
    'tickets.editCustomer': 'تعديل العميل',
    'tickets.assignedTo': 'تم التعيين إلى',
    'tickets.openFor': 'مفتوحة منذ',
    'tickets.resolvedIn': 'تم الحل خلال',
    'tickets.noticeStatusUpdated': 'تم تحديث الحالة',
    'tickets.updatePriority': 'تحديث الأولوية',
    'tickets.useCategoryPriority': 'استخدام الأولوية المحددة مسبقًا',
    'tickets.categoryPriorityHint':
      'تنطبق على هذه التذكرة فقط — الأولوية المحددة مسبقًا للفئة نفسها لا تتغير.',
    'tickets.noticePriorityUpdated': 'تم تحديث الأولوية',
    'tickets.noticeDueDateSet': 'تم تحديث تاريخ الاستحقاق',
    'tickets.noticeDueDateCleared': 'تم مسح تاريخ الاستحقاق',
    'tickets.noticeCollaboratorAdded': 'تمت إضافة متعاون',
    'tickets.noticeCollaboratorRemoved': 'تمت إزالة المتعاون',
    'tickets.noticeCustomerLinked': 'تم ربط العميل',
    'tickets.noticeCustomerRemoved': 'تمت إزالة العميل',
    'tickets.assignAgent': 'تعيين وكيل',
    'tickets.collaborators': 'المتعاونون',
    'tickets.assignment': 'التعيين',
    'tickets.reassign': 'إعادة تعيين',
    'tickets.dangerZone': 'منطقة الخطر',
    'tickets.assignToAgent': 'تعيين إلى وكيل',
    'tickets.assign': 'تعيين',
    'tickets.addCollaboratingAgent': 'إضافة وكيل متعاون',
    'tickets.addCollaborator': 'إضافة متعاون',
    'tickets.unassignMyself': 'إلغاء تعييني',
    'tickets.assignToMe': 'تعيينها لي',
    'tickets.reassignToAnother': 'إعادة التعيين إلى وكيل آخر',
    'tickets.updateStatus': 'تحديث الحالة',
    'tickets.reasonForHold': 'سبب التعليق',
    'tickets.holdReasonPlaceholder': 'لماذا هذه التذكرة معلّقة؟',
    'tickets.phases': 'مراحل العمل',
    'tickets.phasesDescription': 'اختياري — سجّل كل خطوة من العمل عند حدوثها.',
    'tickets.noPhases': 'لم يتم تسجيل أي مراحل بعد.',
    'tickets.phasePlaceholder': 'ما الذي تم إنجازه في هذه المرحلة؟',
    'tickets.addPhase': 'إضافة مرحلة',
    'tickets.assignBeforeStatus': 'عيّن هذه التذكرة إلى وكيل قبل أن يتمكّن من تغيير حالتها.',
    'tickets.setDueDate': 'تعيين تاريخ الاستحقاق',
    'tickets.deleteTicket': 'حذف التذكرة',
    'tickets.confirmDeletePrefix': 'حذف التذكرة ',
    'tickets.confirmDeleteSuffix':
      '؟ سيؤدي هذا إلى إزالتها نهائيًا مع جميع تعليقاتها ومرفقاتها ونشاطها. لا يمكن التراجع عن هذا الإجراء.',
    'tickets.confirmSelfAssignPrefix': 'استلام التذكرة ',
    'tickets.confirmSelfAssignSuffix': '؟ ستصبح مسؤوليتك لحلّها، ولن تتمكّن من إلغاء تعيين نفسك بعد ذلك.',
    'tickets.confirmAssignPrefix': 'تعيين التذكرة ',
    'tickets.confirmAssignMiddle': ' إلى ',
    'tickets.confirmAssignSuffix': '؟ سيتم إشعاره بأنها أصبحت من مسؤوليته.',
    'tickets.confirmReassignPrefix': 'تسليم التذكرة ',
    'tickets.confirmReassignMiddle': ' إلى ',
    'tickets.confirmReassignSuffix': '؟ ستفقد صلاحية الوصول إليها بعد إعادة التعيين.',

    // Create page
    'tickets.createError': 'تعذّر إنشاء التذكرة.',
    'tickets.subjectMustContainText': 'يجب أن يحتوي الموضوع على نص، وليس مجرد أرقام أو رموز.',
    'tickets.createdSuccess': 'تم إنشاء التذكرة بنجاح',
    'tickets.keepReference': 'احتفظ بهذا الرقم المرجعي لتتبّع تذكرتك.',
    'tickets.ticketNumber': 'رقم التذكرة',
    'tickets.viewTicket': 'عرض التذكرة',
    'tickets.createAnother': 'إنشاء أخرى',
    'tickets.newTicket': 'تذكرة جديدة',
    'tickets.selectCustomer': 'اختر عميلًا',
    'tickets.branch': 'الفرع',
    'tickets.selectBranch': 'اختر فرعًا',
    'tickets.categoryPriorityByAdmin': 'الأولوية المحددة مسبقًا (يحددها المدير):',
    'tickets.attachment': 'مرفق',
    'tickets.assignToAgents': 'تعيين إلى وكلاء',
    'tickets.selectAgent': 'اختر وكيلًا…',
    'tickets.primary': 'رئيسي',
    'tickets.primaryHint': 'الوكيل الأول المُحدَّد هو المُعيَّن الرئيسي؛ والباقون يُضافون كمتعاونين.',

    // Category cascader
    'tickets.selectCategory': 'اختر فئة',
    'tickets.selectSubCategory': 'اختر فئة فرعية (اختياري)',

    // Comment thread
    'tickets.noComments': 'لا توجد تعليقات بعد.',
    'tickets.writeReply': 'اكتب ردًا...',
    'tickets.reply': 'رد',
    'tickets.onlyAssignedCanRespond': 'يمكن للوكيل المُعيَّن فقط الرد على هذه التذكرة.',

    // Activity timeline
    'tickets.noActivity': 'لا يوجد نشاط بعد.',
    'tickets.system': 'النظام',

    // Attachments
    'tickets.noAttachments': 'لا توجد مرفقات.',
  },
}
