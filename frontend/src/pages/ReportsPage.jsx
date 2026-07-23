import Breadcrumbs from '../components/ui/Breadcrumbs'
import Card from '../components/ui/Card'
import SectionHeader from '../components/ui/SectionHeader'
import Spinner from '../components/ui/Spinner'
import StatTile from '../components/ui/StatTile'
import Table from '../components/ui/Table'
import {
  CheckCircleIcon,
  ClockIcon,
  FolderOpenIcon,
  InboxIcon,
  ReportsIcon,
  BadgeIcon,
} from '../components/ui/icons'
import { useAgentPerformance, useReportsSummary } from '../hooks/useReports'
import { sortRows, useTableSort } from '../utils/tableSort'
import { useI18n } from '../i18n/useI18n'

const PERF_COLUMNS = [
  { labelKey: 'reports.col.agent', sortKey: 'agent_name', value: (r) => r.agent_name },
  { labelKey: 'reports.col.assigned', sortKey: 'assigned_count', value: (r) => r.assigned_count },
  { labelKey: 'status.resolved', sortKey: 'resolved_count', value: (r) => r.resolved_count },
  { labelKey: 'reports.stat.avgResolution', sortKey: 'avg', value: (r) => r.avg_resolution_hours ?? -1 },
]

// Single-series magnitude bars: one hue (indigo), value shown as a direct label,
// track recedes into the surface. No legend needed for a single series.
function BreakdownCard({ icon, title, rows, labelKey, format }) {
  const { t } = useI18n()
  const max = Math.max(1, ...(rows || []).map((r) => r.count))
  return (
    <Card>
      <SectionHeader icon={icon} title={title} />
      {rows?.length ? (
        <ul className="flex flex-col gap-3">
          {rows.map((row) => {
            const label = format ? format(row[labelKey]) : row[labelKey]
            return (
              <li key={row[labelKey]} className="flex flex-col gap-1">
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
  const { data: summary, isLoading: isLoadingSummary } = useReportsSummary()
  const { data: agentPerformance, isLoading: isLoadingAgents } = useAgentPerformance()
  const { sortBy, sortDir, onSort } = useTableSort('agent_name')

  const perfColumns = PERF_COLUMNS.map((c) => ({ ...c, label: t(c.labelKey) }))

  if (isLoadingSummary || isLoadingAgents) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    )
  }

  const byStatus = summary?.by_status || []
  const total = byStatus.reduce((sum, r) => sum + r.count, 0)
  const findStatus = (s) => byStatus.find((r) => r.status === s)?.count ?? 0

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
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {t('reports.description')}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label={t('reports.stat.totalTickets')} value={total} icon={InboxIcon} color="indigo" />
        <StatTile label={t('status.open')} value={findStatus('open')} icon={FolderOpenIcon} color="blue" />
        <StatTile label={t('status.closed')} value={findStatus('closed')} icon={CheckCircleIcon} color="green" />
        <StatTile
          label={t('reports.stat.avgResolution')}
          value={summary?.avg_resolution_hours ?? '—'}
          icon={ClockIcon}
          color="amber"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
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
          format={(p) => (p ? t(`priority.${p}`) : p)}
        />
        <BreakdownCard
          icon={FolderOpenIcon}
          title={t('reports.breakdown.byCategory')}
          rows={summary?.by_category}
          labelKey="category_name"
        />
      </div>

      <div>
        <div className="mb-3 flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
            <BadgeIcon className="h-5 w-5" />
          </span>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t('reports.agentPerformance')}</h2>
        </div>
        <Table columns={perfColumns} sortBy={sortBy} sortDir={sortDir} onSort={onSort}>
          {sortRows(agentPerformance || [], PERF_COLUMNS, sortBy, sortDir).map((row) => (
            <tr key={row.agent_id}>
              <td className="px-4 py-2 font-medium text-gray-900 dark:text-gray-100">{row.agent_name}</td>
              <td className="px-4 py-2 text-gray-600 dark:text-gray-300">{row.assigned_count}</td>
              <td className="px-4 py-2 text-gray-600 dark:text-gray-300">{row.resolved_count}</td>
              <td className="px-4 py-2 text-gray-600 dark:text-gray-300">
                {row.avg_resolution_hours ?? '—'}
              </td>
            </tr>
          ))}
        </Table>
      </div>
    </div>
  )
}
