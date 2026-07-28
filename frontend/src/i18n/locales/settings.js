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
    'settings.notifications.emailGroup': 'Email',
    'settings.notifications.saved': 'Saved',
    'settings.notifications.inAppNote':
      "In-app notifications in the bell menu are always on — these settings only control email.",
    'settings.notifications.allOff':
      "All email is off. You'll still see everything in the bell menu.",
    'settings.notifications.noEmail':
      'Your account has no email address, so none of these can be sent. Add one under Profile settings.',

    // Permissions section
    'settings.permissions.title': 'Permissions',
    'settings.permissions.description':
      'Control what agents are allowed to do. Admins always have full access.',
    'settings.permissions.saved': 'Permissions saved.',
    'settings.permissions.group.tickets': 'Tickets',
    'settings.permissions.group.customers': 'Customers',
    'settings.permissions.group.kb': 'Knowledge base',
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
    'settings.notifications.emailGroup': 'البريد الإلكتروني',
    'settings.notifications.saved': 'تم الحفظ',
    'settings.notifications.inAppNote':
      'إشعارات التطبيق في قائمة الجرس تعمل دائمًا — هذه الإعدادات تتحكم بالبريد الإلكتروني فقط.',
    'settings.notifications.allOff':
      'جميع رسائل البريد الإلكتروني متوقفة. ستظل ترى كل شيء في قائمة الجرس.',
    'settings.notifications.noEmail':
      'لا يوجد بريد إلكتروني في حسابك، لذا لا يمكن إرسال أي منها. أضِف واحدًا من إعدادات الملف الشخصي.',

    // Permissions section
    'settings.permissions.title': 'الصلاحيات',
    'settings.permissions.description': 'تحكّم فيما يُسمح للوكلاء فعله. المشرفون لديهم صلاحية كاملة دائماً.',
    'settings.permissions.saved': 'تم حفظ الصلاحيات.',
    'settings.permissions.group.tickets': 'التذاكر',
    'settings.permissions.group.customers': 'العملاء',
    'settings.permissions.group.kb': 'قاعدة المعرفة',
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
