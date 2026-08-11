// Shared strings used across many screens/components: language switcher, navigation,
// topbar, roles, login, generic actions/fields, and ticket status/priority labels.
export default {
  en: {
    // Language switcher
    'lang.switchTo': 'العربية',

    // Sidebar navigation
    'nav.dashboard': 'Dashboard',
    'nav.tickets': 'Tickets',
    'nav.account': 'My account',
    'nav.projects': 'Projects',
    'nav.customers': 'Customers',
    'nav.todo': 'To Do',
    'nav.agents': 'Agents',
    'nav.reports': 'Reports',
    'nav.settings': 'Settings',

    // Topbar
    'topbar.toggleSidebar': 'Toggle sidebar',
    'topbar.logout': 'Logout',

    // Roles
    'role.customer': 'customer',
    'role.agent': 'agent',
    'role.admin': 'admin',

    // Login
    'login.welcome': 'Welcome back',
    'login.subtitle': 'Sign in to your account to continue',
    'login.username': 'Username',
    'login.password': 'Password',
    'login.signIn': 'Sign in',
    'login.invalid': 'Invalid username or password.',
    'login.noAccount': "Don't have an account?",
    'login.guestSubmit': 'Submit a ticket as a guest',
    'login.guestTrack': 'Track a ticket',
    'login.heroTitle': 'Support that keeps everyone in the loop.',
    'login.heroSubtitle':
      'Tickets, projects, and customer updates in one place — with email, WhatsApp, and guest access built in.',
    'login.feature1': 'Track and resolve support tickets end to end',
    'login.feature2': 'Organize work on Kanban project boards',
    'login.feature3': 'See performance across your whole team',
    'login.footerTagline': 'Support · Projects · Reports',

    // Generic actions
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.edit': 'Edit',
    'common.delete': 'Delete',
    'common.add': 'Add',
    'common.remove': 'Remove',
    'common.close': 'Close',
    'common.submit': 'Submit',
    'common.view': 'View',
    'common.show': 'Show',
    'common.hide': 'Hide',
    'common.search': 'Search',
    'common.loading': 'Loading',
    'common.actions': 'Actions',
    'common.optional': 'optional',
    'common.select': 'Select…',
    'common.selected': 'selected',
    'common.noResults': 'No results',
    'common.none': '—',
    'common.yes': 'Yes',
    'common.no': 'No',
    'common.all': 'All',

    // Attachment image previews
    'attachments.openOriginal': 'Open original',
    'attachments.previous': 'Previous image',
    'attachments.next': 'Next image',

    // Generic fields
    'field.name': 'Name',
    'field.fullName': 'Full name',
    'field.username': 'Username',
    'field.email': 'Email',
    'field.password': 'Password',
    'field.phone': 'Phone number',
    'field.address': 'Address',
    'field.subject': 'Subject',
    'field.description': 'Description',
    'field.category': 'Category',
    'field.priority': 'Priority',
    'field.status': 'Status',
    'field.createdAt': 'Created',
    'field.updatedAt': 'Updated',
    'field.startDate': 'Start date',
    'field.dueDate': 'Due date',
    'field.assignedAgent': 'Assigned agent',
    'field.assignedOn': 'Assigned on',
    'field.closedOn': 'Closed on',
    'field.customer': 'Customer',
    'field.reference': 'Reference',
    'field.id': 'ID',
    'field.attachments': 'Attachments',

    // Ticket status labels (value `open` is displayed as "Unassigned")
    'status.open': 'Unassigned',
    'status.assigned': 'Assigned',
    'status.in_progress': 'In Progress',
    'status.on_hold': 'On Hold',
    'status.resolved': 'Resolved',
    'status.closed': 'Closed',

    // Priority labels
    'priority.low': 'Low',
    'priority.medium': 'Medium',
    'priority.high': 'High',
    'priority.urgent': 'Urgent',

    // Compact duration suffixes, appended straight to a number ("3d 4h")
    'common.unit.day': 'd',
    'common.unit.hour': 'h',
    'common.unit.minute': 'm',
    'common.unit.second': 's',

    // Breadcrumbs
    'crumb.dashboard': 'Dashboard',

    // Footer
    'footer.rights': 'All rights reserved.',

    // Shared UI components
    'ui.previous': 'Previous',
    'ui.next': 'Next',
    'ui.total': 'total',
    'ui.emptyState': 'Nothing here yet',

    // Notifications
    'notifications.title': 'Notifications',
    'notifications.markAllRead': 'Mark all read',
    'notifications.empty': 'No notifications',
  },
  ar: {
    // Language switcher
    'lang.switchTo': 'English',

    // Sidebar navigation
    'nav.dashboard': 'لوحة التحكم',
    'nav.tickets': 'التذاكر',
    'nav.account': 'حسابي',
    'nav.projects': 'المشاريع',
    'nav.customers': 'العملاء',
    'nav.todo': 'المهام الداخلية',
    'nav.agents': 'الوكلاء',
    'nav.reports': 'التقارير',
    'nav.settings': 'الإعدادات',

    // Topbar
    'topbar.toggleSidebar': 'إظهار/إخفاء القائمة',
    'topbar.logout': 'تسجيل الخروج',

    // Roles
    'role.customer': 'عميل',
    'role.agent': 'وكيل',
    'role.admin': 'مدير',

    // Login
    'login.welcome': 'مرحبًا بعودتك',
    'login.subtitle': 'سجّل الدخول إلى حسابك للمتابعة',
    'login.username': 'اسم المستخدم',
    'login.password': 'كلمة المرور',
    'login.signIn': 'تسجيل الدخول',
    'login.invalid': 'اسم المستخدم أو كلمة المرور غير صحيحة.',
    'login.noAccount': 'ليس لديك حساب؟',
    'login.guestSubmit': 'أرسل تذكرة كزائر',
    'login.guestTrack': 'تتبّع تذكرة',
    'login.heroTitle': 'دعمٌ يُبقي الجميع على اطّلاع.',
    'login.heroSubtitle':
      'التذاكر والمشاريع وتحديثات العملاء في مكان واحد — مع البريد الإلكتروني وواتساب ووصول الزوّار بشكل مدمج.',
    'login.feature1': 'تتبّع تذاكر الدعم وحلّها من البداية إلى النهاية',
    'login.feature2': 'نظّم العمل على لوحات مشاريع كانبان',
    'login.feature3': 'اطّلع على الأداء عبر فريقك بالكامل',
    'login.footerTagline': 'الدعم · المشاريع · التقارير',

    // Generic actions
    'common.save': 'حفظ',
    'common.cancel': 'إلغاء',
    'common.edit': 'تعديل',
    'common.delete': 'حذف',
    'common.add': 'إضافة',
    'common.remove': 'إزالة',
    'common.close': 'إغلاق',
    'common.submit': 'إرسال',
    'common.view': 'عرض',
    'common.show': 'إظهار',
    'common.hide': 'إخفاء',
    'common.search': 'بحث',
    'common.loading': 'جارٍ التحميل',
    'common.actions': 'إجراءات',
    'common.optional': 'اختياري',
    'common.select': 'اختر…',
    'common.selected': 'محدد',
    'common.noResults': 'لا توجد نتائج',
    'common.none': '—',
    'common.yes': 'نعم',
    'common.no': 'لا',
    'common.all': 'الكل',

    // Attachment image previews
    'attachments.openOriginal': 'فتح الأصل',
    'attachments.previous': 'الصورة السابقة',
    'attachments.next': 'الصورة التالية',

    // Generic fields
    'field.name': 'الاسم',
    'field.fullName': 'الاسم الكامل',
    'field.username': 'اسم المستخدم',
    'field.email': 'البريد الإلكتروني',
    'field.password': 'كلمة المرور',
    'field.phone': 'رقم الهاتف',
    'field.address': 'العنوان',
    'field.subject': 'الموضوع',
    'field.description': 'الوصف',
    'field.category': 'الفئة',
    'field.priority': 'الأولوية',
    'field.status': 'الحالة',
    'field.createdAt': 'تاريخ الإنشاء',
    'field.updatedAt': 'آخر تحديث',
    'field.startDate': 'تاريخ البدء',
    'field.dueDate': 'تاريخ الاستحقاق',
    'field.assignedAgent': 'الوكيل المُعيَّن',
    'field.assignedOn': 'تاريخ التعيين',
    'field.closedOn': 'تاريخ الإغلاق',
    'field.customer': 'العميل',
    'field.reference': 'الرقم المرجعي',
    'field.id': 'المعرّف',
    'field.attachments': 'المرفقات',

    // Ticket status labels
    'status.open': 'غير مُعيَّنة',
    'status.assigned': 'مُعيَّنة',
    'status.in_progress': 'قيد المعالجة',
    'status.on_hold': 'معلّقة',
    'status.resolved': 'تم الحل',
    'status.closed': 'مغلقة',

    // Priority labels
    'priority.low': 'منخفضة',
    'priority.medium': 'متوسطة',
    'priority.high': 'عالية',
    'priority.urgent': 'عاجلة',

    // Compact duration suffixes, appended straight to a number ("3d 4h")
    'common.unit.day': 'ي',
    'common.unit.hour': 'س',
    'common.unit.minute': 'د',
    'common.unit.second': 'ث',

    // Breadcrumbs
    'crumb.dashboard': 'لوحة التحكم',

    // Footer
    'footer.rights': 'جميع الحقوق محفوظة.',

    // Shared UI components
    'ui.previous': 'السابق',
    'ui.next': 'التالي',
    'ui.total': 'الإجمالي',
    'ui.emptyState': 'لا يوجد شيء هنا بعد',

    // Notifications
    'notifications.title': 'الإشعارات',
    'notifications.markAllRead': 'تعليم الكل كمقروء',
    'notifications.empty': 'لا توجد إشعارات',
  },
}
