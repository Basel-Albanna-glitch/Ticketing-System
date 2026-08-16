import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Avatar from '../ui/Avatar'
import Button from '../ui/Button'
import Card from '../ui/Card'
import PriorityBadge from '../tickets/PriorityBadge'
import { CheckCircleIcon, ChevronRightIcon, LockIcon, PaperClipIcon, PlusIcon } from '../ui/icons'
import { useUpdateTodo } from '../../hooks/useTodos'
import { useI18n } from '../../i18n/useI18n'
import { addDays, startOfMonth, toKey, weekdayNames, WEEK_START } from '../../utils/calendarDates'

// The day a to-do belongs to. Due date first, since that is the deadline the agenda is
// organised around; an item with only a start date is shown on the day it opens rather
// than dropped, which is the whole point of listing dated work.
function dayOf(todo) {
  const when = todo.due_at || todo.start_at
  return when ? toKey(new Date(when)) : null
}

// Priority reads off the check circle rather than a badge on every line. A badge per row
// turned the agenda into a column of chips; the ring is always in the same place, so it
// scans down the page as one signal instead of interrupting each title.
//
// Colour never carries it alone: the two priorities worth acting on keep a labelled badge,
// and every circle names its priority in the tooltip.
const PRIORITY_RING = {
  urgent: 'border-red-500 hover:bg-red-50 dark:hover:bg-red-500/10',
  high: 'border-orange-500 hover:bg-orange-50 dark:hover:bg-orange-500/10',
  medium: 'border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10',
  low: 'border-gray-300 hover:bg-gray-100 dark:border-gray-500 dark:hover:bg-white/10',
}

function DoneToggle({ todo, onClick, t }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={todo.done}
      title={`${todo.done ? t('todo.reopen') : t('todo.markDone')} · ${t(`priority.${todo.priority}`)}`}
      className={`mt-px flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 ${
        todo.done
          ? 'border-emerald-500 bg-emerald-500 text-white'
          : `text-transparent hover:text-current ${PRIORITY_RING[todo.priority] || PRIORITY_RING.low}`
      }`}
    >
      <CheckCircleIcon className="h-3 w-3" />
    </button>
  )
}

// A dot separator between meta items, so the line reads as one sentence rather than a
// row of disconnected fragments.
function Meta({ children }) {
  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
      {children}
    </div>
  )
}

function Dot() {
  return <span aria-hidden className="text-gray-300 dark:text-gray-600">·</span>
}

function AgendaRow({ todo, onOpen, onToggleDone, overdue, t }) {
  const when = todo.due_at || todo.start_at
  // Only the two that call for action. Medium and low are the resting state of the list,
  // and labelling them says nothing you would act on.
  const loud = todo.priority === 'urgent' || todo.priority === 'high'
  const meta = [
    <span key="when" className={overdue ? 'font-medium text-red-600 dark:text-red-400' : ''}>
      {new Date(when).toLocaleString(
        [],
        overdue ? { dateStyle: 'medium', timeStyle: 'short' } : { timeStyle: 'short' }
      )}
    </span>,
    loud && <PriorityBadge key="priority" priority={todo.priority} variant="outline" />,
    todo.is_private && (
      <span key="private" className="inline-flex items-center gap-1" title={t('todo.sectionPrivate')}>
        <LockIcon className="h-3 w-3" />
      </span>
    ),
    todo.folder && (
      <span key="folder" className="truncate">
        {todo.folder.name}
      </span>
    ),
    todo.attachments?.length > 0 && (
      <span key="files" className="inline-flex items-center gap-0.5">
        <PaperClipIcon className="h-3 w-3" />
        {todo.attachments.length}
      </span>
    ),
    todo.customer && (
      <span key="customer" className="truncate text-indigo-600 dark:text-indigo-400">
        {todo.customer.full_name}
      </span>
    ),
  ].filter(Boolean)

  return (
    <div className="group -mx-2 flex items-start gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-gray-50 dark:hover:bg-white/5">
      <DoneToggle todo={todo} onClick={() => onToggleDone(todo)} t={t} />
      <button type="button" onClick={() => onOpen(todo)} className="min-w-0 flex-1 text-start">
        <span
          className={`text-sm ${
            todo.done
              ? 'text-gray-400 line-through dark:text-gray-500'
              : 'text-gray-800 dark:text-gray-100'
          }`}
        >
          {todo.title}
        </span>
        <Meta>
          {meta.map((node, i) => (
            <span key={node.key} className="inline-flex items-center gap-1.5">
              {i > 0 && <Dot />}
              {node}
            </span>
          ))}
        </Meta>
      </button>
      {/* Faces sit at the end of the row, in a column of their own, so a long title never
          pushes them out of line with the row above. */}
      {todo.assignees?.length > 0 && (
        <span className="mt-0.5 flex shrink-0 items-center -space-x-1.5 rtl:space-x-reverse">
          {todo.assignees.slice(0, 3).map((person) => (
            <Avatar
              key={person.id}
              name={person.full_name}
              src={person.avatar}
              size="sm"
              title={person.full_name}
              className="!h-5 !w-5 !text-[9px] ring-2 ring-white dark:ring-gray-900"
            />
          ))}
          {todo.assignees.length > 3 && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-200 text-[9px] font-semibold text-gray-600 ring-2 ring-white dark:bg-white/15 dark:text-gray-200 dark:ring-gray-900">
              +{todo.assignees.length - 3}
            </span>
          )}
        </span>
      )}
    </div>
  )
}

