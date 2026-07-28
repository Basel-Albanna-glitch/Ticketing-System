import { useState } from 'react'
import { Link } from 'react-router-dom'
import Breadcrumbs from '../components/ui/Breadcrumbs'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import Pagination from '../components/ui/Pagination'
import Spinner from '../components/ui/Spinner'
import { PlusIcon } from '../components/ui/icons'
import TicketFilters from '../components/tickets/TicketFilters'
import TicketTable from '../components/tickets/TicketTable'
import { useTickets } from '../hooks/useTickets'
import { exportTickets } from '../api/tickets'
import { useTableSort } from '../utils/tableSort'
import { useI18n } from '../i18n/useI18n'

export default function TicketsListPage() {
  const { t } = useI18n()
  const [filters, setFilters] = useState({ page: 1 })
  const [exporting, setExporting] = useState(false)
  const { sortBy, sortDir, onSort } = useTableSort('created_at', 'desc')
  const ordering = `${sortDir === 'desc' ? '-' : ''}${sortBy}`
  const { data, isLoading, isError } = useTickets({ ...filters, ordering })

  async function handleExport() {
    setExporting(true)
    try {
      // Export everything matching the current filters (not just the visible page).
      const rest = { ...filters }
      delete rest.page
      const blob = await exportTickets({ ...rest, ordering })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'tickets.xlsx'
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  function handleSort(key) {
    onSort(key)
    setFilters((f) => ({ ...f, page: 1 }))
  }

  return (
    <div>
      <Breadcrumbs
        items={[{ label: t('crumb.dashboard'), to: '/dashboard' }, { label: t('nav.tickets') }]}
      />
      <div className="mb-4 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{t('nav.tickets')}</h1>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="secondary"
            onClick={handleExport}
            loading={exporting}
            disabled={!data || data.count === 0}
            className="whitespace-nowrap"
          >
            {t('tickets.exportExcel')}
          </Button>
          <Link to="/tickets/new">
            <Button className="whitespace-nowrap">
              <PlusIcon className="h-4 w-4" />
              {t('tickets.create')}
            </Button>
          </Link>
        </div>
      </div>

      <TicketFilters filters={filters} onChange={setFilters} />

      {isLoading && (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      )}

      {isError && (
        <p className="text-sm text-red-600 dark:text-red-400">{t('tickets.loadError')}</p>
      )}

      {data && data.results.length === 0 && (
        <EmptyState title={t('tickets.emptyTitle')} description={t('tickets.emptyDescription')} />
      )}

      {data && data.results.length > 0 && (
        <>
          <TicketTable tickets={data.results} sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
          <Pagination
            page={filters.page}
            count={data.count}
            hasNext={!!data.next}
            hasPrevious={!!data.previous}
            onPageChange={(page) => setFilters({ ...filters, page })}
          />
        </>
      )}
    </div>
  )
}
