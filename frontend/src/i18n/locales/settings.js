export default {
  en: {
    // Page header + breadcrumb
    'settings.title': 'Settings',
    'settings.subtitle.admin': 'Manage your account and preferences and configure the workspace.',
    'settings.subtitle.user': 'Manage your account and preferences.',

    // Left-nav labels
    'settings.nav.profile': 'Profile',
    'settings.nav.security': 'Security',
    'settings.nav.notifications': 'Notifications',
    'settings.nav.permissions': 'Permissions',
    'settings.nav.categories': 'Categories',
    'settings.nav.softwareTypes': 'Software types',
    'settings.nav.userRoles': 'User roles',
    'settings.nav.roles': 'Permission roles',

    // Profile section
    'settings.profile.title': 'Profile settings',
    'settings.profile.description': 'Update your picture, display name, and contact email.',
    'settings.avatar.upload': 'Upload photo',
    'settings.avatar.change': 'Change photo',
    'settings.avatar.hint': 'JPG or PNG, up to 5 MB. Centred and cropped to a square.',
    'settings.avatar.hintOnCreate': 'JPG or PNG, up to 5 MB. Uploaded when you save the account.',
    'settings.avatar.savedWithoutPicture':
      'The account was saved, but the picture could not be uploaded. Try adding it again.',
    'settings.avatar.notImage': 'Choose an image file.',
    'settings.avatar.tooLarge': 'Image must be 5 MB or smaller.',
    'settings.avatar.uploadError': 'Could not update your picture. Please try again.',
    'settings.profile.updated': 'Profile updated.',

    // Password section
    'settings.password.title': 'Change password',
    'settings.password.description': "Choose a strong password you don't use elsewhere.",
    'settings.password.current': 'Current password',
    'settings.password.new': 'New password',
    'settings.password.confirm': 'Confirm new password',
    'settings.password.submit': 'Update password',
    'settings.password.updated': 'Password updated.',
    'settings.password.error': 'Failed to update password. Check your current password.',

    // Notifications section
    'settings.notifications.title': 'Notification settings',
    'settings.notifications.description': 'Decide when we email you about ticket activity.',
    'settings.notifications.newComment.label': 'Email me on new comments',
    'settings.notifications.newComment.hint':
      'Get an email whenever someone comments on your tickets.',
    'settings.notifications.statusChange.label': 'Email me on status changes',
    'settings.notifications.statusChange.hint': "Get an email when a ticket's status is updated.",
    'settings.notifications.assignment.label': 'Email me when a ticket is assigned to me',
    'settings.notifications.assignment.hint':
      'Get an email when someone hands a ticket over to you.',
    'settings.notifications.licenseExpiry.label': 'Email me before a license expires',
    'settings.notifications.licenseExpiry.hint':
      'Get an email 30 days, 7 days and 1 day before a license end date, and on the day itself.',
    'settings.notifications.todoReminder.label': 'Email me when a to-do reminder is due',
    'settings.notifications.todoReminder.hint':
      'For to-dos assigned to you, and ones you wrote that nobody has taken.',
    'settings.notifications.emailGroup': 'Email',
    'settings.notifications.saved': 'Saved',
    'settings.notifications.inAppNote':
      "In-app notifications in the bell menu are always on — these settings only control email.",
    'settings.notifications.allOff':
      "All email is off. You'll still see everything in the bell menu.",
    'settings.notifications.noEmail':
      'Your account has no email address, so none of these can be sent. Add one under Profile settings.',

    // Roles section
    'settings.roles.title': 'Permission roles',
    'settings.roles.subtitle':
      'Named sets of permissions you can assign to staff. A role replaces the defaults above for whoever holds it; anyone without one falls back to those defaults.',
    'settings.roles.addRole': 'Add role',
    'settings.roles.editRole': 'Edit role',
    'settings.roles.name': 'Role name',
    'settings.roles.description': 'Description',
    'settings.roles.permissionsHint':
      'Everything this role allows. A role assigned to an admin restricts them to exactly these.',
    'settings.roles.grantedCount': '{n} permission(s) granted',
    'settings.roles.userCount': '{n} user(s)',
    'settings.roles.noPermissions': 'No permissions granted',
    'settings.roles.empty': 'No roles yet. Staff use the default permissions above.',
    'settings.roles.errorSave': 'Could not save the role.',
    'settings.roles.confirmDelete': 'Delete the role "{name}"?',
    'settings.roles.confirmDeleteInUse':
      'Delete the role "{name}"? {n} user(s) hold it and will revert to the default permissions.',
    'settings.roles.hiddenColumnsCount': '{n} ticket column(s) hidden',

    // Ticket table columns (roles and the site-wide defaults)
    'settings.ticketColumns.title': 'Ticket table columns',
    'settings.ticketColumns.roleHint':
      'Ticked columns are the ones people with this role can see. If the role also lets them hide and show columns, they can hide more for themselves, but never show an unticked one.',
    'settings.ticketColumns.defaultsHint':
      'Columns agents without a role can see. If they may hide and show columns, they can hide more for themselves, but never show an unticked one. Admins without a role always see every column.',

    // Permissions section
    'settings.permissions.title': 'Permissions',
    'settings.permissions.description':
      'Control what agents are allowed to do. Admins always have full access.',
    'settings.permissions.saved': 'Permissions saved.',
    'settings.permissions.group.tickets': 'Tickets',
    'settings.permissions.group.customers': 'Customers',
    'settings.permissions.createCustomers.label': 'Allow agents to add customers',
    'settings.permissions.createCustomers.hint':
      'Deleting a customer stays admin-only either way — an accidental add is easy to fix, a delete takes their tickets with it.',
    'settings.permissions.viewTickets.label': 'Allow agents to open the Tickets section',
    'settings.permissions.viewTickets.hint':
      'Turning this off hides Tickets entirely for them. Customers always keep access to their own tickets.',
    'settings.permissions.customizeColumns.label':
      'Allow agents to hide and show ticket table columns',
    'settings.permissions.customizeColumns.hint':
      'Adds a Columns menu to the ticket list for choosing which columns they see, among those they are allowed. When off, they see every column they are allowed.',
    'settings.permissions.viewCustomers.label': 'Allow agents to open the Customers section',
    'settings.permissions.viewCustomers.hint':
      'Turning this off hides Customers. Note the new-ticket form picks a customer, so an agent raising tickets will usually need this.',
    'settings.permissions.viewProjects.label': 'Allow agents to open the Projects section',
    'settings.permissions.viewProjects.hint':
      'Covers projects and their tasks. The separate To-do list is unaffected.',
    'settings.permissions.group.reports': 'Reports',
    'settings.permissions.viewReports.label': 'Allow agents to view reports',
    'settings.permissions.viewReports.hint':
      'Reports aggregate across every customer and agent, which is a much wider view than the tickets an agent works day to day.',
    'settings.permissions.group.kb': 'Knowledge base',
    'settings.permissions.group.projects': 'Projects',
    'settings.permissions.assignProjects.label':
      'Allow agents to change who projects and tasks are assigned to',
    'settings.permissions.assignProjects.hint':
      'When off, only admins can hand project or task work to someone else. Agents keep full access to the work itself.',
    'settings.permissions.unassignProjects.label':
      'Allow agents to take themselves off a project',
    'settings.permissions.unassignProjects.hint':
      'Agents can always pick up unclaimed work. When off, stepping back off it needs an admin, so a project is never quietly left unowned.',
    'settings.permissions.assignTasks.label':
      'Allow agents to assign tasks to themselves and other agents',
    'settings.permissions.assignTasks.hint':
      'Applies inside a project only. A team can divide tasks between themselves without also being able to hand the whole project to someone else.',
    'settings.permissions.selfAssign.label': 'Allow agents to assign tickets to themselves',
    'settings.permissions.selfAssign.hint':
      "When enabled, agents can see unassigned tickets and either claim one for themselves or release one they no longer want. They still can't assign a ticket to another agent or take one already claimed — that stays admin-only.",
    'settings.permissions.reassign.label':
      'Allow agents to reassign their tickets to another agent',
    'settings.permissions.reassign.hint':
      'When enabled, an agent can hand off a ticket currently assigned to them to a different agent. They can only reassign tickets that are their own.',
    'settings.permissions.editAfterClose.label': 'Allow agents to edit tickets after they are closed',
    'settings.permissions.editAfterClose.hint':
      "When off, a closed ticket is locked — its status, deadline and comments can't be changed except by an admin, who can always reopen it. When on, agents who can normally edit the ticket may keep editing it after it's closed. Customers can never edit a closed ticket.",
    'settings.permissions.deleteTicket.label': 'Allow agents to delete their tickets',
    'settings.permissions.deleteTicket.hint':
      'When on, the agent a ticket is assigned to can delete it (removing its comments, attachments and activity). When off, only admins can delete tickets.',
    'settings.permissions.editCustomers.label': 'Allow agents to edit customers',
    'settings.permissions.editCustomers.hint':
      'When on, agents can edit customer records. Creating and deleting customers always stays admin-only.',
    'settings.permissions.linkCustomer.label': "Allow agents to change a guest ticket's customer",
    'settings.permissions.linkCustomer.hint':
      'When on, agents can link, change, or remove the customer on a guest ticket. When off, only admins can.',
    'settings.permissions.manageKb.label': 'Allow agents to manage the knowledge base',
    'settings.permissions.manageKb.hint':
      'When on, agents can create, edit, and delete knowledge-base articles. When off, only admins can.',

    // Categories section
    'settings.categories.title': 'Categories',
    'settings.categories.description':
      'Organize tickets into a hierarchy and set default priorities.',
    'settings.categories.subCategory': 'Sub-category',
    'settings.categories.editTitle': 'Edit category',
    'settings.categories.addSubUnder': 'Add sub-category under',
    'settings.categories.addTopLevel': 'Add top-level category',
    'settings.categories.parent': 'Parent category',
    'settings.categories.parentNone': 'None (top level)',
    'settings.categories.add': 'Add category',
    'settings.categories.update': 'Update category',
    'settings.categories.saveError': 'Failed to save category.',
    'settings.categories.deleteError': 'Failed to delete category.',

    // Software types section
    'settings.softwareTypes.title': 'Software types',
    'settings.softwareTypes.description':
      'Define the software types customers can be tagged with.',
    'settings.softwareTypes.empty': 'No software types yet.',
    'settings.softwareTypes.editTitle': 'Edit software type',
    'settings.softwareTypes.addTitle': 'Add software type',
    'settings.softwareTypes.add': 'Add software type',
    'settings.softwareTypes.update': 'Update software type',
    'settings.softwareTypes.saveError': 'Failed to save software type.',
    'settings.softwareTypes.deleteError': 'Failed to delete software type.',

    // User roles section
    'settings.userRoles.title': 'User roles',
    'settings.userRoles.description': 'Assign customer, agent, or admin access to each user.',
    'settings.userRoles.searchPlaceholder': 'Search users…',
    'settings.userRoles.roleColumn': 'Role',
  },
  ar: {
    // Page header + breadcrumb
    'settings.title': 'الإعدادات',
    'settings.subtitle.admin': 'أدر حسابك وتفضيلاتك وقم بتهيئة مساحة العمل.',
    'settings.subtitle.user': 'أدر حسابك وتفضيلاتك.',

    // Left-nav labels
    'settings.nav.profile': 'الملف الشخصي',
    'settings.nav.security': 'الأمان',
    'settings.nav.notifications': 'الإشعارات',
    'settings.nav.permissions': 'الصلاحيات',
    'settings.nav.categories': 'الفئات',
    'settings.nav.softwareTypes': 'أنواع البرامج',
    'settings.nav.userRoles': 'أدوار المستخدمين',
    'settings.nav.roles': 'أدوار الصلاحيات',

    // Profile section
    'settings.profile.title': 'إعدادات الملف الشخصي',
    'settings.profile.description': 'حدّث صورتك واسمك الظاهر والبريد الإلكتروني للتواصل.',
    'settings.avatar.upload': 'رفع صورة',
    'settings.avatar.change': 'تغيير الصورة',
    'settings.avatar.hint': 'JPG أو PNG، بحد أقصى 5 ميجابايت. تُقتطع لتكون مربّعة.',
    'settings.avatar.hintOnCreate': 'JPG أو PNG، بحد أقصى 5 ميجابايت. تُرفع عند حفظ الحساب.',
    'settings.avatar.savedWithoutPicture':
      'تم حفظ الحساب، لكن تعذّر رفع الصورة. حاول إضافتها مرة أخرى.',
    'settings.avatar.notImage': 'اختر ملف صورة.',
    'settings.avatar.tooLarge': 'يجب ألا يتجاوز حجم الصورة 5 ميجابايت.',
    'settings.avatar.uploadError': 'تعذّر تحديث صورتك. يرجى المحاولة مرة أخرى.',
    'settings.profile.updated': 'تم تحديث الملف الشخصي.',

    // Password section
    'settings.password.title': 'تغيير كلمة المرور',
    'settings.password.description': 'اختر كلمة مرور قوية لا تستخدمها في مكان آخر.',
    'settings.password.current': 'كلمة المرور الحالية',
    'settings.password.new': 'كلمة المرور الجديدة',
    'settings.password.confirm': 'تأكيد كلمة المرور الجديدة',
    'settings.password.submit': 'تحديث كلمة المرور',
    'settings.password.updated': 'تم تحديث كلمة المرور.',
    'settings.password.error': 'تعذّر تحديث كلمة المرور. تحقق من كلمة المرور الحالية.',

    // Notifications section
    'settings.notifications.title': 'إعدادات الإشعارات',
    'settings.notifications.description': 'حدّد متى نرسل لك بريدًا إلكترونيًا بخصوص نشاط التذاكر.',
    'settings.notifications.newComment.label': 'أرسل لي بريدًا إلكترونيًا عند التعليقات الجديدة',
    'settings.notifications.newComment.hint':
      'استلم بريدًا إلكترونيًا كلما علّق أحدهم على تذاكرك.',
    'settings.notifications.statusChange.label': 'أرسل لي بريدًا إلكترونيًا عند تغيّر الحالة',
    'settings.notifications.statusChange.hint':
      'استلم بريدًا إلكترونيًا عند تحديث حالة تذكرة.',
    'settings.notifications.assignment.label': 'أرسل لي بريدًا إلكترونيًا عند إسناد تذكرة إليّ',
    'settings.notifications.assignment.hint':
      'استلم بريدًا إلكترونيًا عندما يُسند أحدهم تذكرة إليك.',
    'settings.notifications.licenseExpiry.label': 'أرسل لي بريدًا إلكترونيًا قبل انتهاء الترخيص',
    'settings.notifications.licenseExpiry.hint':
      'استلم بريدًا إلكترونيًا قبل 30 يومًا و7 أيام ويوم واحد من تاريخ انتهاء الترخيص، وفي يوم الانتهاء نفسه.',
    'settings.notifications.todoReminder.label': 'أرسل لي بريدًا عند حلول موعد تذكير مهمة',
    'settings.notifications.todoReminder.hint':
      'للمهام المُسندة إليك، وتلك التي أنشأتها ولم يتولَّها أحد.',
    'settings.notifications.emailGroup': 'البريد الإلكتروني',
    'settings.notifications.saved': 'تم الحفظ',
    'settings.notifications.inAppNote':
      'إشعارات التطبيق في قائمة الجرس تعمل دائمًا — هذه الإعدادات تتحكم بالبريد الإلكتروني فقط.',
    'settings.notifications.allOff':
      'جميع رسائل البريد الإلكتروني متوقفة. ستظل ترى كل شيء في قائمة الجرس.',
    'settings.notifications.noEmail':
      'لا يوجد بريد إلكتروني في حسابك، لذا لا يمكن إرسال أي منها. أضِف واحدًا من إعدادات الملف الشخصي.',

    // Roles section
    'settings.roles.title': 'أدوار الصلاحيات',
    'settings.roles.subtitle':
      'مجموعات صلاحيات مُسمّاة يمكنك إسنادها للموظفين. يحلّ الدور محلّ الإعدادات الافتراضية أعلاه لمن يحمله، ومن لا يحمل دوراً تُطبَّق عليه تلك الإعدادات.',
    'settings.roles.addRole': 'إضافة دور',
    'settings.roles.editRole': 'تعديل الدور',
    'settings.roles.name': 'اسم الدور',
    'settings.roles.description': 'الوصف',
    'settings.roles.permissionsHint':
      'كل ما يسمح به هذا الدور. الدور المُسنَد إلى مشرف يقصر صلاحياته على هذه تحديداً.',
    'settings.roles.grantedCount': 'الصلاحيات الممنوحة: {n}',
    'settings.roles.userCount': 'عدد المستخدمين: {n}',
    'settings.roles.noPermissions': 'لا توجد صلاحيات ممنوحة',
    'settings.roles.empty': 'لا توجد أدوار بعد. يستخدم الموظفون الصلاحيات الافتراضية أعلاه.',
    'settings.roles.errorSave': 'تعذّر حفظ الدور.',
    'settings.roles.confirmDelete': 'حذف الدور "{name}"؟',
    'settings.roles.confirmDeleteInUse':
      'حذف الدور "{name}"؟ يحمله {n} مستخدم/مستخدمين وسيعودون إلى الصلاحيات الافتراضية.',
    'settings.roles.hiddenColumnsCount': 'أعمدة تذاكر مخفية: {n}',

    // Ticket table columns (roles and the site-wide defaults)
    'settings.ticketColumns.title': 'أعمدة جدول التذاكر',
    'settings.ticketColumns.roleHint':
      'الأعمدة المحددة هي التي يستطيع أصحاب هذا الدور رؤيتها. إذا سمح لهم الدور أيضاً بإخفاء الأعمدة وإظهارها، يمكنهم إخفاء المزيد لأنفسهم، لكن لا يمكنهم إظهار عمود غير محدد.',
    'settings.ticketColumns.defaultsHint':
      'الأعمدة التي يستطيع الوكلاء بلا دور رؤيتها. إذا سُمح لهم بإخفاء الأعمدة وإظهارها، يمكنهم إخفاء المزيد لأنفسهم، لكن لا يمكنهم إظهار عمود غير محدد. المشرفون بلا دور يرون كل الأعمدة دائماً.',

    // Permissions section
    'settings.permissions.title': 'الصلاحيات',
    'settings.permissions.description': 'تحكّم فيما يُسمح للوكلاء فعله. المشرفون لديهم صلاحية كاملة دائماً.',
    'settings.permissions.saved': 'تم حفظ الصلاحيات.',
    'settings.permissions.group.tickets': 'التذاكر',
    'settings.permissions.group.customers': 'العملاء',
    'settings.permissions.createCustomers.label': 'السماح للوكلاء بإضافة العملاء',
    'settings.permissions.createCustomers.hint':
      'يبقى حذف العميل للمدراء فقط في الحالتين — فالإضافة الخاطئة يسهل تصحيحها، أما الحذف فيأخذ معه تذاكر العميل.',
    'settings.permissions.viewTickets.label': 'السماح للوكلاء بفتح قسم التذاكر',
    'settings.permissions.viewTickets.hint':
      'إيقاف هذا يخفي التذاكر عنهم تماماً. يحتفظ العملاء دائماً بالوصول إلى تذاكرهم.',
    'settings.permissions.customizeColumns.label':
      'السماح للوكلاء بإخفاء أعمدة جدول التذاكر وإظهارها',
    'settings.permissions.customizeColumns.hint':
      'يضيف قائمة "الأعمدة" إلى قائمة التذاكر لاختيار الأعمدة التي يرونها من بين المسموح لهم بها. عند الإيقاف، يرون كل الأعمدة المسموح لهم بها.',
    'settings.permissions.viewCustomers.label': 'السماح للوكلاء بفتح قسم العملاء',
    'settings.permissions.viewCustomers.hint':
      'إيقاف هذا يخفي العملاء. لاحظ أن نموذج التذكرة الجديدة يتطلب اختيار عميل، لذا يحتاجه الوكيل الذي ينشئ التذاكر عادةً.',
    'settings.permissions.viewProjects.label': 'السماح للوكلاء بفتح قسم المشاريع',
    'settings.permissions.viewProjects.hint':
      'يشمل المشاريع ومهامها. قائمة المهام المنفصلة غير متأثرة.',
    'settings.permissions.group.reports': 'التقارير',
    'settings.permissions.viewReports.label': 'السماح للوكلاء بعرض التقارير',
    'settings.permissions.viewReports.hint':
      'تجمع التقارير بيانات كل العملاء والوكلاء، وهي نظرة أوسع بكثير من التذاكر التي يعمل عليها الوكيل يومياً.',
    'settings.permissions.group.kb': 'قاعدة المعرفة',
    'settings.permissions.group.projects': 'المشاريع',
    'settings.permissions.assignProjects.label':
      'السماح للوكلاء بتغيير المُكلَّفين بالمشاريع والمهام',
    'settings.permissions.assignProjects.hint':
      'عند الإيقاف، يمكن للمدراء فقط إسناد العمل إلى شخص آخر، ويبقى للوكلاء وصول كامل إلى العمل نفسه.',
    'settings.permissions.unassignProjects.label':
      'السماح للوكلاء بإزالة أنفسهم من المشروع',
    'settings.permissions.unassignProjects.hint':
      'يمكن للوكلاء دائمًا استلام العمل غير المُسند. وعند الإيقاف، يحتاج التراجع عنه إلى مدير حتى لا يبقى المشروع بلا مسؤول.',
    'settings.permissions.assignTasks.label':
      'السماح للوكلاء بإسناد المهام لأنفسهم ولوكلاء آخرين',
    'settings.permissions.assignTasks.hint':
      'ينطبق داخل المشروع فقط، فيتمكن الفريق من توزيع المهام بينهم دون إمكانية إسناد المشروع كاملًا لشخص آخر.',
    'settings.permissions.selfAssign.label': 'السماح للوكلاء بتعيين التذاكر لأنفسهم',
    'settings.permissions.selfAssign.hint':
      'عند التفعيل، يمكن للوكلاء رؤية التذاكر غير المُعيَّنة وإما استلام واحدة لأنفسهم أو التخلّي عن واحدة لم يعودوا يريدونها. لا يزال لا يمكنهم تعيين تذكرة لوكيل آخر أو أخذ تذكرة مُستلَمة بالفعل — يبقى ذلك للمدير فقط.',
    'settings.permissions.reassign.label': 'السماح للوكلاء بإعادة تعيين تذاكرهم إلى وكيل آخر',
    'settings.permissions.reassign.hint':
      'عند التفعيل، يمكن للوكيل تحويل تذكرة مُعيَّنة له حاليًا إلى وكيل آخر. لا يمكنهم إعادة تعيين سوى التذاكر الخاصة بهم.',
    'settings.permissions.editAfterClose.label': 'السماح للوكلاء بتعديل التذاكر بعد إغلاقها',
    'settings.permissions.editAfterClose.hint':
      'عند الإيقاف، تكون التذكرة المغلقة مقفلة — لا يمكن تغيير حالتها أو موعدها النهائي أو تعليقاتها إلا بواسطة مدير يستطيع دائمًا إعادة فتحها. عند التفعيل، يمكن للوكلاء الذين يستطيعون تعديل التذكرة عادةً الاستمرار في تعديلها بعد إغلاقها. لا يمكن للعملاء أبدًا تعديل تذكرة مغلقة.',
    'settings.permissions.deleteTicket.label': 'السماح للوكلاء بحذف تذاكرهم',
    'settings.permissions.deleteTicket.hint':
      'عند التفعيل، يمكن للوكيل المُعيَّن للتذكرة حذفها (مع إزالة تعليقاتها ومرفقاتها ونشاطها). عند الإيقاف، يمكن للمديرين فقط حذف التذاكر.',
    'settings.permissions.editCustomers.label': 'السماح للوكلاء بتعديل العملاء',
    'settings.permissions.editCustomers.hint':
      'عند التفعيل، يمكن للوكلاء تعديل بيانات العملاء. أما إنشاء العملاء وحذفهم فيبقى للمدير فقط.',
    'settings.permissions.manageKb.label': 'السماح للوكلاء بإدارة قاعدة المعرفة',
    'settings.permissions.manageKb.hint':
      'عند التفعيل، يمكن للوكلاء إنشاء مقالات قاعدة المعرفة وتعديلها وحذفها. عند الإيقاف، للمشرفين فقط.',
    'settings.permissions.linkCustomer.label': 'السماح للوكلاء بتغيير عميل تذكرة الزائر',
    'settings.permissions.linkCustomer.hint':
      'عند التفعيل، يمكن للوكلاء ربط العميل بتذكرة الزائر أو تغييره أو إزالته. عند الإيقاف، يمكن للمديرين فقط.',

    // Categories section
    'settings.categories.title': 'الفئات',
    'settings.categories.description': 'نظّم التذاكر في تسلسل هرمي وحدّد الأولويات الافتراضية.',
    'settings.categories.subCategory': 'فئة فرعية',
    'settings.categories.editTitle': 'تعديل الفئة',
    'settings.categories.addSubUnder': 'إضافة فئة فرعية ضمن',
    'settings.categories.addTopLevel': 'إضافة فئة بمستوى أعلى',
    'settings.categories.parent': 'الفئة الأصل',
    'settings.categories.parentNone': 'بدون (مستوى أعلى)',
    'settings.categories.add': 'إضافة فئة',
    'settings.categories.update': 'تحديث الفئة',
    'settings.categories.saveError': 'تعذّر حفظ الفئة.',
    'settings.categories.deleteError': 'تعذّر حذف الفئة.',

    // Software types section
    'settings.softwareTypes.title': 'أنواع البرامج',
    'settings.softwareTypes.description': 'حدّد أنواع البرامج التي يمكن وسم العملاء بها.',
    'settings.softwareTypes.empty': 'لا توجد أنواع برامج بعد.',
    'settings.softwareTypes.editTitle': 'تعديل نوع البرنامج',
    'settings.softwareTypes.addTitle': 'إضافة نوع برنامج',
    'settings.softwareTypes.add': 'إضافة نوع برنامج',
    'settings.softwareTypes.update': 'تحديث نوع البرنامج',
    'settings.softwareTypes.saveError': 'تعذّر حفظ نوع البرنامج.',
    'settings.softwareTypes.deleteError': 'تعذّر حذف نوع البرنامج.',

    // User roles section
    'settings.userRoles.title': 'أدوار المستخدمين',
    'settings.userRoles.description': 'امنح كل مستخدم صلاحية عميل أو وكيل أو مدير.',
    'settings.userRoles.searchPlaceholder': 'ابحث عن مستخدمين…',
    'settings.userRoles.roleColumn': 'الدور',
  },
}
