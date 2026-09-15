import Badge from '../ui/Badge'
import { useI18n } from '../../i18n/useI18n'
import { licenseStatus } from '../../utils/licenses'

// Where a licence stands against its end date. The colours match the reminder stages the
// backend emails on, so a row goes amber in the same week the first warning is sent.
export default function LicenseStatusBadge({ endDate }) {
  const { t } = useI18n()
  const status = licenseStatus(endDate)
  if (!status) return <span className="text-gray-400 dark:text-gray-400">—</span>

  const label =
    status.state === 'expired'
      ? t('customers.licenseExpired')
      : status.state === 'today'
        ? t('customers.licenseExpiresToday')
        : status.state === 'active'
          ? t('customers.licenseActive')
          : `${status.days} ${t('customers.licenseDaysLeft')}`

  return <Badge color={status.color}>{label}</Badge>
}
