// "3d 4h" / "4h 12m" / "12m 30s" — the two largest useful units. A week-old ticket has no
// business rendering a ticking seconds counter nobody reads.
export function formatElapsed(ms, t) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const days = Math.floor(total / 86400)
  const hours = Math.floor((total % 86400) / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  const unit = (n, key) => `${n}${t(`common.unit.${key}`)}`
  if (days) return `${unit(days, 'day')} ${unit(hours, 'hour')}`
  if (hours) return `${unit(hours, 'hour')} ${unit(minutes, 'minute')}`
  if (minutes) return `${unit(minutes, 'minute')} ${unit(seconds, 'second')}`
  return unit(seconds, 'second')
}

// Whether the counter is still moving. Kept separate from elapsedFor() so an effect can
// depend on it: elapsedFor's result changes every tick, which would restart the interval
// it's meant to be driving.
export function isTicketRunning(ticket) {
  return Boolean(ticket?.created_at) && !ticket.resolved_at && !ticket.closed_at
}

// How long a ticket has been running: frozen at the resolve (or close) stamp once it's
// settled, still counting from `now` while it's open. Returns null with no ticket.
export function elapsedFor(ticket, now) {
  if (!ticket?.created_at) return null
  const settledAt = ticket.resolved_at || ticket.closed_at || null
  const end = settledAt ? new Date(settledAt).getTime() : now
  return { settled: Boolean(settledAt), ms: end - new Date(ticket.created_at).getTime() }
}
