import { useEffect, useMemo, useState } from 'react'

// Rows per page for tables paginated in the browser. Mirrors REST_FRAMEWORK['PAGE_SIZE']
// in backend/config/settings.py, so every table pages at the same size whether the slicing
// happens on the server (tickets, projects) or here.
export const PAGE_SIZE = 10

// Slices a fully-loaded row list into pages. Used for endpoints served unpaginated because
// their full list also feeds dropdowns (agents, customers, categories, users).
// Returns the rows for the current page plus the props <Pagination> expects.
export function usePagedRows(rows, pageSize = PAGE_SIZE) {
  const [page, setPage] = useState(1)
  const all = rows || []
  const count = all.length
  const pageCount = Math.max(1, Math.ceil(count / pageSize))
  // Searching or filtering can shrink the list out from under the current page; clamp for
  // this render so the table never blanks, and put the state back in range after it.
  const current = Math.min(page, pageCount)
  useEffect(() => {
    if (page !== current) setPage(current)
  }, [page, current])

  const pageRows = useMemo(
    () => all.slice((current - 1) * pageSize, current * pageSize),
    // `all` is rebuilt on every render by the callers' filter/sort chain, so key the memo on
    // its contents rather than its identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, current, pageSize]
  )

  return {
    pageRows,
    count,
    page: current,
    setPage,
    hasPrevious: current > 1,
    hasNext: current < pageCount,
  }
}
