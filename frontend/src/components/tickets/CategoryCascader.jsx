import Select from '../ui/Select'
import { useI18n } from '../../i18n/useI18n'

function childrenOf(categories, parentId) {
  return categories.filter((c) => (c.parent ?? null) === parentId)
}

// Cascading category picker: selecting a category reveals a dropdown of its children so
// you can drill down the tree one level at a time. The chosen value is whatever category
// you land on (a parent is a valid choice; drilling into a child is optional).
export default function CategoryCascader({ categories = [], value, onChange, label, required }) {
  const { t } = useI18n()
  const effectiveLabel = label || t('field.category')
  const byId = new Map(categories.map((c) => [c.id, c]))

  // Build the chain root -> ... -> selected from the current value.
  const chain = []
  let cur = value ? byId.get(Number(value)) : null
  while (cur) {
    chain.unshift(cur)
    cur = cur.parent != null ? byId.get(cur.parent) : null
  }

  // Level 0 lists the roots; every selected node that has children adds another level.
  const levels = [
    { parentId: null, options: childrenOf(categories, null), selected: chain[0]?.id ?? '' },
  ]
  for (let i = 0; i < chain.length; i++) {
    const kids = childrenOf(categories, chain[i].id)
    if (kids.length) {
      levels.push({ parentId: chain[i].id, options: kids, selected: chain[i + 1]?.id ?? '' })
    }
  }

  function handleLevelChange(level, newValue) {
    if (newValue === '') {
      // Clearing a level falls back to its parent (or clears entirely at the top level).
      onChange(level.parentId != null ? String(level.parentId) : '')
    } else {
      onChange(newValue)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {levels.map((level, idx) => (
        <Select
          key={idx}
          label={idx === 0 ? effectiveLabel : undefined}
          value={String(level.selected || '')}
          onChange={(e) => handleLevelChange(level, e.target.value)}
          required={required && idx === 0}
        >
          <option value="">
            {idx === 0 ? t('tickets.selectCategory') : t('tickets.selectSubCategory')}
          </option>
          {level.options.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      ))}
    </div>
  )
}
