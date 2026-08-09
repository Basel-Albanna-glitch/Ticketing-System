import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
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
  { to: '/tickets', labelKey: 'nav.tickets', icon: TicketIcon, roles: ['customer', 'agent', 'admin'] },
  { to: '/calendar', labelKey: 'nav.calendar', icon: CalendarIcon, roles: ['customer', 'agent', 'admin'] },
  { to: '/kb', labelKey: 'nav.kb', icon: BookIcon, roles: ['customer', 'agent', 'admin'] },
  { to: '/account', labelKey: 'nav.account', icon: UserIcon, roles: ['customer'] },
  { to: '/projects', labelKey: 'nav.projects', icon: BoardIcon, roles: ['agent', 'admin'] },
  { to: '/todo', labelKey: 'nav.todo', icon: CheckCircleIcon, roles: ['agent', 'admin'] },
  { to: '/customers', labelKey: 'nav.customers', icon: UsersIcon, roles: ['agent', 'admin'] },
  { to: '/agents', labelKey: 'nav.agents', icon: BadgeIcon, roles: ['admin'] },
  { to: '/reports', labelKey: 'nav.reports', icon: ReportsIcon, roles: ['admin'] },
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

function NavItem({ item, open, onNavigate, t }) {
  return (
    <NavLink to={item.to} tabIndex={open ? undefined : -1} onClick={onNavigate} className={navLinkClass}>
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
  )
}

export default function Sidebar({ open = true, onNavigate }) {
  const { user, logout } = useAuth()
  const { t } = useI18n()
  const navigate = useNavigate()

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
        {NAV_ITEMS.filter((item) => item.roles.includes(user?.role)).map((item) => (
          <NavItem key={item.to} item={item} open={open} onNavigate={onNavigate} t={t} />
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
