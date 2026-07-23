import { useState } from 'react'

// Manages a sort key + direction; clicking the same column flips the direction.
export function useTableSort(initialKey = null, initialDir = 'asc') {
  const [sortBy, setSortBy] = useState(initialKey)
  const [sortDir, setSortDir] = useState(initialDir)

  function onSort(key) {
    if (sortBy === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(key)
      setSortDir('asc')
    }
  }

  return { sortBy, sortDir, onSort }
}

// Client-side sort of `items` using a column's `value` accessor. Columns is the same array
// passed to <Table>, where sortable entries look like { label, sortKey, value }.
export function sortRows(items, columns, sortBy, sortDir) {
  if (!sortBy) return items
  const col = columns.find((c) => typeof c === 'object' && c.sortKey === sortBy)
  if (!col || !col.value) return items
  const sorted = [...items].sort((a, b) => {
    const av = col.value(a)
    const bv = col.value(b)
    if (av == null && bv == null) return 0
    if (av == null) return 1
    if (bv == null) return -1
    if (typeof av === 'number' && typeof bv === 'number') return av - bv
    return String(av).localeCompare(String(bv), undefined, { numeric: true })
  })
  return sortDir === 'desc' ? sorted.reverse() : sorted
}
