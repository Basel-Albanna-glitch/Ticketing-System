import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { usePermissions } from '../../auth/usePermissions'
import { useI18n } from '../../i18n/useI18n'
import Logo from '../ui/Logo'
import {
  BadgeIcon,
  BoardIcon,
  BookIcon,
  CalendarIcon,
  CheckCircleIcon,
  DashboardIcon,
  LogoutIcon,
  ReportsIcon,
  SettingsIcon,
  TicketIcon,
  UserIcon,
  UsersIcon,
} from '../ui/icons'

const NAV_ITEMS = [
  { to: '/dashboard', labelKey: 'nav.dashboard', icon: DashboardIcon, roles: ['customer', 'agent', 'admin'] },
  { to: '/tickets', labelKey: 'nav.tickets', icon: TicketIcon, roles: ['customer', 'agent', 'admin'], permission: 'allow_agent_view_tickets' },
  { to: '/calendar', labelKey: 'nav.calendar', icon: CalendarIcon, roles: ['customer', 'agent', 'admin'] },
  { to: '/kb', labelKey: 'nav.kb', icon: BookIcon, roles: ['customer', 'agent', 'admin'] },
  { to: '/account', labelKey: 'nav.account', icon: UserIcon, roles: ['customer'] },
  { to: '/projects', labelKey: 'nav.projects', icon: BoardIcon, roles: ['agent', 'admin'], permission: 'allow_agent_view_projects' },
  {
    to: '/todo',
    labelKey: 'nav.todo',
    icon: CheckCircleIcon,
    roles: ['agent', 'admin'],
    // Revealed once you are in the to-do list, rather than sitting open permanently and
    // making every other section look shallow by comparison.
    children: [
      { to: '/todo/today', labelKey: 'todo.viewToday' },
      { to: '/todo/upcoming', labelKey: 'todo.viewUpcoming' },
      { to: '/todo/report', labelKey: 'todo.viewReport' },
    ],
  },
  { to: '/customers', labelKey: 'nav.customers', icon: UsersIcon, roles: ['agent', 'admin'], permission: 'allow_agent_view_customers' },
  { to: '/agents', labelKey: 'nav.agents', icon: BadgeIcon, roles: ['admin'] },
  // Visible to whoever holds the view-reports permission rather than to admins
  // by role, so a role can grant it to an agent — or withhold it from a
  // limited admin. `roles` still narrows it to staff.
  { to: '/reports', labelKey: 'nav.reports', icon: ReportsIcon, roles: ['agent', 'admin'], permission: 'allow_agent_view_reports' },
]

// Sits with Logout in the pinned bottom group rather than at the end of the nav list.
const SETTINGS_ITEM = {
  to: '/settings',
  labelKey: 'nav.settings',
  icon: SettingsIcon,
  roles: ['customer', 'agent', 'admin'],
}

function navLinkClass({ isActive }) {
  return `group relative flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
    isActive
      ? 'bg-gradient-to-r from-indigo-50 to-transparent text-indigo-700 ring-1 ring-inset ring-indigo-200/70 dark:from-indigo-500/15 dark:text-indigo-300 dark:ring-indigo-400/20'
      : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-200'
  }`
}

function subLinkClass({ isActive }) {
  return `block rounded-lg py-1.5 pe-3 ps-9 text-sm transition-colors ${
    isActive
      ? 'font-medium text-indigo-700 dark:text-indigo-300'
      : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
  }`
}

function NavItem({ item, open, onNavigate, t, sectionActive }) {
  return (
    <>
      <NavLink
        to={item.to}
        // Without `end`, the parent stays highlighted on every child route and the two
        // markers fight each other.
        end={Boolean(item.children)}
        tabIndex={open ? undefined : -1}
        onClick={onNavigate}
        className={navLinkClass}
      >
        {({ isActive }) => (
          <>
            {isActive && (
              <span className="absolute start-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-e-full bg-indigo-500" />
            )}
            <item.icon className="h-5 w-5 shrink-0" />
            {t(item.labelKey)}
          </>
        )}
      </NavLink>
      {item.children && sectionActive && (
        <div className="flex flex-col gap-0.5 border-s border-gray-200 ms-5 ps-0 dark:border-white/10">
          {item.children.map((child) => (
            <NavLink
              key={child.to}
              to={child.to}
              tabIndex={open ? undefined : -1}
              onClick={onNavigate}
              className={subLinkClass}
            >
              {t(child.labelKey)}
            </NavLink>
          ))}
        </div>
      )}
    </>
  )
}

export default function Sidebar({ open = true, onNavigate }) {
  const { user, logout } = useAuth()
  const permissions = usePermissions()
  const { t } = useI18n()
  const navigate = useNavigate()
  const { pathname } = useLocation()

  function handleLogout() {
    onNavigate?.()
    logout()
    navigate('/login')
  }

  return (
    <nav
      aria-hidden={!open}
      className={`fixed inset-y-0 start-0 z-40 flex flex-col overflow-hidden bg-white/90 backdrop-blur-xl transition-[transform,width] duration-300 ease-in-out dark:bg-gray-900/90 lg:sticky lg:top-0 lg:h-screen lg:bg-white/70 lg:shadow-none dark:lg:bg-gray-900/60 ${
        open
          ? 'w-64 translate-x-0 border-e border-gray-200/70 shadow-2xl dark:border-white/10 lg:w-56'
          : 'w-64 ltr:-translate-x-full rtl:translate-x-full lg:w-0 lg:translate-x-0'
      }`}
    >
      <div className="flex h-full w-64 flex-col gap-1 p-4 lg:w-56">
        <div className="mb-5 px-2">
          <Logo />
        </div>
        {NAV_ITEMS.filter(
          (item) =>
            item.roles.includes(user?.role) &&
            // Section permissions narrow staff only. A customer holds no staff
            // permissions at all, so testing them here would hide their own
            // Tickets link — `roles` is what governs them.
            (!item.permission ||
              user?.role === 'customer' ||
              permissions[item.permission])
        ).map((item) => (
          <NavItem
            key={item.to}
            item={item}
            open={open}
            onNavigate={onNavigate}
            t={t}
            // Anywhere under /todo counts, so the sub-links stay put while you move
            // between them instead of collapsing out from under the cursor.
            sectionActive={pathname === item.to || pathname.startsWith(`${item.to}/`)}
          />
        ))}

        {/* Pinned to the bottom: Settings directly above Logout. */}
        <div className="mt-auto flex flex-col gap-1 border-t border-gray-100 pt-2 dark:border-white/10">
          {SETTINGS_ITEM.roles.includes(user?.role) && (
            <NavItem item={SETTINGS_ITEM} open={open} onNavigate={onNavigate} t={t} />
          )}
          <button
            type="button"
            onClick={handleLogout}
            tabIndex={open ? undefined : -1}
            className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-200"
          >
            <LogoutIcon className="h-5 w-5 shrink-0" />
            {t('topbar.logout')}
          </button>
        </div>
      </div>
    </nav>
  )
}
