import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Avatar from '../components/ui/Avatar'
import Badge from '../components/ui/Badge'
import Breadcrumbs from '../components/ui/Breadcrumbs'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Spinner from '../components/ui/Spinner'
import EmptyState from '../components/ui/EmptyState'
import Table from '../components/ui/Table'
import { BadgeIcon, BoardIcon, PaperClipIcon, TicketIcon, UserIcon } from '../components/ui/icons'
import CustomerFormModal from '../components/customers/CustomerFormModal'
import TicketTable from '../components/tickets/TicketTable'
import { useAuth } from '../auth/useAuth'
import { useI18n } from '../i18n/useI18n'
import { useCustomers, useDeleteCustomer } from '../hooks/useCustomers'
import { useTickets } from '../hooks/useTickets'
import { useTicketSettings } from '../hooks/useTicketSettings'

function Detail({ label, value, full }) {
  return (
    <div className={full ? 'sm:col-span-2' : ''}>
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
        {label}
      </dt>
      <dd className="mt-0.5 whitespace-pre-wrap text-sm text-gray-900 dark:text-gray-100">
        {value || '—'}
      </dd>
    </div>
  )
}

function formatSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function CustomerProfilePage() {
  const { t } = useI18n()
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data: customers, isLoading: isLoadingCustomers } = useCustomers()
  const customer = customers?.find((c) => String(c.id) === id)
  const { data: tickets, isLoading: isLoadingTickets } = useTickets({ customer: id })
  const deleteCustomer = useDeleteCustomer()
  const { data: ticketSettings } = useTicketSettings()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const isAdmin = user?.role === 'admin'
  const canEdit =
    isAdmin || (user?.role === 'agent' && ticketSettings?.allow_agent_edit_customers)
  const canDelete = isAdmin

  function handleDelete() {
    if (!customer || !window.confirm(t('customers.deleteConfirm'))) return
    setDeleteError('')
    deleteCustomer.mutate(customer.id, {
      onSuccess: () => navigate('/customers'),
      onError: (err) =>
        setDeleteError(
          err?.response?.status === 400
            ? t('customers.deleteHasTickets')
            : t('customers.deleteFailed')
        ),
    })
  }

  if (isLoadingCustomers) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs
        items={[
          { label: t('crumb.dashboard'), to: '/dashboard' },
          { label: t('customers.title'), to: '/customers' },
          { label: customer?.full_name || t('customers.customerFallback') },
        ]}
      />
      <Card>
        <div className="flex flex-wrap items-center gap-4">
          <Avatar name={customer?.full_name} size="lg" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {customer?.full_name}
              </h1>
              {customer && (
                <Badge color={customer.is_active ? 'green' : 'red'}>
                  {customer.is_active ? t('customers.active') : t('customers.inactive')}
                </Badge>
              )}
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {customer?.username ? `@${customer.username} · ` : ''}
              {customer?.email || t('customers.noEmail')}
            </p>
          </div>
          <div className="ms-auto flex items-center gap-3">
            <div className="rounded-xl border border-gray-200/70 bg-gray-50/60 px-4 py-2 text-center dark:border-white/10 dark:bg-white/5">
              <div className="text-2xl font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                {customer?.ticket_count ?? 0}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{t('customers.tickets')}</div>
            </div>
            <div className="rounded-xl border border-gray-200/70 bg-gray-50/60 px-4 py-2 text-center dark:border-white/10 dark:bg-white/5">
              <div className="text-2xl font-semibold tabular-nums text-indigo-600 dark:text-indigo-400">
                {customer?.open_count ?? 0}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{t('customers.open')}</div>
            </div>
            {canEdit && customer && (
              <>
                <Button variant="secondary" onClick={() => setEditOpen(true)}>
                  {t('common.edit')}
                </Button>
                {canDelete && (
                  <Button variant="danger" onClick={handleDelete} loading={deleteCustomer.isPending}>
                    {t('common.delete')}
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
        {deleteError && (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400">{deleteError}</p>
        )}
      </Card>

      <Card>
        <div className="mb-4 flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
            <UserIcon className="h-5 w-5" />
          </span>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t('customers.details')}</h2>
        </div>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
          <Detail label={t('customers.softwareType')} value={customer?.software_type} />
          <Detail label={t('field.phone')} value={customer?.phone} />
          <Detail label={t('customers.taxNumber')} value={customer?.tax_number} />
          <Detail label={t('field.email')} value={customer?.email} />
          <Detail label={t('field.address')} value={customer?.address} full />
        </dl>
      </Card>

      <div>
        <div className="mb-3 flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
            <PaperClipIcon className="h-5 w-5" />
          </span>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t('field.attachments')}</h2>
        </div>
        {customer?.attachments?.length ? (
          <Card>
            <ul className="divide-y divide-gray-100 dark:divide-white/5">
              {customer.attachments.map((att) => (
                <li key={att.id} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
                  <a
                    href={att.file}
                    target="_blank"
                    rel="noreferrer"
                    className="truncate text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                  >
                    {att.original_filename}
                  </a>
                  <span className="shrink-0 text-xs text-gray-400 dark:text-gray-500">
                    {formatSize(att.size)}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        ) : (
          <EmptyState title={t('customers.noAttachments')} />
        )}
      </div>

      <div>
        <div className="mb-3 flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
            <BadgeIcon className="h-5 w-5" />
          </span>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t('customers.licenses')}</h2>
        </div>
        {customer?.licenses?.length ? (
          <Table columns={[t('customers.licenseName'), t('customers.startDate'), t('customers.endDate')]}>
            {customer.licenses.map((lic) => (
              <tr key={lic.id}>
                <td className="px-4 py-2 font-medium text-gray-900 dark:text-gray-100">
                  {lic.name || '—'}
                </td>
                <td className="px-4 py-2 text-gray-600 dark:text-gray-300">{lic.start_date || '—'}</td>
                <td className="px-4 py-2 text-gray-600 dark:text-gray-300">{lic.end_date || '—'}</td>
              </tr>
            ))}
          </Table>
        ) : (
          <EmptyState title={t('customers.noLicenses')} />
        )}
      </div>

      <div>
        <div className="mb-3 flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
            <BoardIcon className="h-5 w-5" />
          </span>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t('customers.branches')}</h2>
        </div>
        {customer?.branches?.length ? (
          <Table columns={[t('customers.branchName'), t('field.address')]}>
            {customer.branches.map((b) => (
              <tr key={b.id}>
                <td className="px-4 py-2 font-medium text-gray-900 dark:text-gray-100">{b.name || '—'}</td>
                <td className="px-4 py-2 text-gray-600 dark:text-gray-300">{b.address || '—'}</td>
              </tr>
            ))}
          </Table>
        ) : (
          <EmptyState title={t('customers.noBranches')} />
        )}
      </div>

      <div>
        <div className="mb-3 flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
            <TicketIcon className="h-5 w-5" />
          </span>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t('customers.tickets')}</h2>
        </div>
        {isLoadingTickets ? (
          <Spinner />
        ) : tickets?.results?.length ? (
          <TicketTable tickets={tickets.results} />
        ) : (
          <EmptyState title={t('customers.noTickets')} />
        )}
      </div>

      {canEdit && (
        <CustomerFormModal open={editOpen} onClose={() => setEditOpen(false)} customer={customer} />
      )}
    </div>
  )
}
