import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Breadcrumbs from '../components/ui/Breadcrumbs'
import Button from '../components/ui/Button'
import Avatar from '../components/ui/Avatar'
import Card from '../components/ui/Card'
import ProgressBar from '../components/ui/ProgressBar'
import Modal from '../components/ui/Modal'
import Select from '../components/ui/Select'
import Spinner from '../components/ui/Spinner'
import TicketFilters from '../components/tickets/TicketFilters'
import { BoardIcon, CheckCircleIcon, ChevronRightIcon } from '../components/ui/icons'
import { useAgents } from '../hooks/useAgents'
import { useProjectCalendar } from '../hooks/useProjects'
import { useTicketCalendar } from '../hooks/useTicketCalendar'
import { useTodoCalendar } from '../hooks/useTodos'
import { useI18n } from '../i18n/useI18n'

// Weeks start on Sunday, matching the working week where this is deployed.
const WEEK_START = 0
const WEEKS_SHOWN = 6

// Quick ranges. 'month' keeps the grid; the rest narrow to a span and switch to an
// agenda, because a 7-column grid showing a single day is mostly empty squares.
const RANGES = ['today', 'yesterday', 'week', 'month']

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

// Who is on this. Overlapping avatars keep the footprint tiny inside a day square;
// past three, a +N stands in so a busy chip cannot push the date out of the cell.
function Assignees({ people = [] }) {
  if (!people.length) return null
  const shown = people.slice(0, 3)
  const extra = people.length - shown.length
  return (
    <span className="ms-auto flex shrink-0 items-center -space-x-1.5 rtl:space-x-reverse">
      {shown.map((person, index) => (
        <Avatar
          key={person.id ?? index}
          name={person.full_name}
          src={person.avatar}
          size="sm"
          className="!h-4 !w-4 !text-[8px] ring-1 ring-white dark:ring-gray-900"
        />
      ))}
      {extra > 0 && (
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-gray-200 text-[8px] font-semibold text-gray-600 ring-1 ring-white dark:bg-white/15 dark:text-gray-300 dark:ring-gray-900">
          +{extra}
        </span>
      )}
    </span>
  )
}

// Resolve a preset into the inclusive day span it covers. `month` is the month the
// user is currently browsing, so the grid keeps working with the arrows.
function rangeDays(range, month) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  if (range === 'today') return [today, today]
  if (range === 'yesterday') {
    const day = addDays(today, -1)
    return [day, day]
  }
  if (range === 'week') {
    const from = addDays(today, -((today.getDay() - WEEK_START + 7) % 7))
    return [from, addDays(from, 6)]
  }
  const first = startOfMonth(month)
  return [first, new Date(month.getFullYear(), month.getMonth() + 1, 0)]
}

