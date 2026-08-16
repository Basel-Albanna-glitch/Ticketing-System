import Avatar from '../components/ui/Avatar'
import Badge from '../components/ui/Badge'
import Breadcrumbs from '../components/ui/Breadcrumbs'
import Card from '../components/ui/Card'
import EmptyState from '../components/ui/EmptyState'
import Spinner from '../components/ui/Spinner'
import CustomerProfileDetails from '../components/customers/CustomerProfileDetails'
import { useI18n } from '../i18n/useI18n'
import { useMyProfile } from '../hooks/useCustomers'

export default function MyAccountPage() {
  const { t } = useI18n()
  const { data: me, isLoading, isError } = useMyProfile()

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    )
  }

  if (isError || !me) {
    return (
      <div className="flex flex-col gap-6">
        <Breadcrumbs
          items={[{ label: t('crumb.dashboard'), to: '/dashboard' }, { label: t('account.title') }]}
        />
        <EmptyState title={t('account.loadError')} />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs
        items={[{ label: t('crumb.dashboard'), to: '/dashboard' }, { label: t('account.title') }]}
      />
      <Card>
        <div className="flex flex-wrap items-center gap-4">
          <Avatar name={me.full_name} src={me.avatar} size="lg" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {me.full_name}
              </h1>
              <Badge color={me.is_active ? 'green' : 'red'}>
                {me.is_active ? t('customers.active') : t('customers.inactive')}
              </Badge>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-300">
              {me.username ? `@${me.username} · ` : ''}
              {me.email || t('customers.noEmail')}
            </p>
          </div>
          <div className="ms-auto flex items-center gap-3">
            <div className="rounded-xl border border-gray-200/70 bg-gray-50/60 px-4 py-2 text-center dark:border-white/10 dark:bg-white/5">
              <div className="text-2xl font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                {me.ticket_count ?? 0}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-300">{t('customers.tickets')}</div>
            </div>
            <div className="rounded-xl border border-gray-200/70 bg-gray-50/60 px-4 py-2 text-center dark:border-white/10 dark:bg-white/5">
              <div className="text-2xl font-semibold tabular-nums text-indigo-600 dark:text-indigo-400">
                {me.open_count ?? 0}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-300">{t('customers.open')}</div>
            </div>
          </div>
        </div>
      </Card>

      <CustomerProfileDetails customer={me} customerId={me.id} />
    </div>
  )
}
