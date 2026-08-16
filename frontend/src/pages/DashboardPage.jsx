import { useState } from 'react'
import { Link } from 'react-router-dom'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import Spinner from '../components/ui/Spinner'
import StatTile from '../components/ui/StatTile'
import {
  BadgeIcon,
  BookIcon,
  CheckCircleIcon,
  ClockIcon,
  FolderOpenIcon,
  InboxIcon,
  PlusIcon,
  ReportsIcon,
  TicketIcon,
  UserIcon,
  UsersIcon,
} from '../components/ui/icons'
import TicketTable from '../components/tickets/TicketTable'
import { useAuth } from '../auth/useAuth'
import { useDashboard } from '../hooks/useDashboard'
import { useI18n } from '../i18n/useI18n'

// Dashboard shortcuts, per role.
const ADMIN_QUICK_ACTIONS = [
  { to: '/tickets/new', label: 'dashboard.qa.createTicket', icon: PlusIcon },
  { to: '/customers?new=1', label: 'dashboard.qa.addCustomer', icon: UsersIcon },
  { to: '/agents?new=1', label: 'dashboard.qa.addAgent', icon: BadgeIcon },
  { to: '/settings?section=categories', label: 'dashboard.qa.manageCategories', icon: FolderOpenIcon },
  { to: '/reports', label: 'dashboard.qa.viewReports', icon: ReportsIcon },
]

const CUSTOMER_QUICK_ACTIONS = [
  { to: '/tickets/new', label: 'dashboard.qa.createTicket', icon: PlusIcon },
  { to: '/tickets', label: 'dashboard.qa.myTickets', icon: TicketIcon },
  { to: '/kb', label: 'dashboard.qa.helpCenter', icon: BookIcon },
  { to: '/settings?section=profile', label: 'dashboard.qa.editProfile', icon: UserIcon },
]

// "Unassigned" and "Assigned" are both the stored `open` status, split by whether the ticket
// has an agent yet; the API understands `assigned` as that second half.
const STATUS_OPTIONS = [
  { value: 'open', label: 'status.open' },
  { value: 'assigned', label: 'status.assigned' },
  { value: 'in_progress', label: 'status.in_progress' },
  { value: 'on_hold', label: 'status.on_hold' },
  { value: 'resolved', label: 'status.resolved' },
  { value: 'closed', label: 'status.closed' },
]

function toISODate(d) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function todayRange() {
  const today = toISODate(new Date())
  return { from: today, to: today }
}

// Monday -> Sunday of the current week.
function thisWeekRange() {
  const now = new Date()
  const day = now.getDay() // 0 = Sunday, 1 = Monday, ...
  const monday = new Date(now)
  monday.setDate(now.getDate() + (day === 0 ? -6 : 1 - day))
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return { from: toISODate(monday), to: toISODate(sunday) }
}

// Monday -> Sunday of the week before this one. Shifting this week's Monday back 7 days
// keeps the same week boundary, so the two presets always sit flush against each other.
function lastWeekRange() {
  const { from } = thisWeekRange()
  const monday = new Date(`${from}T00:00:00`)
  monday.setDate(monday.getDate() - 7)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return { from: toISODate(monday), to: toISODate(sunday) }
}

// 1st -> last day of the current month. Day 0 of next month is this month's last day.
function thisMonthRange() {
  const now = new Date()
  const first = new Date(now.getFullYear(), now.getMonth(), 1)
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return { from: toISODate(first), to: toISODate(last) }
}

// Ranges are computed on each render so they stay correct if the page is left open overnight.
const DATE_PRESETS = [
  { label: 'dashboard.today', range: todayRange },
  { label: 'dashboard.thisWeek', range: thisWeekRange },
  { label: 'dashboard.lastWeek', range: lastWeekRange },
  { label: 'dashboard.thisMonth', range: thisMonthRange },
]

