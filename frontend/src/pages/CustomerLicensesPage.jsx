import { useState } from 'react'
import { Link } from 'react-router-dom'
import Avatar from '../components/ui/Avatar'
import Breadcrumbs from '../components/ui/Breadcrumbs'
import EmptyState from '../components/ui/EmptyState'
import Pagination from '../components/ui/Pagination'
import SearchBar from '../components/ui/SearchBar'
import Select from '../components/ui/Select'
import Spinner from '../components/ui/Spinner'
import Table from '../components/ui/Table'
import LicenseStatusBadge from '../components/customers/LicenseStatusBadge'
import { useI18n } from '../i18n/useI18n'
import { useCustomers } from '../hooks/useCustomers'
import { daysUntil, licenseStatus } from '../utils/licenses'
import { sortRows, useTableSort } from '../utils/tableSort'
import { usePagedRows } from '../utils/tablePage'

// The status column is derived from the end date, so it isn't sortable on its own — Days
// left sorts the same way.
const COLUMNS = [
  { label: 'field.customer', sortKey: 'customer', value: (r) => r.customer.full_name },
  { label: 'customers.licenseName', sortKey: 'name', value: (r) => r.name || null },
  { label: 'customers.startDate', sortKey: 'start_date', value: (r) => r.start_date || null },
  { label: 'customers.endDate', sortKey: 'end_date', value: (r) => r.end_date || null },
  { label: 'reports.col.daysLeft', sortKey: 'days_left', value: (r) => daysUntil(r.end_date) },
  'field.status',
]

// The badge splits the final week out in orange; the filter folds it back into a single
// "expiring" bucket — the same 30-day window the Reports page counts. A licence ending
// today is still valid today, so it counts as expiring rather than expired.
function licenseGroup(endDate) {
  const status = licenseStatus(endDate)
  if (!status) return 'none'
  if (status.state === 'expired') return 'expired'
  if (status.state === 'active') return 'active'
  return 'expiring'
}

export default function CustomerLicensesPage() {
  const { t } = useI18n()
  // The customer list already carries each customer's licences, so this table needs no
  // endpoint of its own and stays in step with every edit made through the customer form.
  const { data: customers, isLoading } = useCustomers()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  // Soonest end date first: what needs renewing is what this page is opened for.
  const { sortBy, sortDir, onSort } = useTableSort('end_date')

  const columns = COLUMNS.map((col) =>
    typeof col === 'string' ? t(col) : { ...col, label: t(col.label) }
  )

  const q = search.trim().toLowerCase()
  const licenses = (customers || []).flatMap((customer) =>
    (customer.licenses || []).map((license) => ({ ...license, customer }))
  )
  const filtered = licenses.filter((license) => {
    const matchesSearch =
      !q ||
      license.customer.full_name.toLowerCase().includes(q) ||
      license.customer.username.toLowerCase().includes(q) ||
      (license.name || '').toLowerCase().includes(q)
    const matchesStatus = statusFilter === 'all' || licenseGroup(license.end_date) === statusFilter
    return matchesSearch && matchesStatus
  })
  const rows = sortRows(filtered, COLUMNS, sortBy, sortDir)
  const { pageRows, ...pager } = usePagedRows(rows)

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: t('crumb.dashboard'), to: '/dashboard' },
          { label: t('customers.title'), to: '/customers' },
          { label: t('customers.licenses') },
        ]}
      />
      <div className="mb-6 mt-2 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            {t('customers.licenses')}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-300">
            {t('customers.licensesSubtitle')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <SearchBar value={search} onChange={setSearch} placeholder={t('customers.searchLicenses')} />
          <Select
            aria-label={t('field.status')}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-52"
          >
            <option value="all">{t('common.all')}</option>
            <option value="expired">{t('customers.licenseExpired')}</option>
            <option value="expiring">{t('customers.licenseExpiringSoon')}</option>
            <option value="active">{t('customers.licenseActive')}</option>
            <option value="none">{t('customers.licenseNoEndDate')}</option>
          </Select>
        </div>
      </div>
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState title={t('customers.noLicenses')} />
      ) : (
        <>
          <Table columns={columns} sortBy={sortBy} sortDir={sortDir} onSort={onSort}>
            {pageRows.map((license) => {
              const days = daysUntil(license.end_date)
              return (
                <tr key={license.id}>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={license.customer.full_name} src={license.customer.avatar} />
                      <Link
                        to={`/customers/${license.customer.id}`}
                        className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                      >
                        {license.customer.full_name}
                      </Link>
                    </div>
                  </td>
                  <td className="px-4 py-2 font-medium text-gray-900 dark:text-gray-100">
                    {license.name || '—'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-gray-600 dark:text-gray-300">
                    {license.start_date || '—'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-gray-600 dark:text-gray-300">
                    {license.end_date || '—'}
                  </td>
                  <td className="px-4 py-2 tabular-nums text-gray-600 dark:text-gray-300">
                    {days ?? '—'}
                  </td>
                  <td className="px-4 py-2">
                    <LicenseStatusBadge endDate={license.end_date} />
                  </td>
                </tr>
              )
            })}
          </Table>
          <Pagination {...pager} onPageChange={pager.setPage} />
        </>
      )}
    </div>
  )
}
