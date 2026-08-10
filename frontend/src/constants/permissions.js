import { BoardIcon, BookIcon, ReportsIcon, TicketIcon, UsersIcon } from '../components/ui/icons'

// The grantable permissions, grouped by area. Shared by the site-wide defaults
// on the Settings page and the per-role editor, so a permission added here shows
// up in both — the backend mirror of this list is core.models.PERMISSION_FLAGS.
// `i18n` maps to the settings.permissions.<i18n>.label / .hint translation keys.
// Section-visibility flags default ON, mirroring core.models.DEFAULT_ON_FLAGS:
// they withhold access staff already have rather than granting something new,
// so a brand-new role must not silently hide the main sections from its holder.
export const DEFAULT_ON_FLAGS = new Set([
  'allow_agent_view_tickets',
  'allow_agent_view_customers',
  'allow_agent_view_projects',
])

export const PERMISSION_GROUPS = [
  {
    icon: TicketIcon,
    titleKey: 'settings.permissions.group.tickets',
    fields: [
      { key: 'allow_agent_view_tickets', i18n: 'viewTickets' },
      { key: 'allow_agent_self_assign', i18n: 'selfAssign' },
      { key: 'allow_agent_reassign', i18n: 'reassign' },
      { key: 'allow_agent_edit_after_close', i18n: 'editAfterClose' },
      { key: 'allow_agent_delete', i18n: 'deleteTicket' },
    ],
  },
  {
    icon: UsersIcon,
    titleKey: 'settings.permissions.group.customers',
    fields: [
      { key: 'allow_agent_view_customers', i18n: 'viewCustomers' },
      { key: 'allow_agent_create_customers', i18n: 'createCustomers' },
      { key: 'allow_agent_edit_customers', i18n: 'editCustomers' },
      { key: 'allow_agent_link_customer', i18n: 'linkCustomer' },
    ],
  },
  {
    icon: BookIcon,
    titleKey: 'settings.permissions.group.kb',
    fields: [{ key: 'allow_agent_manage_kb', i18n: 'manageKb' }],
  },
  {
    icon: BoardIcon,
    titleKey: 'settings.permissions.group.projects',
    fields: [
      { key: 'allow_agent_view_projects', i18n: 'viewProjects' },
      { key: 'allow_agent_assign_projects', i18n: 'assignProjects' },
      { key: 'allow_agent_unassign_projects', i18n: 'unassignProjects' },
      { key: 'allow_agent_assign_tasks', i18n: 'assignTasks' },
    ],
  },
  {
    icon: ReportsIcon,
    titleKey: 'settings.permissions.group.reports',
    fields: [{ key: 'allow_agent_view_reports', i18n: 'viewReports' }],
  },
]

export const PERMISSION_FIELDS = PERMISSION_GROUPS.flatMap((g) => g.fields)