// One day of the agenda. Empty days are drawn too: the gap between Tuesday and Friday is
// information, and a list that silently skips it reads as a shorter week than it is.
function DaySection({ dayKey, label, rows, isToday, onOpen, onToggleDone, onAdd, t }) {
  return (
    <section id={`agenda-${dayKey}`} className="group/day scroll-mt-20">
      {/* The heading rides the top of the scroll while its own day is on screen, so you
          always know which day you are reading — the one thing a long agenda loses. */}
      <h3
        className={`sticky top-14 z-20 flex items-baseline gap-2 border-b py-1.5 text-sm backdrop-blur ${
          isToday
            ? 'border-indigo-200 bg-white/85 dark:border-indigo-400/30 dark:bg-gray-900/85'
            : 'border-gray-200 bg-white/85 dark:border-white/10 dark:bg-gray-900/85'
        }`}
      >
        {label}
        {rows.length > 0 && (
          <span className="ms-auto text-xs tabular-nums text-gray-400 dark:text-gray-500">
            {rows.length}
          </span>
        )}
      </h3>
      <div className="flex flex-col pt-1">
        {rows.map((todo) => (
          <AgendaRow
            key={todo.id}
            todo={todo}
            onOpen={onOpen}
            onToggleDone={onToggleDone}
            t={t}
          />
        ))}
      </div>
      {/* Reveals on hover over the day rather than sitting there permanently: thirty-one
          identical Add rows down the page is a lot of furniture for one action. It stays
          visible on an empty day, where it is the only thing to do. */}
      <button
        type="button"
        onClick={() => onAdd(dayKey)}
        className={`-mx-2 mt-0.5 flex w-[calc(100%+1rem)] items-center gap-2 rounded-lg px-2 py-1.5 text-start text-sm text-gray-400 transition hover:bg-gray-50 hover:text-indigo-600 focus-visible:opacity-100 dark:text-gray-500 dark:hover:bg-white/5 dark:hover:text-indigo-400 ${
          rows.length ? 'opacity-0 group-hover/day:opacity-100' : 'opacity-100'
        }`}
      >
        <PlusIcon className="h-4 w-4" />
        {t('todo.addOnDay')}
      </button>
    </section>
  )
}

