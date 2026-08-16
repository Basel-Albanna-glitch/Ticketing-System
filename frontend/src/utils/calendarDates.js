// Date arithmetic shared by every month grid in the app. Extracted from CalendarPage so
// a second calendar cannot quietly disagree with the first about which week a day falls
// in — the sort of drift nobody notices until two screens show the same month differently.

// 0 = Sunday. The week the grid starts on.
export const WEEK_START = 0

// Local YYYY-MM-DD. Deliberately not toISOString(), which shifts to UTC and can land on
// the previous day for anyone east of Greenwich.
export function toKey(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export function addDays(date, days) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

export function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

// The first cell of the grid: the WEEK_START on or before the 1st of the month.
export function gridStart(month) {
  const first = startOfMonth(month)
  return addDays(first, -((first.getDay() - WEEK_START + 7) % 7))
}

// The 42 cells of a month grid — six whole weeks, so the layout does not jump height
// between a month that needs five and one that needs six.
export function monthGridDays(month) {
  const start = gridStart(month)
  return Array.from({ length: 42 }, (_, i) => addDays(start, i))
}

// Weekday column headings in the viewer's language, ordered from WEEK_START.
export function weekdayNames(lang) {
  const format = new Intl.DateTimeFormat(lang, { weekday: 'short' })
  // Any known Sunday works as the anchor for generating weekday names in order.
  const anchor = new Date(2024, 0, 7)
  return Array.from({ length: 7 }, (_, i) => format.format(addDays(anchor, WEEK_START + i)))
}
