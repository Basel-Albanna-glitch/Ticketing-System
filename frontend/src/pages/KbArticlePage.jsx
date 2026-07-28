import { Link, useParams } from 'react-router-dom'
import Badge from '../components/ui/Badge'
import Breadcrumbs from '../components/ui/Breadcrumbs'
import Card from '../components/ui/Card'
import EmptyState from '../components/ui/EmptyState'
import Spinner from '../components/ui/Spinner'
import AttachmentList from '../components/tickets/AttachmentList'
import { BookIcon, ChevronRightIcon, PaperClipIcon } from '../components/ui/icons'
import { useArticle, useArticles } from '../hooks/useArticles'
import { useI18n } from '../i18n/useI18n'

// Articles are plain text. Blank lines separate paragraphs; single newlines stay as line
// breaks inside one. This is spacing, not a markdown parser — nothing is interpreted.
function Body({ text }) {
  const paragraphs = (text || '').split(/\n\s*\n/).filter((p) => p.trim())
  if (!paragraphs.length) return null
  return (
    <div className="flex flex-col gap-4 text-[15px] leading-7 text-gray-700 dark:text-gray-300">
      {paragraphs.map((paragraph, i) => (
        <p key={i} className="whitespace-pre-wrap">
          {paragraph}
        </p>
      ))}
    </div>
  )
}

export default function KbArticlePage() {
  const { t, lang } = useI18n()
  const { id } = useParams()
  const { data: article, isLoading, isError } = useArticle(id)
  const { data: allArticles } = useArticles()

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    )
  }

  if (isError || !article) {
    return (
      <div>
        <Breadcrumbs
          items={[
            { label: t('crumb.dashboard'), to: '/dashboard' },
            { label: t('kb.title'), to: '/kb' },
            { label: t('kb.notFound') },
          ]}
        />
        <EmptyState title={t('kb.notFound')} />
      </div>
    )
  }

  const updated = new Date(article.updated_at).toLocaleDateString(lang, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  // Same category, excluding this one — the most useful "what next" a help page can offer.
  const related = (allArticles || [])
    .filter((a) => a.id !== article.id && a.category?.id && a.category.id === article.category?.id)
    .slice(0, 4)

  return (
    <div className="mx-auto max-w-3xl">
      <Breadcrumbs
        items={[
          { label: t('crumb.dashboard'), to: '/dashboard' },
          { label: t('kb.title'), to: '/kb' },
          { label: article.title },
        ]}
      />

      <Card className="mt-2 p-0">
        {/* Header block — category and state first, then the title at reading size. */}
        <header className="border-b border-gray-100 px-6 py-6 sm:px-8 dark:border-white/10">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
              <BookIcon className="h-3.5 w-3.5" />
              {article.category?.name || t('kb.uncategorized')}
            </span>
            {!article.is_published && <Badge color="amber">{t('kb.draft')}</Badge>}
          </div>
          <h1 className="text-3xl font-semibold leading-tight tracking-tight text-gray-900 dark:text-gray-100">
            {article.title}
          </h1>
          <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
            {article.author_name && (
              <>
                <span>
                  {t('kb.by')} {article.author_name}
                </span>
                <span className="text-gray-300 dark:text-gray-600">·</span>
              </>
            )}
            <span>
              {t('kb.updated')} {updated}
            </span>
          </p>
        </header>

        <div className="px-6 py-6 sm:px-8">
          <Body text={article.body} />
        </div>

        {article.attachments?.length > 0 && (
          <div className="border-t border-gray-100 px-6 py-5 sm:px-8 dark:border-white/10">
            <p className="mb-3 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
              <PaperClipIcon className="h-3.5 w-3.5" />
              {t('kb.attachments')}
            </p>
            <AttachmentList attachments={article.attachments} />
          </div>
        )}
      </Card>

      {related.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">
            {t('kb.seeAlso')}
          </h2>
          <ul className="flex flex-col gap-2">
            {related.map((a) => (
              <li key={a.id}>
                <Link
                  to={`/kb/${a.id}`}
                  className="group flex items-center gap-3 rounded-xl border border-gray-200/70 bg-white px-4 py-3 shadow-soft transition hover:border-indigo-300 hover:shadow-md dark:border-white/10 dark:bg-gray-900/70 dark:hover:border-indigo-400/40"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-gray-800 dark:text-gray-200">
                      {a.title}
                    </span>
                    {a.excerpt && (
                      <span className="mt-0.5 block truncate text-xs text-gray-500 dark:text-gray-400">
                        {a.excerpt}
                      </span>
                    )}
                  </span>
                  <ChevronRightIcon className="h-4 w-4 shrink-0 text-gray-300 transition-colors group-hover:text-indigo-500 rtl:rotate-180 dark:text-gray-600" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Link
        to="/kb"
        className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
      >
        <ChevronRightIcon className="h-4 w-4 rotate-180 rtl:rotate-0" />
        {t('kb.backToList')}
      </Link>
    </div>
  )
}
