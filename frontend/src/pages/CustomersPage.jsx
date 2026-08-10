import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Avatar from '../components/ui/Avatar'
import Badge from '../components/ui/Badge'
import Breadcrumbs from '../components/ui/Breadcrumbs'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import Pagination from '../components/ui/Pagination'
import SearchBar from '../components/ui/SearchBar'
import Select from '../components/ui/Select'
import Spinner from '../components/ui/Spinner'
import Table from '../components/ui/Table'
import { PlusIcon } from '../components/ui/icons'
import CustomerFormModal from '../components/customers/CustomerFormModal'
import { useAuth } from '../auth/useAuth'
import { usePermissions } from '../auth/usePermissions'
import { useI18n } from '../i18n/useI18n'
import { useCustomers, useUpdateCustomer } from '../hooks/useCustomers'
import { sortRows, useTableSort } from '../utils/tableSort'
import { usePagedRows } from '../utils/tablePage'

const COLUMNS = [
  { label: 'field.username', sortKey: 'username', value: (c) => c.username },
  { label: 'field.name', sortKey: 'full_name', value: (c) => c.full_name },
  { label: 'field.email', sortKey: 'email', value: (c) => c.email || '' },
  { label: 'customers.tickets', sortKey: 'ticket_count', value: (c) => c.ticket_count },
  { label: 'customers.openTickets', sortKey: 'open_count', value: (c) => c.open_count },
  { label: 'field.status', sortKey: 'is_active', value: (c) => (c.is_active ? 1 : 0) },
  '',
]

export default function CustomersPage() {
  const { t } = useI18n()
  const { data: customers, isLoading } = useCustomers()
  const { user } = useAuth()
  const updateCustomer = useUpdateCustomer()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [modalOpen, setModalOpen] = useState(false)
  const { sortBy, sortDir, onSort } = useTableSort('full_name')
  const [searchParams, setSearchParams] = useSearchParams()

  const permissions = usePermissions()
  const isAdmin = user?.role === 'admin'
  const canManage = isAdmin
  // Adding is its own permission now; editing and deleting keep their own rules.
  const canCreate = !!permissions.allow_agent_create_customers

  // Open the "add customer" modal when arriving from a Quick Action (/customers?new=1).
  useEffect(() => {
    if (searchParams.get('new') && canCreate) {
      setModalOpen(true)
      searchParams.delete('new')
      setSearchParams(searchParams, { replace: true })
    }
  }, [searchParams, canCreate, setSearchParams])
  const columns = COLUMNS.map((col) =>
    typeof col === 'string' ? col : { ...col, label: t(col.label) }
  )

  const q = search.trim().toLowerCase()
  const filtered = (customers || []).filter((c) => {
    const matchesSearch =
      !q ||
      c.full_name.toLowerCase().includes(q) ||
      c.username.toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q)
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' ? c.is_active : !c.is_active)
    return matchesSearch && matchesStatus
  })
  const rows = sortRows(filtered, COLUMNS, sortBy, sortDir)
  const { pageRows, ...pager } = usePagedRows(rows)

  function toggleActive(customer) {
    updateCustomer.mutate({ id: customer.id, is_active: !customer.is_active })
  }

  return (
    <div>
      <Breadcrumbs items={[{ label: t('crumb.dashboard'), to: '/dashboard' }, { label: t('customers.title') }]} />
      <div className="mb-6 mt-2 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{t('customers.title')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t('customers.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <SearchBar value={search} onChange={setSearch} placeholder={t('customers.searchPlaceholder')} />
          <Select
            aria-label={t('field.status')}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-36"
          >
            <option value="all">{t('common.all')}</option>
            <option value="active">{t('customers.active')}</option>
            <option value="inactive">{t('customers.inactive')}</option>
          </Select>
          {canCreate && (
            <Button onClick={() => setModalOpen(true)} className="whitespace-nowrap">
              <PlusIcon className="h-4 w-4" />
              {t('customers.addCustomer')}
            </Button>
          )}
        </div>
      </div>
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState title={t('customers.noCustomersFound')} />
      ) : (
        <>
        <Table columns={columns} sortBy={sortBy} sortDir={sortDir} onSort={onSort}>
          {pageRows.map((customer) => (
            <tr key={customer.id}>
              <td className="px-4 py-2 text-gray-500 dark:text-gray-400">@{customer.username}</td>
              <td className="px-4 py-2">
                <div className="flex items-center gap-2.5">
                  <Avatar name={customer.full_name} src={customer.avatar} />
                  <span className="font-medium text-gray-900 dark:text-gray-100">{customer.full_name}</span>
                </div>
              </td>
              <td className="px-4 py-2 text-gray-600 dark:text-gray-300">{customer.email || '—'}</td>
              <td className="px-4 py-2 tabular-nums text-gray-600 dark:text-gray-300">{customer.ticket_count}</td>
              <td className="px-4 py-2 tabular-nums text-gray-600 dark:text-gray-300">{customer.open_count}</td>
              <td className="px-4 py-2">
                <Badge color={customer.is_active ? 'green' : 'red'}>
                  {customer.is_active ? t('customers.active') : t('customers.inactive')}
                </Badge>
              </td>
              <td className="px-4 py-2 text-end">
                <div className="flex justify-end gap-2">
                  <Button variant="secondary" onClick={() => navigate(`/customers/${customer.id}`)}>
                    {t('customers.viewProfile')}
                  </Button>
                  {canManage && (
                    <Button
                      variant={customer.is_active ? 'danger' : 'secondary'}
                      onClick={() => toggleActive(customer)}
                    >
                      {customer.is_active ? t('customers.deactivate') : t('customers.activate')}
                    </Button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </Table>
        <Pagination {...pager} onPageChange={pager.setPage} />
        </>
      )}

      <CustomerFormModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  )
}
