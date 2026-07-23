// Flatten categories into depth-first order, tagging each with a `depth` for indentation.
export function buildCategoryTree(categories = []) {
  const byParent = new Map()
  for (const c of categories) {
    const key = c.parent ?? null
    if (!byParent.has(key)) byParent.set(key, [])
    byParent.get(key).push(c)
  }
  const ordered = []
  const walk = (parentId, depth) => {
    for (const c of byParent.get(parentId) || []) {
      ordered.push({ ...c, depth })
      walk(c.id, depth + 1)
    }
  }
  walk(null, 0)
  // Include any orphans whose parent isn't in the list, so nothing disappears.
  const seen = new Set(ordered.map((c) => c.id))
  for (const c of categories) {
    if (!seen.has(c.id)) ordered.push({ ...c, depth: 0 })
  }
  return ordered
}

// IDs of a category and all of its descendants — used to exclude invalid parent choices.
export function getSelfAndDescendantIds(categories = [], id) {
  const byParent = new Map()
  for (const c of categories) {
    const key = c.parent ?? null
    if (!byParent.has(key)) byParent.set(key, [])
    byParent.get(key).push(c)
  }
  const ids = new Set([id])
  const walk = (pid) => {
    for (const c of byParent.get(pid) || []) {
      ids.add(c.id)
      walk(c.id)
    }
  }
  walk(id)
  return ids
}
