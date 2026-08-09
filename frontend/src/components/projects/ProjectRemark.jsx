import { useEffect, useState } from 'react'
import Button from '../ui/Button'
import Textarea from '../ui/Textarea'
import { useUpdateProject } from '../../hooks/useProjects'
import { useI18n } from '../../i18n/useI18n'

// Admin-only note attached to a project, edited in place. Renders nothing for anyone
// else — the API omits `remark` from their payload entirely, so there is nothing to
// show and nothing they could save.
export default function ProjectRemark({ project, isAdmin }) {
  const { t } = useI18n()
  const updateProject = useUpdateProject(project?.id)
  const saved = project?.remark || ''
  const [draft, setDraft] = useState(saved)
  const [error, setError] = useState('')

  // Re-sync when the project loads or is changed elsewhere, but not while the admin
  // is midway through typing an edit.
  useEffect(() => {
    setDraft(saved)
  }, [saved])

  if (!isAdmin) return null

  const dirty = draft !== saved

  async function handleSave() {
    setError('')
    try {
      await updateProject.mutateAsync({ remark: draft })
    } catch {
      setError(t('projects.updateFailed'))
    }
  }

  return (
    <section className="rounded-2xl border border-amber-200/70 bg-amber-50/60 p-4 shadow-soft dark:border-amber-500/20 dark:bg-amber-500/5">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-300">
          {t('projects.remark')}
        </h2>
        <span className="text-xs text-amber-700 dark:text-amber-400">
          {t('projects.remarkAdminOnly')}
        </span>
      </div>
      <Textarea
        rows={3}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={t('projects.remarkPlaceholder')}
      />
      {error && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>}
      <div className="mt-2 flex items-center gap-2">
        <Button onClick={handleSave} disabled={!dirty} loading={updateProject.isPending}>
          {t('projects.saveChanges')}
        </Button>
        {dirty && (
          <Button variant="secondary" onClick={() => setDraft(saved)}>
            {t('common.cancel')}
          </Button>
        )}
      </div>
    </section>
  )
}
