import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Badge from '../components/ui/Badge'
import Breadcrumbs from '../components/ui/Breadcrumbs'
import Card from '../components/ui/Card'
import EmptyState from '../components/ui/EmptyState'
import Spinner from '../components/ui/Spinner'
import {
  BookIcon,
  ChevronRightIcon,
  FolderOpenIcon,
  PaperClipIcon,
  SearchIcon,
} from '../components/ui/icons'
import { useArticles } from '../hooks/useArticles'
import { useCategories } from '../hooks/useCategories'
import { useI18n } from '../i18n/useI18n'

const ALL = 'all'

function ArticleCard({ article, t }) {
  return (
    <Link to={`/kb/${article.id}`} className="group">
      <Card className="flex h-full flex-col transition hover:border-indigo-300 hover:shadow-md dark:hover:border-indigo-400/40">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-gray-900 transition-colors group-hover:text-indigo-700 dark:text-gray-100 dark:group-hover:text-indigo-300">
            {article.title}
          </h3>
          {!article.is_published && <Badge color="amber">{t('kb.draft')}</Badge>}
        </div>
        <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
          {article.excerpt}
        </p>
        <div className="mt-4 flex items-center gap-3 border-t border-gray-100 pt-3 text-xs text-gray-400 dark:border-white/10 dark:text-gray-400">
          <span>
            {t('kb.updated')} {new Date(article.updated_at).toLocaleDateString()}
          </span>
          {article.attachment_count > 0 && (
            <span className="inline-flex items-center gap-1">
              <PaperClipIcon className="h-3.5 w-3.5" />
              {article.attachment_count}
            </span>
          )}
          <ChevronRightIcon className="ms-auto h-4 w-4 text-gray-300 transition-colors group-hover:text-indigo-500 rtl:rotate-180 dark:text-gray-500" />
        </div>
      </Card>
    </Link>
  )
}

