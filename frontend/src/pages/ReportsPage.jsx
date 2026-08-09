import { useState } from 'react'
import { Link } from 'react-router-dom'
import Badge from '../components/ui/Badge'
import Breadcrumbs from '../components/ui/Breadcrumbs'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import EmptyState from '../components/ui/EmptyState'
import Pagination from '../components/ui/Pagination'
import SearchBar from '../components/ui/SearchBar'
import SectionHeader from '../components/ui/SectionHeader'
import Spinner from '../components/ui/Spinner'
import StatTile from '../components/ui/StatTile'
import Table from '../components/ui/Table'
import TrendChart from '../components/reports/TrendChart'
import {
  CheckCircleIcon,
  ClockIcon,
  FolderOpenIcon,
  InboxIcon,
  ReportsIcon,
  BadgeIcon,
  BoardIcon,
  StarIcon,
  UserIcon,
} from '../components/ui/icons'
import { exportReport } from '../api/reports'
import {
  useAgentPerformance,
  useCustomerActivity,
  useLicenseReport,
  useReportsSummary,
} from '../hooks/useReports'
import { sortRows, useTableSort } from '../utils/tableSort'
import { usePagedRows } from '../utils/tablePage'
import { useI18n } from '../i18n/useI18n'

const PERF_COLUMNS = [
  { labelKey: 'reports.col.agent', sortKey: 'agent_name', value: (r) => r.agent_name },
  { labelKey: 'reports.col.assigned', sortKey: 'assigned_count', value: (r) => r.assigned_count },
  { labelKey: 'status.closed', sortKey: 'closed_count', value: (r) => r.closed_count },
  { labelKey: 'reports.col.rating', sortKey: 'avg_rating', value: (r) => r.avg_rating ?? -1 },
  { labelKey: 'reports.col.avgResolution', sortKey: 'avg', value: (r) => r.avg_resolution_hours ?? -1 },
]

const CUSTOMER_COLUMNS = [
  { labelKey: 'reports.col.customer', sortKey: 'customer_name', value: (r) => r.customer_name },
  { labelKey: 'customers.softwareType', sortKey: 'software_type', value: (r) => r.software_type },
  { labelKey: 'reports.col.tickets', sortKey: 'ticket_count', value: (r) => r.ticket_count },
  { labelKey: 'status.open', sortKey: 'open_count', value: (r) => r.open_count },
  { labelKey: 'status.closed', sortKey: 'closed_count', value: (r) => r.closed_count },
  { labelKey: 'reports.col.rating', sortKey: 'avg_rating', value: (r) => r.avg_rating ?? -1 },
  {
    labelKey: 'reports.col.avgResolution',
    sortKey: 'avg_resolution',
    value: (r) => r.avg_resolution_hours ?? -1,
  },
]

const LICENSE_COLUMNS = [
  { labelKey: 'reports.col.customer', sortKey: 'customer_name', value: (r) => r.customer_name },
  { labelKey: 'customers.licenseName', sortKey: 'license_name', value: (r) => r.license_name },
  { labelKey: 'customers.startDate', sortKey: 'start_date', value: (r) => r.start_date },
  { labelKey: 'customers.endDate', sortKey: 'end_date', value: (r) => r.end_date },
  { labelKey: 'reports.col.daysLeft', sortKey: 'days_left', value: (r) => r.days_left },
]

const LICENSE_STATE_COLOR = { expired: 'red', expiring: 'amber', active: 'green' }