export default function DashboardPage() {
  const { user } = useAuth()
  const { t } = useI18n()
  const quickActions =
    user?.role === 'admin'
      ? ADMIN_QUICK_ACTIONS
      : user?.role === 'customer'
        ? CUSTOMER_QUICK_ACTIONS
        : null
  // Default to the tickets still waiting on someone — unassigned + assigned-not-started —
  // for the current week.
  const [statuses, setStatuses] = useState(['open', 'assigned'])
  const [dateFrom, setDateFrom] = useState(() => thisWeekRange().from)
  const [dateTo, setDateTo] = useState(() => thisWeekRange().to)
  const { data, isLoading } = useDashboard({ statuses, dateFrom, dateTo })

  function toggleStatus(value) {
    setStatuses((current) =>
      current.includes(value) ? current.filter((s) => s !== value) : [...current, value]
    )
  }

  function clearDates() {
    setDateFrom('')
    setDateTo('')
  }

  function applyRange(range) {
    setDateFrom(range.from)
    setDateTo(range.to)
  }

  // Highlight the preset whose bounds the current dates match exactly.
  function isActiveRange(range) {
    return dateFrom === range.from && dateTo === range.to
  }

  return (
    <div>
      <div className="mb-6 min-w-0">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{t('dashboard.title')}</h1>
        <p className="mt-1 truncate text-gray-500 dark:text-gray-300">{t('dashboard.welcome')}{user?.full_name}.</p>
      </div>

      {isLoading && !data && (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      )}

      {data && (
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
          <StatTile label={t('dashboard.stat.total')} value={data.stats.total} icon={InboxIcon} color="indigo" />
          <StatTile label={t('status.open')} value={data.stats.open} icon={FolderOpenIcon} color="blue" />
          <StatTile label={t('status.assigned')} value={data.stats.assigned} icon={BadgeIcon} color="purple" />
          <StatTile label={t('status.in_progress')} value={data.stats.in_progress} icon={ClockIcon} color="amber" />
          <StatTile label={t('status.resolved')} value={data.stats.resolved} icon={CheckCircleIcon} color="green" />
        </div>
      )}

      {/* Sits below the stat tiles: the counts are what you come to the
          dashboard to read, the actions are what you do next. Kept outside the
          `data` guard so they stay reachable while the stats are still loading. */}
      {quickActions && (
        <div className="mb-6">
          <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100">
            {t('dashboard.quickActions')}
          </h2>
          <div className="flex flex-wrap gap-3">
            {quickActions.map((a) => (
              <Link
                key={a.to}
                to={a.to}
                className="flex min-w-[160px] flex-1 items-center gap-3 rounded-2xl border border-gray-200/70 bg-white p-4 shadow-soft transition hover:border-indigo-300 hover:shadow-md dark:border-white/10 dark:bg-gray-900/70 dark:hover:border-indigo-400/40"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
                  <a.icon className="h-5 w-5" />
                </span>
                <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{t(a.label)}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {data && (
        <>
          <div className="mb-3 flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t('dashboard.ticketsHeading')}</h2>
              <div className="flex flex-wrap gap-2">
                {STATUS_OPTIONS.map((opt) => {
                  const active = statuses.includes(opt.value)
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => toggleStatus(opt.value)}
                      className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                        active
                          ? 'border-transparent bg-gradient-to-b from-indigo-500 to-indigo-600 text-white shadow-sm ring-1 ring-inset ring-indigo-700/20'
                          : 'border-gray-300 text-gray-600 hover:bg-gray-100 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/10'
                      }`}
                    >
                      {t(opt.label)}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1 text-xs text-gray-500 dark:text-gray-300">
                {t('dashboard.from')}
                <input
                  type="date"
                  value={dateFrom}
                  max={dateTo || undefined}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="rounded-xl border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 shadow-sm transition focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/15 dark:border-white/10 dark:bg-white/5 dark:text-gray-100"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-gray-500 dark:text-gray-300">
                {t('dashboard.to')}
                <input
                  type="date"
                  value={dateTo}
                  min={dateFrom || undefined}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="rounded-xl border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 shadow-sm transition focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/15 dark:border-white/10 dark:bg-white/5 dark:text-gray-100"
                />
              </label>
              {DATE_PRESETS.map((preset) => {
                const range = preset.range()
                return (
                  <Button
                    key={preset.label}
                    variant={isActiveRange(range) ? 'primary' : 'secondary'}
                    onClick={() => applyRange(range)}
                  >
                    {t(preset.label)}
                  </Button>
                )
              })}
              {(dateFrom || dateTo) && (
                <Button variant="secondary" onClick={clearDates}>
                  {t('dashboard.clearDates')}
                </Button>
              )}
            </div>
          </div>

          {data.recent_tickets.length === 0 ? (
            <EmptyState
              title={t('dashboard.empty.title')}
              description={
                statuses.length === 0
                  ? t('dashboard.empty.selectStatus')
                  : t('dashboard.empty.noMatch')
              }
            />
          ) : (
            <TicketTable tickets={data.recent_tickets} />
          )}
        </>
      )}
    </div>
  )
}
