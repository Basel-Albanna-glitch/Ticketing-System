import { useState } from 'react'
import { Link } from 'react-router-dom'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import Spinner from '../components/ui/Spinner'
import StatTile from '../components/ui/StatTile'
import { CheckCircleIcon, ClockIcon, FolderOpenIcon, InboxIcon, PlusIcon } from '../components/ui/icons'
import TicketTable from '../components/tickets/TicketTable'
import { useAuth } from '../auth/useAuth'
import { useDashboard } from '../hooks/useDashboard'
import { useI18n } from '../i18n/useI18n'

const STATUS_OPTIONS = [
  { value: 'open', label: 'status.open' },
  { value: 'in_progress', label: 'status.in_progress' },
  { value: 'on_hold', label: 'status.on_hold' },
  { value: 'resolved', label: 'status.resolved' },
  { value: 'closed', label: 'status.closed' },
]

function toISODate(d) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
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

export default function DashboardPage() {
  const { user } = useAuth()
  const { t } = useI18n()
  // Default to showing only open + in-progress tickets, for the current week.
  const [statuses, setStatuses] = useState(['open', 'in_progress'])
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

  function setThisWeek() {
    const week = thisWeekRange()
    setDateFrom(week.from)
    setDateTo(week.to)
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{t('dashboard.title')}</h1>
          <p className="mt-1 truncate text-gray-500 dark:text-gray-400">{t('dashboard.welcome')}{user?.full_name}.</p>
        </div>
        <Link to="/tickets/new" className="shrink-0">
          <Button className="whitespace-nowrap">
            <PlusIcon className="h-4 w-4" />
            {t('dashboard.createTicket')}
          </Button>
        </Link>
      </div>

      {isLoading && !data && (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      )}

      {data && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile label={t('dashboard.stat.total')} value={data.stats.total} icon={InboxIcon} color="indigo" />
            <StatTile label={t('status.open')} value={data.stats.open} icon={FolderOpenIcon} color="blue" />
            <StatTile label={t('status.in_progress')} value={data.stats.in_progress} icon={ClockIcon} color="amber" />
            <StatTile label={t('status.resolved')} value={data.stats.resolved} icon={CheckCircleIcon} color="green" />
          </div>

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
              <label className="flex flex-col gap-1 text-xs text-gray-500 dark:text-gray-400">
                {t('dashboard.from')}
                <input
                  type="date"
                  value={dateFrom}
                  max={dateTo || undefined}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="rounded-xl border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 shadow-sm transition focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/15 dark:border-white/10 dark:bg-white/5 dark:text-gray-100"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-gray-500 dark:text-gray-400">
                {t('dashboard.to')}
                <input
                  type="date"
                  value={dateTo}
                  min={dateFrom || undefined}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="rounded-xl border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 shadow-sm transition focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/15 dark:border-white/10 dark:bg-white/5 dark:text-gray-100"
                />
              </label>
              <Button variant="secondary" onClick={setThisWeek}>
                {t('dashboard.thisWeek')}
              </Button>
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
