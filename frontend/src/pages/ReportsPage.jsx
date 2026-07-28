import { useState } from 'react'
import Breadcrumbs from '../components/ui/Breadcrumbs'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import EmptyState from '../components/ui/EmptyState'
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
  StarIcon,
} from '../components/ui/icons'
import { useAgentPerformance, useReportsSummary } from '../hooks/useReports'
import { sortRows, useTableSort } from '../utils/tableSort'
import { useI18n } from '../i18n/useI18n'

const PERF_COLUMNS = [
  { labelKey: 'reports.col.agent', sortKey: 'agent_name', value: (r) => r.agent_name },
  { labelKey: 'reports.col.assigned', sortKey: 'assigned_count', value: (r) => r.assigned_count },
  { labelKey: 'status.closed', sortKey: 'closed_count', value: (r) => r.closed_count },
  { labelKey: 'reports.col.rating', sortKey: 'avg_rating', value: (r) => r.avg_rating ?? -1 },
  { labelKey: 'reports.col.avgResolution', sortKey: 'avg', value: (r) => r.avg_resolution_hours ?? -1 },
]

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

export default function ReportsPage() {
  const { t } = useI18n()
  const [preset, setPreset] = useState('30')
  const [range, setRange] = useState(() => presetRange(30))
  const { data: summary, isLoading, isFetching } = useReportsSummary(range)
  const { data: agentPerformance } = useAgentPerformance(range)
  const { sortBy, sortDir, onSort } = useTableSort('agent_name')

  const perfColumns = PERF_COLUMNS.map((c) => ({ ...c, label: t(c.labelKey) }))

  function applyPreset(option) {
    setPreset(option.id)
    setRange(presetRange(option.days))
  }

  function setCustom(key, value) {
    setPreset('custom')
    setRange((current) => ({ ...current, [key]: value }))
  }

  // First load only — a range change keeps the previous data on screen and dims it.
  if (isLoading && !summary) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    )
  }

  const byStatus = summary?.by_status || []
  const findStatus = (s) => byStatus.find((r) => r.status === s)?.count ?? 0
  const total = summary?.total ?? 0

  return (
    <div className="flex flex-col gap-6">
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

      {/* One filter row, above everything it scopes. */}
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
      </div>

      {/* Refetching holds the previous render at reduced opacity — no skeleton, no jump. */}
      <div className={`flex flex-col gap-6 transition-opacity ${isFetching ? 'opacity-60' : ''}`}>
        {total === 0 ? (
          <EmptyState title={t('reports.emptyRange')} description={t('reports.emptyRangeHint')} />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
              <StatTile label={t('reports.stat.totalTickets')} value={total} icon={InboxIcon} color="indigo" />
              <StatTile label={t('status.open')} value={findStatus('open')} icon={FolderOpenIcon} color="blue" />
              <StatTile label={t('status.closed')} value={findStatus('closed')} icon={CheckCircleIcon} color="green" />
              <StatTile
                label={t('reports.stat.avgResolution')}
                value={formatHours(summary?.avg_resolution_hours)}
                icon={ClockIcon}
                color="amber"
              />
              <StatTile
                label={t('reports.stat.satisfaction')}
                value={summary?.avg_rating != null ? `${summary.avg_rating} ★` : '—'}
                hint={
                  summary?.rating_count
                    ? `${summary.rating_count} ${t('reports.stat.ratings')}`
                    : undefined
                }
                icon={StarIcon}
                color="purple"
              />
            </div>

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

            <div>
              <div className="mb-3 flex items-center gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
                  <BadgeIcon className="h-5 w-5" />
                </span>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {t('reports.agentPerformance')}
                </h2>
              </div>
              <Table columns={perfColumns} sortBy={sortBy} sortDir={sortDir} onSort={onSort}>
                {sortRows(agentPerformance || [], PERF_COLUMNS, sortBy, sortDir).map((row) => (
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
            </div>
          </>
        )}
      </div>
    </div>
  )
}