export default function KbListPage() {
  const { t } = useI18n()
  const { data: articles, isLoading } = useArticles()
  const { data: categories } = useCategories()
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState(ALL)

  const byId = useMemo(
    () => new Map((categories || []).map((c) => [c.id, c])),
    [categories]
  )

  // Full "Parent › Child" label for a category id.
  function fullPath(id) {
    const parts = []
    const seen = new Set()
    let cur = byId.get(Number(id))
    while (cur && !seen.has(cur.id)) {
      seen.add(cur.id)
      parts.unshift(cur.name)
      cur = cur.parent != null ? byId.get(cur.parent) : null
    }
    return parts.join(' › ')
  }

  const q = search.trim().toLowerCase()
  const matches = (articles || []).filter(
    (a) => !q || a.title.toLowerCase().includes(q) || (a.excerpt || '').toLowerCase().includes(q)
  )
  const rows = matches.filter(
    (a) => activeCategory === ALL || String(a.category?.id ?? 'none') === activeCategory
  )

  // Chips are built from the search results, so a filter never offers an empty bucket.
  const chips = useMemo(() => {
    const counts = new Map()
    matches.forEach((a) => {
      const key = String(a.category?.id ?? 'none')
      counts.set(key, (counts.get(key) || 0) + 1)
    })
    return [...counts.entries()]
      .map(([key, count]) => ({
        key,
        count,
        label: key === 'none' ? t('kb.uncategorized') : fullPath(key) || t('kb.uncategorized'),
      }))
      .sort((a, b) => {
        if (a.key === 'none') return 1
        if (b.key === 'none') return -1
        return a.label.localeCompare(b.label)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches, byId, t])

  // Group the (filtered) articles by their category, uncategorised last.
  const groupMap = new Map()
  rows.forEach((a) => {
    const key = String(a.category?.id ?? 'none')
    if (!groupMap.has(key)) groupMap.set(key, [])
    groupMap.get(key).push(a)
  })
  const groups = [...groupMap.entries()]
    .map(([key, items]) => ({
      key,
      label: key === 'none' ? t('kb.uncategorized') : fullPath(key) || t('kb.uncategorized'),
      items,
    }))
    .sort((a, b) => {
      if (a.key === 'none') return 1
      if (b.key === 'none') return -1
      return a.label.localeCompare(b.label)
    })

  return (
    <div>
      <Breadcrumbs items={[{ label: t('crumb.dashboard'), to: '/dashboard' }, { label: t('kb.title') }]} />

      {/* Help-centre header: the search is the primary action, so it leads. */}
      <div className="mt-2 overflow-hidden rounded-2xl border border-gray-200/70 bg-gradient-to-br from-indigo-50 to-white p-6 shadow-soft sm:p-8 dark:border-white/10 dark:from-indigo-500/10 dark:to-gray-900/60">
        <div className="mx-auto max-w-xl text-center">
          <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-indigo-600 shadow-sm ring-1 ring-inset ring-indigo-200/70 dark:bg-white/10 dark:text-indigo-300 dark:ring-white/10">
            <BookIcon className="h-5 w-5" />
          </span>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{t('kb.title')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-300">{t('kb.subtitle')}</p>
          <div className="relative mt-5">
            <span className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3.5 text-gray-400 dark:text-gray-400">
              <SearchIcon className="h-4 w-4" />
            </span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('kb.searchPlaceholder')}
              className="w-full rounded-xl border border-gray-300 bg-white py-2.5 pe-4 ps-10 text-sm text-gray-900 shadow-sm transition focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/15 dark:border-white/10 dark:bg-white/5 dark:text-gray-100"
            />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : (
        <>
          {chips.length > 1 && (
            <div className="mt-6 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveCategory(ALL)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  activeCategory === ALL
                    ? 'bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-200/70 dark:bg-indigo-500/15 dark:text-indigo-300 dark:ring-indigo-400/20'
                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/10'
                }`}
              >
                {t('kb.allCategories')}
                <span className="ms-1.5 text-xs text-gray-400 dark:text-gray-400">{matches.length}</span>
              </button>
              {chips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => setActiveCategory(chip.key)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    activeCategory === chip.key
                      ? 'bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-200/70 dark:bg-indigo-500/15 dark:text-indigo-300 dark:ring-indigo-400/20'
                      : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/10'
                  }`}
                >
                  {chip.label}
                  <span className="ms-1.5 text-xs text-gray-400 dark:text-gray-400">{chip.count}</span>
                </button>
              ))}
            </div>
          )}

          {rows.length === 0 ? (
            <div className="mt-6">
              {/* "Nothing matched your search" is a different problem from "nothing here yet". */}
              {q ? (
                <EmptyState
                  title={t('kb.noMatches')}
                  description={t('kb.noMatchesHint')}
                  action={
                    <button
                      type="button"
                      onClick={() => {
                        setSearch('')
                        setActiveCategory(ALL)
                      }}
                      className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                    >
                      {t('kb.clearSearch')}
                    </button>
                  }
                />
              ) : (
                <EmptyState title={t('kb.empty')} />
              )}
            </div>
          ) : (
            <div className="mt-6 flex flex-col gap-8">
              {/* One category selected — no point repeating its name over a single group. */}
              {activeCategory !== ALL ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {rows.map((a) => (
                    <ArticleCard key={a.id} article={a} t={t} />
                  ))}
                </div>
              ) : (
                groups.map((group) => (
                  <section key={group.key}>
                    <div className="mb-3 flex items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
                        <FolderOpenIcon className="h-4 w-4" />
                      </span>
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {group.label}
                      </h2>
                      <span className="text-sm text-gray-400 dark:text-gray-400">
                        ({group.items.length})
                      </span>
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      {group.items.map((a) => (
                        <ArticleCard key={a.id} article={a} t={t} />
                      ))}
                    </div>
                  </section>
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