function toISODate(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

// `days` counts back from today, inclusive. null = all time (no bounds sent).
const PRESETS = [
  { id: '7', days: 7, labelKey: 'reports.range.last7' },
  { id: '30', days: 30, labelKey: 'reports.range.last30' },
  { id: '90', days: 90, labelKey: 'reports.range.last90' },
  { id: 'all', days: null, labelKey: 'reports.range.allTime' },
]

function presetRange(days) {
  if (days == null) return { dateFrom: '', dateTo: '' }
  const to = new Date()
  const from = new Date()
  from.setDate(to.getDate() - (days - 1))
  return { dateFrom: toISODate(from), dateTo: toISODate(to) }
}

// "36.75" hours means nothing at a glance; "1d 13h" does.
function formatHours(value) {
  if (value == null) return '—'
  if (value < 1) return `${Math.round(value * 60)}m`
  if (value < 24) return `${Math.round(value * 10) / 10}h`
  const days = Math.floor(value / 24)
  const rest = Math.round(value - days * 24)
  return rest ? `${days}d ${rest}h` : `${days}d`
}

// Single-series magnitude bars: one hue (indigo), value shown as a direct label,
// track recedes into the surface. No legend needed for a single series.
function BreakdownCard({ icon, title, rows, labelKey, format, emptyLabel }) {
  const { t } = useI18n()
  const max = Math.max(1, ...(rows || []).map((r) => r.count))
  return (
    <Card>
      <SectionHeader icon={icon} title={title} />
      {rows?.length ? (
        <ul className="flex flex-col gap-3">
          {rows.map((row) => {
            const raw = row[labelKey]
            const label = raw == null ? emptyLabel : format ? format(raw) : raw
            return (
              <li key={String(raw)} className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between text-sm">
                  <span className="truncate text-gray-600 dark:text-gray-300">{label}</span>
                  <span className="ms-2 font-medium tabular-nums text-gray-900 dark:text-gray-100">
                    {row.count}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
                  <div
                    className="h-full rounded-full bg-indigo-500 transition-[width] duration-500 ease-out"
                    style={{ width: `${(row.count / max) * 100}%` }}
                  />
                </div>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="text-sm text-gray-400 dark:text-gray-500">{t('reports.noData')}</p>
      )}
    </Card>
  )
}

// Period-over-period change. A raw count says nothing about direction; the delta
// against the immediately preceding window of equal length does.
function Delta({ current, previous, invert = false, format }) {
  const { t } = useI18n()
  if (previous == null || current == null) return null
  if (previous === 0 && current === 0) return null

  const diff = current - previous
  if (Math.abs(diff) < 0.005) {
    return (
      <span className="text-gray-400 dark:text-gray-500">{t('reports.delta.flat')}</span>
    )
  }
  // For "lower is better" measures (resolution time), a rise is the bad direction.
  const good = invert ? diff < 0 : diff > 0
  const pct = previous === 0 ? null : Math.round((diff / previous) * 100)
  const shown = format ? format(Math.abs(diff)) : Math.abs(diff)

  return (
    <span
      className={
        good
          ? 'text-emerald-600 dark:text-emerald-400'
          : 'text-red-600 dark:text-red-400'
      }
    >
      {diff > 0 ? '▲' : '▼'} {shown}
      {pct != null ? ` (${Math.abs(pct)}%)` : ''}
    </span>
  )
}

// A compact figure inside the delivery card: value, label, and an optional accent
// when the number is one that wants attention (overdue, unassigned).
function DeliveryFigure({ label, value, tone = 'default' }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span
        className={`text-2xl font-semibold tabular-nums ${
          tone === 'warn' && value > 0
            ? 'text-red-600 dark:text-red-400'
            : 'text-gray-900 dark:text-gray-100'
        }`}
      >
        {value}
      </span>
      <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
    </div>
  )
}

export default function ReportsPage() {
  const { t } = useI18n()
  const [preset, setPreset] = useState('30')
  const [range, setRange] = useState(() => presetRange(30))
  const [search, setSearch] = useState('')
  const [exporting, setExporting] = useState(false)
  const { data: summary, isLoading, isFetching } = useReportsSummary(range)
  const { data: agentPerformance } = useAgentPerformance(range)
  const { data: customerActivity } = useCustomerActivity(range)
  const { data: licenseReport } = useLicenseReport()
  const { sortBy, sortDir, onSort } = useTableSort('agent_name')
  const customerSort = useTableSort('ticket_count', 'desc')
  const licenseSort = useTableSort('end_date')

  const perfColumns = PERF_COLUMNS.map((c) => ({ ...c, label: t(c.labelKey) }))
  const customerColumns = CUSTOMER_COLUMNS.map((c) => ({ ...c, label: t(c.labelKey) }))
  // The status column is derived, not a field, so it is not sortable.
  const licenseColumns = [
    ...LICENSE_COLUMNS.map((c) => ({ ...c, label: t(c.labelKey) })),
    t('field.status'),
  ]

  // The search scopes the three row tables only. The tiles, chart and breakdowns above are
  // server-side aggregates over the whole date range, so filtering them here would show a
  // total that disagrees with the rows it is supposedly summarising.
  const q = search.trim().toLowerCase()
  const searching = q.length > 0
  const matches = (...fields) =>
    !searching || fields.some((f) => String(f ?? '').toLowerCase().includes(q))

  // Paged here, above the loading early-return, so the hook order stays stable.
  const perfRows = sortRows(
    (agentPerformance || []).filter((r) => matches(r.agent_name)),
    PERF_COLUMNS, sortBy, sortDir
  )
  const { pageRows: perfPageRows, ...perfPager } = usePagedRows(perfRows)
  const customerRows = sortRows(
    (customerActivity || []).filter((r) => matches(r.customer_name, r.software_type)),
    CUSTOMER_COLUMNS, customerSort.sortBy, customerSort.sortDir
  )
  const { pageRows: customerPageRows, ...customerPager } = usePagedRows(customerRows)
  const licenseRows = sortRows(
    (licenseReport?.results || []).filter((r) => matches(r.customer_name, r.license_name)),
    LICENSE_COLUMNS, licenseSort.sortBy, licenseSort.sortDir
  )
  const { pageRows: licensePageRows, ...licensePager } = usePagedRows(licenseRows)

  function applyPreset(option) {
    setPreset(option.id)
    setRange(presetRange(option.days))
  }

  function setCustom(key, value) {
    setPreset('custom')
    setRange((current) => ({ ...current, [key]: value }))
  }

  async function handleExport() {
    setExporting(true)
    try {
      const blob = await exportReport(range)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `report-${range.dateFrom || 'all'}-${range.dateTo || 'all'}.xlsx`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  // First load only — a range change keeps the previous data on screen and dims it.
  if (isLoading && !summary) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    )
  }

  const previous = summary?.previous
  const delivery = summary?.delivery
  const byStatus = summary?.by_status || []
  const findStatus = (s) => byStatus.find((r) => r.status === s)?.count ?? 0
  const total = summary?.total ?? 0

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Breadcrumbs
            items={[
              { label: t('crumb.dashboard'), to: '/dashboard' },
              { label: t('reports.breadcrumb') },
            ]}
          />
          <h1 className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">
            {t('reports.title')}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('reports.description')}</p>
        </div>
        <Button variant="secondary" onClick={handleExport} disabled={exporting}>
          {exporting ? t('common.loading') : t('reports.export')}
        </Button>
      </div>

      {/* One filter row, above everything it scopes. The date range drives the queries;
          the search filters the loaded table rows in the browser. */}
      <div className="flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-gray-200/70 bg-white p-4 shadow-soft dark:border-white/10 dark:bg-gray-900/70">
        <div className="flex flex-wrap items-center gap-1">
          {PRESETS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => applyPreset(option)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                preset === option.id
                  ? 'bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-200/70 dark:bg-indigo-500/15 dark:text-indigo-300 dark:ring-indigo-400/20'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/10'
              }`}
            >
              {t(option.labelKey)}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs text-gray-500 dark:text-gray-400">
            {t('dashboard.from')}
            <input
              type="date"
              value={range.dateFrom}
              max={range.dateTo || undefined}
              onChange={(e) => setCustom('dateFrom', e.target.value)}
              className="rounded-xl border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 shadow-sm transition focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/15 dark:border-white/10 dark:bg-white/5 dark:text-gray-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-gray-500 dark:text-gray-400">
            {t('dashboard.to')}
            <input
              type="date"
              value={range.dateTo}
              min={range.dateFrom || undefined}
              onChange={(e) => setCustom('dateTo', e.target.value)}
              className="rounded-xl border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 shadow-sm transition focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/15 dark:border-white/10 dark:bg-white/5 dark:text-gray-100"
            />
          </label>
          {preset === 'custom' && (
            <Button variant="secondary" onClick={() => applyPreset(PRESETS[1])}>
              {t('reports.range.reset')}
            </Button>
          )}
        </div>
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder={t('reports.searchPlaceholder')}
        />
      </div>

      {/* Refetching holds the previous render at reduced opacity — no skeleton, no jump. */}
      <div className={`flex flex-col gap-6 transition-opacity ${isFetching ? 'opacity-60' : ''}`}>
        {total === 0 ? (
          <EmptyState title={t('reports.emptyRange')} description={t('reports.emptyRangeHint')} />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
              <StatTile
                label={t('reports.stat.totalTickets')}
                value={total}
                icon={InboxIcon}
                color="indigo"
                hint={
                  previous ? (
                    <Delta current={total} previous={previous.total} />
                  ) : undefined
                }
              />
              <StatTile label={t('status.open')} value={findStatus('open')} icon={FolderOpenIcon} color="blue" />
              <StatTile
                label={t('status.closed')}
                value={findStatus('closed')}
                icon={CheckCircleIcon}
                color="green"
                hint={
                  previous ? (
                    <Delta
                      current={summary?.resolved_count}
                      previous={previous.resolved_count}
                    />
                  ) : undefined
                }
              />
              <StatTile
                label={t('reports.stat.avgResolution')}
                value={formatHours(summary?.avg_resolution_hours)}
                icon={ClockIcon}
                color="amber"
                hint={
                  previous ? (
                    <Delta
                      current={summary?.avg_resolution_hours}
                      previous={previous.avg_resolution_hours}
                      // Faster is better, so a fall is the good direction.
                      invert
                      format={formatHours}
                    />
                  ) : undefined
                }
              />
              <StatTile
                label={t('reports.stat.satisfaction')}
                value={summary?.avg_rating != null ? `${summary.avg_rating} ★` : '—'}
                hint={
                  previous && summary?.avg_rating != null ? (
                    <Delta
                      current={summary?.avg_rating}
                      previous={previous.avg_rating}
                      format={(v) => v.toFixed(2)}
                    />
                  ) : summary?.rating_count ? (
                    `${summary.rating_count} ${t('reports.stat.ratings')}`
                  ) : undefined
                }
                icon={StarIcon}
                color="purple"
              />
            </div>
            {previous && (
              <p className="-mt-3 text-xs text-gray-400 dark:text-gray-500">
                {t('reports.delta.versus')} {previous.date_from} → {previous.date_to}
              </p>
            )}

            <Card>
              <SectionHeader
                icon={ReportsIcon}
                title={t('reports.trend.title')}
                description={t('reports.trend.description')}
              />
              <TrendChart trend={summary?.trend} />
            </Card>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <BreakdownCard
                icon={ReportsIcon}
                title={t('reports.breakdown.byStatus')}
                rows={summary?.by_status}
                labelKey="status"
                format={(s) => t(`status.${s}`)}
              />
              <BreakdownCard
                icon={BadgeIcon}
                title={t('reports.breakdown.byPriority')}
                rows={summary?.by_priority}
                labelKey="priority"
                format={(p) => t(`priority.${p}`)}
              />
              <BreakdownCard
                icon={FolderOpenIcon}
                title={t('reports.breakdown.byCategory')}
                rows={summary?.by_category}
                labelKey="category_name"
                emptyLabel={t('kb.uncategorized')}
              />
              <BreakdownCard
                icon={StarIcon}
                title={t('reports.breakdown.byRating')}
                rows={summary?.by_rating}
                labelKey="rating"
                format={(r) => `${r} ★`}
              />
            </div>

            {/* Tickets are only half the work: projects and the internal list
                carry the rest, and none of it was reported before. */}
            {delivery && (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Card>
                  <SectionHeader
                    icon={BoardIcon}
                    title={t('reports.delivery.title')}
                    description={t('reports.delivery.description')}
                  />
                  <div className="grid grid-cols-3 gap-4">
                    <DeliveryFigure
                      label={t('reports.delivery.projects')}
                      value={delivery.projects_total}
                    />
                    <DeliveryFigure
                      label={t('projects.status.open')}
                      value={delivery.projects_open}
                    />
                    <DeliveryFigure
                      label={t('reports.delivery.unassigned')}
                      value={delivery.projects_unassigned}
                      tone="warn"
                    />
                    <DeliveryFigure
                      label={t('reports.delivery.tasks')}
                      value={delivery.tasks_total}
                    />
                    <DeliveryFigure
                      label={t('projects.column.done')}
                      value={delivery.tasks_done}
                    />
                    <DeliveryFigure
                      label={t('projects.overdue')}
                      value={delivery.tasks_overdue}
                      tone="warn"
                    />
                    <DeliveryFigure
                      label={t('nav.todo')}
                      value={delivery.todos_total}
                    />
                    <DeliveryFigure
                      label={t('todo.filterDone')}
                      value={delivery.todos_done}
                    />
                    <DeliveryFigure
                      label={t('projects.overdue')}
                      value={delivery.todos_overdue}
                      tone="warn"
                    />
                  </div>
                </Card>

                <BreakdownCard
                  icon={UserIcon}
                  title={t('reports.delivery.openByPerson')}
                  rows={delivery.open_tasks_by_person}
                  labelKey="person"
                  emptyLabel={t('projects.unassigned')}
                />
              </div>
            )}

            <div>
              <div className="mb-3 flex items-center gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
                  <BadgeIcon className="h-5 w-5" />
                </span>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {t('reports.agentPerformance')}
                </h2>
              </div>
              {perfRows.length === 0 ? (
                <EmptyState title={searching ? t('reports.noMatches') : t('reports.noData')} />
              ) : (
                <>
              <Table columns={perfColumns} sortBy={sortBy} sortDir={sortDir} onSort={onSort}>
                {perfPageRows.map((row) => (
                  <tr key={row.agent_id}>
                    <td className="px-4 py-2 font-medium text-gray-900 dark:text-gray-100">
                      {row.agent_name}
                    </td>
                    <td className="px-4 py-2 text-gray-600 dark:text-gray-300">{row.assigned_count}</td>
                    <td className="px-4 py-2 text-gray-600 dark:text-gray-300">{row.closed_count}</td>
                    <td className="px-4 py-2 text-gray-600 dark:text-gray-300">
                      {row.avg_rating != null ? `${row.avg_rating} ★` : '—'}
                    </td>
                    <td className="px-4 py-2 text-gray-600 dark:text-gray-300">
                      {formatHours(row.avg_resolution_hours)}
                    </td>
                  </tr>
                ))}
              </Table>
              <Pagination {...perfPager} onPageChange={perfPager.setPage} />
                </>
              )}
            </div>

            <div>
              <SectionHeader
                icon={UserIcon}
                title={t('reports.customerActivity')}
                description={t('reports.customerActivityHint')}
              />
              {customerRows.length ? (
                <>
                  <Table
                    columns={customerColumns}
                    sortBy={customerSort.sortBy}
                    sortDir={customerSort.sortDir}
                    onSort={customerSort.onSort}
                  >
                    {customerPageRows.map((row) => (
                      <tr key={row.customer_id}>
                        <td className="px-4 py-2 font-medium text-gray-900 dark:text-gray-100">
                          <Link
                            to={`/customers/${row.customer_id}`}
                            className="text-indigo-600 hover:underline dark:text-indigo-400"
                          >
                            {row.customer_name}
                          </Link>
                        </td>
                        <td className="px-4 py-2 text-gray-600 dark:text-gray-300">
                          {row.software_type || '—'}
                        </td>
                        <td className="px-4 py-2 text-gray-600 dark:text-gray-300">
                          {row.ticket_count}
                        </td>
                        <td className="px-4 py-2 text-gray-600 dark:text-gray-300">
                          {row.open_count}
                        </td>
                        <td className="px-4 py-2 text-gray-600 dark:text-gray-300">
                          {row.closed_count}
                        </td>
                        <td className="px-4 py-2 text-gray-600 dark:text-gray-300">
                          {row.avg_rating != null ? `${row.avg_rating} ★` : '—'}
                        </td>
                        <td className="px-4 py-2 text-gray-600 dark:text-gray-300">
                          {formatHours(row.avg_resolution_hours)}
                        </td>
                      </tr>
                    ))}
                  </Table>
                  <Pagination {...customerPager} onPageChange={customerPager.setPage} />
                </>
              ) : (
                <EmptyState title={searching ? t('reports.noMatches') : t('reports.noData')} />
              )}
            </div>
          </>
        )}
      </div>

      {/* Licenses are a snapshot of today, so this section sits outside the range-scoped
          block above: it is not dimmed on a range change, and an empty ticket range does
          not hide it. */}
      <div>
        <SectionHeader
          icon={BadgeIcon}
          title={t('reports.licenses')}
          description={t('reports.licensesHint')}
        />
        {licenseRows.length ? (
          <>
            <div className="mb-4 grid grid-cols-3 gap-4">
              <StatTile
                label={t('reports.licenseExpired')}
                value={licenseReport?.expired_count ?? 0}
                icon={ClockIcon}
                color="red"
              />
              <StatTile
                label={t('reports.licenseExpiring')}
                value={licenseReport?.expiring_count ?? 0}
                icon={ClockIcon}
                color="amber"
              />
              <StatTile
                label={t('reports.licenseActive')}
                value={licenseReport?.active_count ?? 0}
                icon={CheckCircleIcon}
                color="green"
              />
            </div>
            <Table
              columns={licenseColumns}
              sortBy={licenseSort.sortBy}
              sortDir={licenseSort.sortDir}
              onSort={licenseSort.onSort}
            >
              {licensePageRows.map((row) => (
                <tr key={row.license_id}>
                  <td className="px-4 py-2 font-medium text-gray-900 dark:text-gray-100">
                    <Link
                      to={`/customers/${row.customer_id}`}
                      className="text-indigo-600 hover:underline dark:text-indigo-400"
                    >
                      {row.customer_name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-300">
                    {row.license_name || '—'}
                  </td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-300">
                    {row.start_date || '—'}
                  </td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-300">{row.end_date}</td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-300">{row.days_left}</td>
                  <td className="px-4 py-2">
                    <Badge color={LICENSE_STATE_COLOR[row.state]}>
                      {t(`reports.licenseState.${row.state}`)}
                    </Badge>
                  </td>
                </tr>
              ))}
            </Table>
            <Pagination {...licensePager} onPageChange={licensePager.setPage} />
          </>
        ) : (
          <EmptyState title={searching ? t('reports.noMatches') : t('customers.noLicenses')} />
        )}
      </div>
    </div>
  )
}