// The Upcoming view: dated work as a day-by-day agenda rather than a list, with whatever
// is already late gathered at the top where it cannot be scrolled past.
//
// `rows` is the whole visible list, not a pre-filtered slice — the agenda decides for
// itself what is overdue and what falls on which day.
export default function TodoAgenda({ rows = [] }) {
  const { t, lang } = useI18n()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const updateTodo = useUpdateTodo()
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [overdueOpen, setOverdueOpen] = useState(true)

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayKey = toKey(today)
  const isThisMonth =
    month.getFullYear() === today.getFullYear() && month.getMonth() === today.getMonth()

  // Where the day list starts. Past days of the current month are already accounted for
  // by the Overdue group above, so opening on the 1st would just be empty scrolling.
  const firstDay = isThisMonth ? today : startOfMonth(month)
  const lastDay = new Date(month.getFullYear(), month.getMonth() + 1, 0)
  const days = useMemo(() => {
    const out = []
    for (let d = new Date(firstDay); d <= lastDay; d = addDays(d, 1)) out.push(new Date(d))
    return out
    // firstDay/lastDay are derived from month, which is the real dependency.
  }, [month]) // eslint-disable-line react-hooks/exhaustive-deps

  const byDay = useMemo(() => {
    const map = new Map()
    for (const todo of rows) {
      const key = dayOf(todo)
      if (!key) continue
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(todo)
    }
    for (const list of map.values()) {
      list.sort((a, b) => new Date(a.due_at || a.start_at) - new Date(b.due_at || b.start_at))
    }
    return map
  }, [rows])

  // Late work, whatever month it belongs to — it does not stop being late because you
  // paged forward. Done items are never overdue, however far past their date they sit.
  const overdue = useMemo(
    () =>
      rows
        .filter((todo) => {
          if (todo.done) return false
          const key = dayOf(todo)
          return key !== null && key < todayKey
        })
        .sort((a, b) => new Date(a.due_at || a.start_at) - new Date(b.due_at || b.start_at)),
    [rows, todayKey]
  )

  // The week the agenda opens on, as a jump bar. Seven days is enough to see the shape of
  // the week without turning the header into a second calendar.
  const weekStart = addDays(firstDay, -((firstDay.getDay() - WEEK_START + 7) % 7))
  const strip = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const weekdays = useMemo(() => weekdayNames(lang), [lang])
  const monthLabel = new Intl.DateTimeFormat(lang, { month: 'long', year: 'numeric' }).format(month)

  // "16 Aug · Today · Sunday" — the date, then what makes it worth knowing.
  function dayLabel(date) {
    const key = toKey(date)
    const stamp = new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short' }).format(date)
    const weekday = new Intl.DateTimeFormat(lang, { weekday: 'long' }).format(date)
    const relative =
      key === todayKey
        ? t('todo.dayToday')
        : key === toKey(addDays(today, 1))
          ? t('todo.dayTomorrow')
          : null
    return (
      <>
        <span className="font-semibold text-gray-900 dark:text-gray-100">{stamp}</span>
        {relative && (
          <>
            <span className="text-gray-400 dark:text-gray-500"> · </span>
            <span className="font-semibold text-indigo-600 dark:text-indigo-400">{relative}</span>
          </>
        )}
        <span className="text-gray-400 dark:text-gray-500"> · </span>
        <span className="text-gray-500 dark:text-gray-400">{weekday}</span>
      </>
    )
  }

  function openTodo(todo) {
    navigate(`/todo/${todo.id}/edit`, { state: { from: pathname } })
  }

  function toggleDone(todo) {
    updateTodo.mutate({ id: todo.id, done: !todo.done })
  }

  // Adding from a day carries that day with it, so the new to-do lands where it was asked
  // for. End of day rather than a made-up hour: "due on the 18th" means by the 18th, and
  // a 09:00 default would show it overdue by lunchtime.
  function addOn(dayKey) {
    navigate('/todo/new', { state: { from: pathname, dueDate: `${dayKey}T23:59` } })
  }

  function jumpTo(date) {
    document.getElementById(`agenda-${toKey(date)}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <Card className="!p-0">
      <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-3 px-5 pb-3 pt-5">
        <h2 className="text-lg font-semibold tracking-tight text-gray-900 dark:text-gray-100">
          {monthLabel}
        </h2>
        <div className="flex items-center gap-1">
          <Button variant="secondary" onClick={() => setMonth(startOfMonth(new Date()))}>
            {t('calendar.today')}
          </Button>
          <button
            type="button"
            onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
            aria-label={t('calendar.prevMonth')}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-gray-100"
          >
            {/* One chevron, turned. "Previous" is on the right in Arabic, so a flipped
                right-chevron follows the reading direction where a left one would not. */}
            <ChevronRightIcon className="h-4 w-4 rotate-180 rtl:rotate-0" />
          </button>
          <button
            type="button"
            onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
            aria-label={t('calendar.nextMonth')}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-gray-100"
          >
            <ChevronRightIcon className="h-4 w-4 rtl:rotate-180" />
          </button>
        </div>
      </div>

      {/* The week at a glance, and a way to jump into it. */}
      <div className="border-b border-gray-200 dark:border-white/10">
        <div className="mx-auto grid w-full max-w-3xl grid-cols-7 gap-1 px-4 pb-3">
          {strip.map((date, i) => {
            const key = toKey(date)
            const count = (byDay.get(key) || []).length
            const isToday = key === todayKey
            return (
              <button
                key={key}
                type="button"
                onClick={() => jumpTo(date)}
                className={`flex flex-col items-center gap-1 rounded-xl py-2 transition-colors ${
                  isToday
                    ? 'bg-indigo-50 dark:bg-indigo-500/10'
                    : 'hover:bg-gray-100 dark:hover:bg-white/5'
                }`}
              >
                <span
                  className={`text-[11px] font-medium uppercase tracking-wide ${
                    isToday
                      ? 'text-indigo-600 dark:text-indigo-300'
                      : 'text-gray-400 dark:text-gray-500'
                  }`}
                >
                  {weekdays[i]}
                </span>
                <span
                  className={`flex h-7 min-w-7 items-center justify-center rounded-full px-1 text-sm font-semibold ${
                    isToday
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-gray-700 dark:text-gray-200'
                  }`}
                >
                  {date.getDate()}
                </span>
                {/* A dot, not a number: how busy a day is belongs in the strip, how busy
                    exactly belongs in the day's own section. Always rendered so the
                    columns keep the same height whether or not a day has anything on it. */}
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    count
                      ? isToday
                        ? 'bg-indigo-500'
                        : 'bg-gray-300 dark:bg-gray-600'
                      : 'bg-transparent'
                  }`}
                />
              </button>
            )
          })}
        </div>
      </div>

      {/* One readable column rather than the full width of a wide screen: a to-do title
          stretched across 1600px is a line nobody's eye tracks back from. */}
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-7 px-5 py-5">
        {overdue.length > 0 && (
          <section className="rounded-xl bg-red-50/50 p-3 ring-1 ring-inset ring-red-100 dark:bg-red-500/5 dark:ring-red-500/15">
            {/* Tinted, unlike the day sections. Late work is the one thing on this page
                that is not simply "when" — it is a backlog, and it should not read as
                just another day heading you scroll past. */}
            <button
              type="button"
              onClick={() => setOverdueOpen((open) => !open)}
              aria-expanded={overdueOpen}
              className="flex w-full items-center gap-1.5 text-start"
            >
              <ChevronRightIcon
                className={`h-3.5 w-3.5 text-red-400 transition-transform ${
                  overdueOpen ? 'rotate-90' : 'rtl:rotate-180'
                }`}
              />
              <span className="text-sm font-semibold text-red-600 dark:text-red-400">
                {t('todo.overdue')}
              </span>
              <span className="ms-auto rounded-full bg-red-100 px-2 text-xs font-medium tabular-nums text-red-700 dark:bg-red-500/15 dark:text-red-300">
                {overdue.length}
              </span>
            </button>
            {overdueOpen && (
              <div className="flex flex-col pt-1">
                {overdue.map((todo) => (
                  <AgendaRow
                    key={todo.id}
                    todo={todo}
                    overdue
                    onOpen={openTodo}
                    onToggleDone={toggleDone}
                    t={t}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {days.map((date) => {
          const key = toKey(date)
          return (
            <DaySection
              key={key}
              dayKey={key}
              label={dayLabel(date)}
              rows={byDay.get(key) || []}
              isToday={key === todayKey}
              onOpen={openTodo}
              onToggleDone={toggleDone}
              onAdd={addOn}
              t={t}
            />
          )
        })}
      </div>
    </Card>
  )
}
