import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Avatar from '../components/ui/Avatar'
import Badge from '../components/ui/Badge'
import Breadcrumbs from '../components/ui/Breadcrumbs'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Spinner from '../components/ui/Spinner'
import CustomerFormModal from '../components/customers/CustomerFormModal'
import CustomerProfileDetails from '../components/customers/CustomerProfileDetails'
import { useAuth } from '../auth/useAuth'
import { usePermissions } from '../auth/usePermissions'
import { useI18n } from '../i18n/useI18n'
import { useCustomers, useDeleteCustomer } from '../hooks/useCustomers'

export default function CustomerProfilePage() {
  const { t } = useI18n()
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data: customers, isLoading: isLoadingCustomers } = useCustomers()
  const customer = customers?.find((c) => String(c.id) === id)
  const deleteCustomer = useDeleteCustomer()
  const permissions = usePermissions()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const isAdmin = user?.role === 'admin'
  const canEdit =
    !!permissions.allow_agent_edit_customers
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
          <Avatar name={customer?.full_name} src={customer?.avatar} size="lg" />
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

      <CustomerProfileDetails customer={customer} customerId={id} />

      {canEdit && (
        <CustomerFormModal open={editOpen} onClose={() => setEditOpen(false)} customer={customer} />
      )}
    </div>
  )
}
