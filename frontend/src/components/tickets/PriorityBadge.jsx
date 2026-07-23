import Badge from '../ui/Badge'
import { useI18n } from '../../i18n/useI18n'

const PRIORITY_COLORS = {
  low: 'gray',
  medium: 'blue',
  high: 'orange',
  urgent: 'red',
}

export default function PriorityBadge({ priority, variant = 'solid' }) {
  const { t } = useI18n()
  return (
    <Badge color={PRIORITY_COLORS[priority] || 'gray'} variant={variant}>
      {t(`priority.${priority}`)}
    </Badge>
  )
}