// `isClose` marks the chip standing on the ticket's close date; the same closed ticket also
// has a chip back on its start date. `hasBothDays` is true when both chips exist, and only
// then are they tagged START / CLOSED — a ticket showing once needs no explaining.
function TicketChip({ ticket, onOpen, t, isClose = false, hasBothDays = false }) {
  const dayLabel = isClose ? t('calendar.tagClosed') : t('calendar.tagStart')
  return (
    <button
      type="button"
      onClick={(e) => {
        // The day cell opens a panel; a chip opens the ticket itself.
        e.stopPropagation()
        onOpen(ticket.id)
      }}
      title={`${ticket.reference} — ${ticket.subject} (${dayLabel})${
        ticket.assigned_agent_name ? ` · ${ticket.assigned_agent_name}` : ''
      }`}
      className={`flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-start text-[11px] leading-tight transition-colors ${
        isClose
          ? 'bg-green-50 text-green-800 ring-1 ring-inset ring-green-200/70 hover:bg-green-100 dark:bg-green-500/10 dark:text-green-300 dark:ring-green-400/20 dark:hover:bg-green-500/20'
          : 'text-gray-700 hover:bg-indigo-50 dark:text-gray-200 dark:hover:bg-indigo-500/10'
      }`}
    >
      {isClose ? (
        <CheckCircleIcon className="h-3 w-3 shrink-0" />
      ) : (
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${PRIORITY_DOT[ticket.priority] || 'bg-gray-400'}`}
        />
      )}
      {hasBothDays && (
        <span
          className={`shrink-0 rounded px-1 text-[9px] font-semibold uppercase tracking-wide ${
            isClose
              ? 'bg-green-200/70 text-green-900 dark:bg-green-400/20 dark:text-green-200'
              : 'bg-gray-200/80 text-gray-600 dark:bg-white/10 dark:text-gray-300'
          }`}
        >
          {dayLabel}
        </span>
      )}
      <span className="truncate">{ticket.subject}</span>
      <Assignees
        people={
          ticket.assigned_agent_name
            ? [{ full_name: ticket.assigned_agent_name, avatar: ticket.assigned_agent_avatar }]
            : []
        }
      />
    </button>
  )
}

// Projects read as a band rather than a dot: they are a window of work, not a single
// event, and must not be mistaken for tickets sharing the day.
function ProjectChip({ project, onOpen, t, kind = 'start' }) {
  const tag = t(
    kind === 'end' ? 'calendar.tagEnd' : kind === 'created' ? 'calendar.tagCreated' : 'calendar.tagStart'
  )
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onOpen(project.id)
      }}
      title={`${project.name} (${tag})${
        project.assignees?.length ? ` · ${project.assignees.map((a) => a.full_name).join(', ')}` : ''
      }`}
      className="flex w-full items-center gap-1.5 rounded-md border-s-2 border-violet-500 bg-violet-50 px-1.5 py-1 text-start text-[11px] leading-tight text-violet-900 transition-colors hover:bg-violet-100 dark:bg-violet-500/10 dark:text-violet-200 dark:hover:bg-violet-500/20"
    >
      <BoardIcon className="h-3 w-3 shrink-0" />
      <span className="shrink-0 rounded bg-violet-200/70 px-1 text-[9px] font-semibold uppercase tracking-wide text-violet-900 dark:bg-violet-400/20 dark:text-violet-100">
        {tag}
      </span>
      <span className="truncate">{project.name}</span>
      <Assignees people={project.assignees || []} />
    </button>
  )
}

// To-dos are internal jobs, so they read differently again from tickets and
// projects: amber, with a check-box glyph rather than a dot or a band.
function TodoChip({ todo, kind, onOpen, t }) {
  const done = todo.done
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onOpen()
      }}
      title={`${todo.title}${todo.assignees?.length ? ` \u00b7 ${todo.assignees.map((a) => a.full_name).join(', ')}` : ''}`}
      className={`flex w-full items-center gap-1.5 rounded-md bg-amber-50 px-1.5 py-1 text-start text-[11px] leading-tight text-amber-900 transition-colors hover:bg-amber-100 dark:bg-amber-500/10 dark:text-amber-200 dark:hover:bg-amber-500/20 ${
        done ? 'line-through opacity-70' : ''
      }`}
    >
      <CheckCircleIcon className="h-3 w-3 shrink-0" />
      <span className="shrink-0 rounded bg-amber-200/70 px-1 text-[9px] font-semibold uppercase tracking-wide text-amber-900 dark:bg-amber-400/20 dark:text-amber-100">
        {t(kind === 'start' ? 'calendar.tagStart' : 'calendar.tagDue')}
      </span>
      <span className="truncate">{todo.title}</span>
      <Assignees people={todo.assignees || []} />
    </button>
  )
}

export default function CalendarPage() {
  const { t, lang } = useI18n()
  const navigate = useNavigate()
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [filters, setFilters] = useState({})
  // Calendar-only filters, kept apart from the ticket ones because they govern both
  // kinds of entry: what to show at all, and whose work to show.
  const [range, setRange] = useState('month')
  const [show, setShow] = useState('all')
  const [assignee, setAssignee] = useState('')
  const { data: agents } = useAgents({ includeAdmins: true })
  const [expandedDay, setExpandedDay] = useState(null)
  // The day whose detail panel is open, as a YYYY-MM-DD key.
  const [selectedDay, setSelectedDay] = useState(null)

  const todayKey = toKey(new Date())
  const isMonthView = range === 'month'
  const start = useMemo(() => gridStart(month), [month])
  const days = useMemo(() => {
    // The month view always draws whole weeks, so neighbouring days are not blank.
    if (isMonthView) return Array.from({ length: WEEKS_SHOWN * 7 }, (_, i) => addDays(start, i))
    const [from, to] = rangeDays(range, month)
    const span = Math.round((to - from) / 86400000) + 1
    return Array.from({ length: span }, (_, i) => addDays(from, i))
  }, [isMonthView, range, start, month])

  // Fetch the whole visible grid, so leading/trailing days from neighbouring months
  // show their tickets too instead of looking empty.
  // 'all' shows everything; each other value narrows to one kind.
  const showTickets = show === 'all' || show === 'tickets'
  const showProjects = show === 'all' || show === 'projects'
  const showTodos = show === 'all' || show === 'todos'

  const { data, isLoading, isError } = useTicketCalendar({
    from: showTickets ? toKey(days[0]) : '',
    to: showTickets ? toKey(days[days.length - 1]) : '',
    ...filters,
    ...(assignee ? { assigned_agent: assignee } : {}),
  })

  // Projects share the window but not the ticket filters, which are ticket-specific.
  const { data: projects } = useProjectCalendar({
    from: toKey(days[0]),
    to: toKey(days[days.length - 1]),
    enabled: showProjects,
    ...(assignee ? { assignees: assignee } : {}),
  })

  // The API already scopes to-dos to the viewer, so no assignee filter here.
  const { data: todos } = useTodoCalendar({
    from: toKey(days[0]),
    to: toKey(days[days.length - 1]),
    enabled: showTodos,
  })

  // Each day holds { ticket, isClose } entries. A closed ticket appears twice — once on its
  // start date and once, marked green, on the day it closed.
  const byDay = useMemo(() => {
    const map = new Map()
    const push = (day, ticket, isClose, hasBothDays = false) => {
      if (!day) return
      if (!map.has(day)) map.set(day, [])
      map.get(day).push({ ticket, isClose, hasBothDays })
    }
    for (const ticket of (showTickets && data) || []) {
      const closedDay = ticket.closed_date
      // Opened and closed on the same day — one chip, showing the close.
      if (closedDay && closedDay === ticket.start_date) {
        push(closedDay, ticket, true)
        continue
      }
      // Two chips only when both days exist; that's what earns the START / CLOSED tags.
      const hasBothDays = Boolean(ticket.start_date && closedDay)
      push(ticket.start_date, ticket, false, hasBothDays)
      push(closedDay, ticket, true, hasBothDays)
    }
    return map
  }, [data, showTickets])

  // A project marks two days: the one it starts and the one it ends.
  const projectsByDay = useMemo(() => {
    const map = new Map()
    const push = (day, project, kind) => {
      if (!day) return
      if (!map.has(day)) map.set(day, [])
      map.get(day).push({ project, kind })
    }
    for (const project of (showProjects && projects) || []) {
      push(project.start_date, project, 'start')
      // A one-day project would otherwise show twice on the same square.
      if (project.end_date && project.end_date !== project.start_date) {
        push(project.end_date, project, 'end')
      }
      // The creation day always gets a chip, unless a dated chip already claims it.
      if (
        project.created_date &&
        project.created_date !== project.start_date &&
        project.created_date !== project.end_date
      ) {
        push(project.created_date, project, 'created')
      }
    }
    return map
  }, [projects, showProjects])

  // A to-do marks the day it is due; a window that starts earlier also marks
  // its start, so a multi-day job is visible from the moment it begins.
  // Declared before the day-panel selections below, which read it.
  const todosByDay = useMemo(() => {
    const map = new Map()
    const push = (iso, todo, kind) => {
      if (!iso) return
      const day = toKey(new Date(iso))
      if (!map.has(day)) map.set(day, [])
      map.get(day).push({ todo, kind })
    }
    for (const todo of (showTodos && todos) || []) {
      if (todo.due_at) push(todo.due_at, todo, 'due')
      if (todo.start_at && toKey(new Date(todo.start_at)) !== toKey(new Date(todo.due_at || todo.start_at))) {
        push(todo.start_at, todo, 'start')
      }
    }
    return map
  }, [todos, showTodos])

  // Everything on the open day, and its heading. Reads from the same maps the grid
  // draws from, so the panel can never disagree with the squares behind it.
  const selectedTickets = selectedDay ? byDay.get(selectedDay) || [] : []
  const selectedProjects = selectedDay ? projectsByDay.get(selectedDay) || [] : []
  const selectedTodos = selectedDay ? todosByDay.get(selectedDay) || [] : []
  const selectedLabel = selectedDay
    ? new Intl.DateTimeFormat(lang, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(new Date(`${selectedDay}T00:00:00`))
    : ''

  const monthLabel = isMonthView
    ? new Intl.DateTimeFormat(lang, { month: 'long', year: 'numeric' }).format(month)
    : days.length === 1
      ? new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'long' }).format(days[0])
      : `${new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short' }).format(days[0])} – ${new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short' }).format(days[days.length - 1])}`
  const weekdayNames = useMemo(() => {
    const format = new Intl.DateTimeFormat(lang, { weekday: 'short' })
    // Any known Sunday works as the anchor for generating weekday names in order.
    const anchor = new Date(2024, 0, 7)
    return Array.from({ length: 7 }, (_, i) => format.format(addDays(anchor, WEEK_START + i)))
  }, [lang])

  function openTicket(id) {
    navigate(`/tickets/${id}`)
  }

  function openProject(id) {
    navigate(`/projects/${id}`)
  }

  function shiftMonth(delta) {
    setExpandedDay(null)
    setSelectedDay(null)
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1))
  }

  // Distinct tickets showing anywhere in this month — one that both starts and closes here
  // has two chips but is still one ticket.
  const visibleCount = useMemo(() => {
    const ids = new Set()
    for (const day of days) {
      // In month view the leading/trailing days belong to other months and are not counted.
      if (isMonthView && day.getMonth() !== month.getMonth()) continue
      for (const entry of byDay.get(toKey(day)) || []) ids.add(entry.ticket.id)
    }
    return ids.size
  }, [days, month, byDay, isMonthView])

  // Distinct projects on screen — one showing both a START and an END chip is still one.
  const visibleProjectCount = useMemo(() => {
    const ids = new Set()
    for (const day of days) {
      if (isMonthView && day.getMonth() !== month.getMonth()) continue
      for (const entry of projectsByDay.get(toKey(day)) || []) ids.add(entry.project.id)
    }
    return ids.size
  }, [days, month, projectsByDay, isMonthView])

  return (
    <div>
      <Breadcrumbs
        items={[{ label: t('crumb.dashboard'), to: '/dashboard' }, { label: t('nav.calendar') }]}
      />
      <div className="mb-5 mt-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
            {t('nav.calendar')}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('calendar.subtitle')}</p>
        </div>
        {/* Live tally of what the current range and filters actually surface. */}
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600 dark:bg-white/10 dark:text-gray-300">
            <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
            {visibleCount} {t('nav.tickets')}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-3 py-1 text-xs font-medium text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
            <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
            {visibleProjectCount} {t('projects.title')}
          </span>
        </div>
      </div>

      {/* One toolbar: the ticket filters and the calendar-wide ones read as a set. */}
      <Card className="mb-4 p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="contents [&>div]:mb-0">
            <TicketFilters filters={filters} onChange={setFilters} />
          </div>
          <Select label={t('calendar.showFilter')} value={show} onChange={(e) => setShow(e.target.value)} className="w-40">
            <option value="all">{t('common.all')}</option>
            <option value="tickets">{t('nav.tickets')}</option>
            <option value="projects">{t('projects.title')}</option>
            <option value="todos">{t('nav.todo')}</option>
          </Select>
          <Select
            label={t('calendar.assigneeFilter')}
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
            className="w-48"
          >
            <option value="">{t('common.all')}</option>
            {(agents || []).map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.full_name}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      <Card className="p-0">
        {/* Month navigation */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 p-4 dark:border-white/10">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              disabled={!isMonthView}
              aria-label={t('calendar.prevMonth')}
              className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent dark:text-gray-400 dark:hover:bg-white/10"
            >
              <ChevronRightIcon className="h-5 w-5 rotate-180 rtl:rotate-0" />
            </button>
            <h2 className="min-w-40 text-center text-base font-semibold text-gray-900 dark:text-gray-100">
              {monthLabel}
            </h2>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              disabled={!isMonthView}
              aria-label={t('calendar.nextMonth')}
              className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent dark:text-gray-400 dark:hover:bg-white/10"
            >
              <ChevronRightIcon className="h-5 w-5 rtl:rotate-180" />
            </button>
            {isLoading && <Spinner />}
          </div>
          {/* Segmented control: the options are one choice, so they share a track. */}
          <div className="flex flex-wrap items-center gap-0.5 rounded-xl bg-gray-100 p-1 dark:bg-white/5">
            {RANGES.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  setRange(option)
                  setExpandedDay(null)
                  // A preset is anchored to today, so jump back from any browsed month.
                  if (option !== 'month') setMonth(startOfMonth(new Date()))
                }}
                className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
                  range === option
                    ? 'bg-white text-indigo-600 shadow-soft dark:bg-gray-900 dark:text-indigo-300'
                    : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                {t(`calendar.range.${option}`)}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
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
            {/* Month grid (sm and up) — only the month view is a grid. */}
            <div className={isMonthView ? 'hidden sm:block' : 'hidden'}>
              <div className="grid grid-cols-7 border-b border-gray-100 dark:border-white/10">
                {weekdayNames.map((name) => (
                  <div
                    key={name}
                    className="bg-gray-50/60 px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:bg-white/[0.02] dark:text-gray-500"
                  >
                    {name}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-px bg-gray-100 dark:bg-white/10">
                {days.map((day) => {
                  const key = toKey(day)
                  const tickets = byDay.get(key) || []
                  const dayProjects = projectsByDay.get(key) || []
                  const dayTodos = todosByDay.get(key) || []
                  const inMonth = day.getMonth() === month.getMonth()
                  const isToday = key === todayKey
                  const expanded = expandedDay === key
                  const shown = expanded ? tickets : tickets.slice(0, 3)
                  return (
                    <div
                      key={key}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedDay(key)}
                      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setSelectedDay(key)}
                      className={`relative min-h-28 cursor-pointer p-1.5 transition-colors hover:bg-indigo-50/60 dark:hover:bg-indigo-500/5 ${
                        inMonth ? 'bg-white dark:bg-gray-900/70' : 'bg-gray-50/70 dark:bg-gray-900/30'
                      } ${isToday ? 'ring-1 ring-inset ring-indigo-400/50' : ''}`}
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
                        {tickets.length + dayProjects.length + dayTodos.length > 0 && (
                          <span className="rounded-full bg-gray-100 px-1.5 text-[10px] font-medium text-gray-500 dark:bg-white/10 dark:text-gray-400">
                            {tickets.length + dayProjects.length + dayTodos.length}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col gap-0.5">
                        {dayProjects.map((entry) => (
                          <ProjectChip
                            key={`p-${entry.project.id}-${entry.kind}`}
                            project={entry.project}
                            kind={entry.kind}
                            onOpen={openProject}
                            t={t}
                          />
                        ))}
                        {dayTodos.map((entry) => (
                          <TodoChip
                            key={`t-${entry.todo.id}-${entry.kind}`}
                            todo={entry.todo}
                            kind={entry.kind}
                            onOpen={() => navigate('/todo')}
                            t={t}
                          />
                        ))}
                        {shown.map((entry) => (
                          <TicketChip
                            key={`${entry.ticket.id}-${entry.isClose ? 'closed' : 'start'}`}
                            ticket={entry.ticket}
                            isClose={entry.isClose}
                            hasBothDays={entry.hasBothDays}
                            onOpen={openTicket}
                            t={t}
                          />
                        ))}
                        {tickets.length > 3 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setExpandedDay(expanded ? null : key)
                            }}
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
            <div
              className={`flex flex-col divide-y divide-gray-100 dark:divide-white/10 ${
                isMonthView ? 'sm:hidden' : ''
              }`}
            >
              {days
                .filter((day) => {
                  const key = toKey(day)
                  const hasEntries =
                    byDay.has(key) || projectsByDay.has(key) || todosByDay.has(key)
                  // Month view lists only days with something on them; a preset range
                  // is short enough to show every day, blanks included.
                  if (!isMonthView) return true
                  return day.getMonth() === month.getMonth() && hasEntries
                })
                .map((day) => {
                  const key = toKey(day)
                  return (
                    <div
                      key={key}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedDay(key)}
                      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setSelectedDay(key)}
                      className="flex cursor-pointer gap-3 p-3 transition-colors hover:bg-indigo-50/60 dark:hover:bg-indigo-500/5"
                    >
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
                        {!byDay.has(key) && !projectsByDay.has(key) && (
                          <span className="text-xs text-gray-400 dark:text-gray-600">
                            {t('calendar.dayEmpty')}
                          </span>
                        )}
                        {(todosByDay.get(key) || []).map((entry) => (
                          <TodoChip
                            key={`t-${entry.todo.id}-${entry.kind}`}
                            todo={entry.todo}
                            kind={entry.kind}
                            onOpen={() => navigate('/todo')}
                            t={t}
                          />
                        ))}
                        {(projectsByDay.get(key) || []).map((entry) => (
                          <ProjectChip
                            key={`p-${entry.project.id}-${entry.kind}`}
                            project={entry.project}
                            kind={entry.kind}
                            onOpen={openProject}
                            t={t}
                          />
                        ))}
                        {(byDay.get(key) || []).map((entry) => (
                          <TicketChip
                            key={`${entry.ticket.id}-${entry.isClose ? 'closed' : 'start'}`}
                            ticket={entry.ticket}
                            isClose={entry.isClose}
                            hasBothDays={entry.hasBothDays}
                            onOpen={openTicket}
                            t={t}
                          />
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
          <span className="inline-flex items-center gap-1.5 text-green-700 dark:text-green-400">
            <CheckCircleIcon className="h-3 w-3" />
            {t('calendar.legendClosed')}
          </span>
          <span className="inline-flex items-center gap-1.5 text-violet-700 dark:text-violet-300">
            <BoardIcon className="h-3 w-3" />
            {t('calendar.legendProject')}
          </span>
          <span className="inline-flex items-center gap-1.5 text-amber-700 dark:text-amber-300">
            <CheckCircleIcon className="h-3 w-3" />
            {t('nav.todo')}
          </span>
        </div>
      </Card>

      <Modal open={Boolean(selectedDay)} onClose={() => setSelectedDay(null)} title={selectedLabel}>
        <div className="flex flex-col gap-5">
          {selectedProjects.length > 0 && (
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
                {t('projects.title')}
              </h3>
              <div className="flex flex-col gap-1.5">
                {selectedProjects.map((entry) => (
                  <div
                    key={`dp-${entry.project.id}-${entry.kind}`}
                    className="rounded-lg border border-gray-200/70 p-2 dark:border-white/10"
                  >
                    <ProjectChip
                      project={entry.project}
                      kind={entry.kind}
                      onOpen={openProject}
                      t={t}
                    />
                    {/* One labelled field per line: run together, "Open · 1/3 tasks
                        done · Amman Mart" reads as a single sentence and none of the
                        three values is findable. */}
                    <dl className="mt-2 grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 px-1.5 text-[11px]">
                      <dt className="text-gray-400 dark:text-gray-500">{t('field.status')}</dt>
                      <dd>
                        <span
                          className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                            entry.project.status === 'closed'
                              ? 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300'
                              : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                          }`}
                        >
                          {t(
                            entry.project.status === 'closed'
                              ? 'projects.status.closed'
                              : 'projects.status.open'
                          )}
                        </span>
                      </dd>

                      <dt className="text-gray-400 dark:text-gray-500">{t('projects.progress')}</dt>
                      <dd className="text-gray-700 dark:text-gray-200">
                        <ProgressBar
                          value={entry.project.done_task_count || 0}
                          max={entry.project.task_count || 0}
                          label={`${entry.project.done_task_count || 0}/${entry.project.task_count || 0} ${t('projects.tasksDone')}`}
                        />
                      </dd>

                      <dt className="text-gray-400 dark:text-gray-500">{t('field.customer')}</dt>
                      <dd className="text-gray-700 dark:text-gray-200">
                        {entry.project.customer?.full_name || (
                          <span className="text-gray-400 dark:text-gray-500">
                            {t('projects.noCustomer')}
                          </span>
                        )}
                      </dd>

                      <dt className="text-gray-400 dark:text-gray-500">{t('projects.assignees')}</dt>
                      <dd className="text-gray-700 dark:text-gray-200">
                        {entry.project.assignees?.length ? (
                          entry.project.assignees.map((a) => a.full_name).join(', ')
                        ) : (
                          <span className="text-gray-400 dark:text-gray-500">
                            {t('projects.unassigned')}
                          </span>
                        )}
                      </dd>
                    </dl>
                  </div>
                ))}
              </div>
            </section>
          )}

          {selectedTodos.length > 0 && (
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                {t('nav.todo')}
              </h3>
              <div className="flex flex-col gap-1.5">
                {selectedTodos.map((entry) => (
                  <div
                    key={`dt-${entry.todo.id}-${entry.kind}`}
                    className="rounded-lg border border-gray-200/70 p-2 dark:border-white/10"
                  >
                    <TodoChip
                      todo={entry.todo}
                      kind={entry.kind}
                      onOpen={() => navigate('/todo')}
                      t={t}
                    />
                    <p className="mt-1 flex flex-wrap items-center gap-2 px-1.5 text-[11px] text-gray-500 dark:text-gray-400">
                      <span>{t(`priority.${entry.todo.priority}`)}</span>
                      {entry.todo.duration_minutes != null && (
                        <span>{Math.round(entry.todo.duration_minutes / 60)}h</span>
                      )}
                      {entry.todo.customer && <span>{entry.todo.customer.full_name}</span>}
                      <span className="text-gray-600 dark:text-gray-300">
                        {entry.todo.assignees?.length
                          ? entry.todo.assignees.map((a) => a.full_name).join(', ')
                          : t('projects.unassigned')}
                      </span>
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {selectedTickets.length > 0 && (
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {t('nav.tickets')}
              </h3>
              <div className="flex flex-col gap-1.5">
                {selectedTickets.map((entry) => (
                  <div
                    key={`dt-${entry.ticket.id}-${entry.isClose ? 'closed' : 'start'}`}
                    className="rounded-lg border border-gray-200/70 p-2 dark:border-white/10"
                  >
                    <TicketChip
                      ticket={entry.ticket}
                      isClose={entry.isClose}
                      hasBothDays={entry.hasBothDays}
                      onOpen={openTicket}
                      t={t}
                    />
                    <p className="mt-1 flex flex-wrap items-center gap-2 px-1.5 text-[11px] text-gray-500 dark:text-gray-400">
                      <span className="font-mono">{entry.ticket.reference}</span>
                      <span>{t(`priority.${entry.ticket.priority}`)}</span>
                      <span>{t(`status.${entry.ticket.status}`)}</span>
                      <span className="text-gray-600 dark:text-gray-300">
                        {entry.ticket.assigned_agent_name || t('projects.unassigned')}
                      </span>
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {selectedProjects.length === 0 &&
            selectedTickets.length === 0 &&
            selectedTodos.length === 0 && (
            <p className="py-4 text-center text-sm text-gray-400 dark:text-gray-500">
              {t('calendar.dayEmpty')}
            </p>
          )}
        </div>
      </Modal>
    </div>
  )
}
