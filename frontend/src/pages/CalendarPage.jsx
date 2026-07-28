import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Breadcrumbs from '../components/ui/Breadcrumbs'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Spinner from '../components/ui/Spinner'
import TicketFilters from '../components/tickets/TicketFilters'
import { ChevronRightIcon } from '../components/ui/icons'
import { useTicketCalendar } from '../hooks/useTicketCalendar'
import { useI18n } from '../i18n/useI18n'

// Weeks start on Sunday, matching the working week where this is deployed.
const WEEK_START = 0
const WEEKS_SHOWN = 6

// Chip accent per priority — same mapping as PriorityBadge, written out so Tailwind sees it.
const PRIORITY_DOT = {
  low: 'bg-gray-400',
  medium: 'bg-blue-500',
  high: 'bg-orange-500',
  urgent: 'bg-red-500',
}

// Local YYYY-MM-DD. Deliberately not toISOString(), which shifts to UTC and can land on
// the previous day for anyone east of Greenwich.
function toKey(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function addDays(date, days) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

// The first cell of the grid: the WEEK_START on or before the 1st of the month.
function gridStart(month) {
  const first = startOfMonth(month)
  return addDays(first, -((first.getDay() - WEEK_START + 7) % 7))
}

function TicketChip({ ticket, onOpen }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(ticket.id)}
      title={`${ticket.reference} — ${ticket.subject}`}
      className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-start text-[11px] leading-tight text-gray-700 transition-colors hover:bg-indigo-50 dark:text-gray-200 dark:hover:bg-indigo-500/10"
    >
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${PRIORITY_DOT[ticket.priority] || 'bg-gray-400'}`}
      />
      <span className="truncate">{ticket.subject}</span>
    </button>
  )
}

export default function CalendarPage() {
  const { t, lang } = useI18n()
  const navigate = useNavigate()
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [filters, setFilters] = useState({})
  const [expandedDay, setExpandedDay] = useState(null)

  const todayKey = toKey(new Date())
  const start = useMemo(() => gridStart(month), [month])
  const days = useMemo(
    () => Array.from({ length: WEEKS_SHOWN * 7 }, (_, i) => addDays(start, i)),
    [start]
  )

  // Fetch the whole visible grid, so leading/trailing days from neighbouring months
  // show their tickets too instead of looking empty.
  const { data, isLoading, isError } = useTicketCalendar({
    from: toKey(days[0]),
    to: toKey(days[days.length - 1]),
    ...filters,
  })

  const byDay = useMemo(() => {
    const map = new Map()
    for (const ticket of data || []) {
      if (!map.has(ticket.start_date)) map.set(ticket.start_date, [])
      map.get(ticket.start_date).push(ticket)
    }
    return map
  }, [data])

  const monthLabel = new Intl.DateTimeFormat(lang, { month: 'long', year: 'numeric' }).format(month)
  const weekdayNames = useMemo(() => {
    const format = new Intl.DateTimeFormat(lang, { weekday: 'short' })
    // Any known Sunday works as the anchor for generating weekday names in order.
    const anchor = new Date(2024, 0, 7)
    return Array.from({ length: 7 }, (_, i) => format.format(addDays(anchor, WEEK_START + i)))
  }, [lang])

  function openTicket(id) {
    navigate(`/tickets/${id}`)
  }

  function shiftMonth(delta) {
    setExpandedDay(null)
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1))
  }

  const visibleCount = (data || []).filter(
    (ticket) => new Date(`${ticket.start_date}T00:00:00`).getMonth() === month.getMonth()
  ).length

  return (
    <div>
      <Breadcrumbs
        items={[{ label: t('crumb.dashboard'), to: '/dashboard' }, { label: t('nav.calendar') }]}
      />
      <div className="mb-4">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
          {t('nav.calendar')}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('calendar.subtitle')}</p>
      </div>

      <TicketFilters filters={filters} onChange={setFilters} />

      <Card className="p-0">
        {/* Month navigation */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 p-4 dark:border-white/10">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              aria-label={t('calendar.prevMonth')}
              className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/10"
            >
              <ChevronRightIcon className="h-5 w-5 rotate-180 rtl:rotate-0" />
            </button>
            <h2 className="min-w-40 text-center text-base font-semibold text-gray-900 dark:text-gray-100">
              {monthLabel}
            </h2>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              aria-label={t('calendar.nextMonth')}
              className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/10"
            >
              <ChevronRightIcon className="h-5 w-5 rtl:rotate-180" />
            </button>
            {isLoading && <Spinner />}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {visibleCount} {t('calendar.ticketsThisMonth')}
            </span>
            <Button
              variant="secondary"
              onClick={() => {
                setExpandedDay(null)
                setMonth(startOfMonth(new Date()))
              }}
            >
              {t('calendar.today')}
            </Button>
          </div>
        </div>

        {isError ? (
          <p className="p-6 text-sm text-red-600 dark:text-red-400">{t('tickets.loadError')}</p>
        ) : (
          <>
            {/* Month grid (sm and up) */}
            <div className="hidden sm:block">
              <div className="grid grid-cols-7 border-b border-gray-100 dark:border-white/10">
                {weekdayNames.map((name) => (
                  <div
                    key={name}
                    className="px-2 py-2 text-center text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500"
                  >
                    {name}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-px bg-gray-100 dark:bg-white/10">
                {days.map((day) => {
                  const key = toKey(day)
                  const tickets = byDay.get(key) || []
                  const inMonth = day.getMonth() === month.getMonth()
                  const isToday = key === todayKey
                  const expanded = expandedDay === key
                  const shown = expanded ? tickets : tickets.slice(0, 3)
                  return (
                    <div
                      key={key}
                      className={`min-h-28 p-1.5 ${
                        inMonth ? 'bg-white dark:bg-gray-900/70' : 'bg-gray-50/70 dark:bg-gray-900/30'
                      }`}
                    >
                      <div className="mb-1 flex items-center justify-between px-0.5">
                        <span
                          className={`flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-medium ${
                            isToday
                              ? 'bg-indigo-600 text-white'
                              : inMonth
                                ? 'text-gray-700 dark:text-gray-300'
                                : 'text-gray-400 dark:text-gray-600'
                          }`}
                        >
                          {day.getDate()}
                        </span>
                        {tickets.length > 0 && (
                          <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500">
                            {tickets.length}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col gap-0.5">
                        {shown.map((ticket) => (
                          <TicketChip key={ticket.id} ticket={ticket} onOpen={openTicket} />
                        ))}
                        {tickets.length > 3 && (
                          <button
                            type="button"
                            onClick={() => setExpandedDay(expanded ? null : key)}
                            className="px-1.5 text-start text-[10px] font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                          >
                            {expanded
                              ? t('calendar.showLess')
                              : `+${tickets.length - 3} ${t('calendar.more')}`}
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Agenda fallback — a 7-column grid is unreadable on a phone. */}
            <div className="flex flex-col divide-y divide-gray-100 sm:hidden dark:divide-white/10">
              {days
                .filter((day) => day.getMonth() === month.getMonth() && byDay.has(toKey(day)))
                .map((day) => {
                  const key = toKey(day)
                  return (
                    <div key={key} className="flex gap-3 p-3">
                      <div className="w-14 shrink-0">
                        <div
                          className={`flex h-10 w-10 flex-col items-center justify-center rounded-xl text-xs ${
                            key === todayKey
                              ? 'bg-indigo-600 text-white'
                              : 'bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-gray-300'
                          }`}
                        >
                          <span className="text-sm font-semibold">{day.getDate()}</span>
                          <span className="text-[9px] uppercase">
                            {new Intl.DateTimeFormat(lang, { weekday: 'short' }).format(day)}
                          </span>
                        </div>
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        {(byDay.get(key) || []).map((ticket) => (
                          <TicketChip key={ticket.id} ticket={ticket} onOpen={openTicket} />
                        ))}
                      </div>
                    </div>
                  )
                })}
              {visibleCount === 0 && !isLoading && (
                <p className="p-6 text-center text-sm text-gray-400 dark:text-gray-500">
                  {t('calendar.empty')}
                </p>
              )}
            </div>
          </>
        )}

        {/* Priority legend */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-gray-100 px-4 py-3 text-[11px] text-gray-500 dark:border-white/10 dark:text-gray-400">
          {Object.entries(PRIORITY_DOT).map(([priority, dot]) => (
            <span key={priority} className="inline-flex items-center gap-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
              {t(`priority.${priority}`)}
            </span>
          ))}
        </div>
      </Card>
    </div>
  )
}
