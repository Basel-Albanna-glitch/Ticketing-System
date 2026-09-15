// The ticket table's columns, in display order. Keys mirror core.models.TICKET_COLUMNS on
// the backend, which resolves which of them each person may see (user.allowed_ticket_columns)
// from their role — or, for agents without one, the site-wide settings.
export const TICKET_COLUMNS = [
  { key: 'created_at', labelKey: 'field.createdAt' },
  { key: 'start_date', labelKey: 'field.startDate' },
  { key: 'assigned_at', labelKey: 'field.assignedOn' },
  { key: 'closed_at', labelKey: 'field.closedOn' },
  { key: 'id', labelKey: 'field.id' },
  { key: 'subject', labelKey: 'field.subject' },
  { key: 'customer', labelKey: 'field.customer' },
  { key: 'parent_category', labelKey: 'tickets.parentCategory' },
  { key: 'sub_category', labelKey: 'tickets.subCategory' },
  { key: 'requested_priority', labelKey: 'tickets.customerPriority' },
  { key: 'customer_priority', labelKey: 'customers.priority' },
  { key: 'predefined_priority', labelKey: 'tickets.categoryPriority' },
  { key: 'status', labelKey: 'field.status' },
  { key: 'assigned_agent', labelKey: 'field.assignedAgent' },
]

// The rule the table always had, used only if the server hasn't sent the resolved list
// (a session loaded before this shipped): customers don't see who a ticket is assigned to, or
// the priority staff give the customer.
const CUSTOMER_WITHHELD = new Set(['assigned_at', 'assigned_agent', 'customer_priority'])

// Whether this person may hide and show columns for themselves — a staff permission, already
// resolved by the server from their role or the site-wide defaults. Customers never hold it.
export function canCustomizeTicketColumns(user) {
  return Boolean(user?.permissions?.allow_agent_customize_columns)
}

// Columns this person may see at all, as resolved by the server.
export function allowedTicketColumns(user) {
  if (Array.isArray(user?.allowed_ticket_columns)) return user.allowed_ticket_columns
  return TICKET_COLUMNS.map((c) => c.key).filter(
    (key) => user?.role !== 'customer' || !CUSTOMER_WITHHELD.has(key)
  )
}

// What the table actually shows: allowed, minus what the person hid for themselves. If their
// own hides would leave nothing — an admin has since withheld the rest — show everything
// allowed rather than an empty table.
export function visibleTicketColumns(user) {
  const allowed = allowedTicketColumns(user)
  // Hiding columns is a permission. Without it — never granted, or since taken away — columns
  // hidden earlier stop applying, rather than staying hidden with no way to bring them back.
  if (!canCustomizeTicketColumns(user)) return allowed
  const hidden = new Set(user?.hidden_ticket_columns || [])
  const visible = allowed.filter((key) => !hidden.has(key))
  return visible.length ? visible : allowed
}

// Whether two column lists name the same columns, ignoring order — for dirty checks.
export function sameColumnSet(a = [], b = []) {
  const left = new Set(a)
  const right = new Set(b)
  return left.size === right.size && [...left].every((key) => right.has(key))
}
