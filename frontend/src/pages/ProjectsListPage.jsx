import { useState } from 'react'
import Breadcrumbs from '../components/ui/Breadcrumbs'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import Input from '../components/ui/Input'
import Modal from '../components/ui/Modal'
import Pagination from '../components/ui/Pagination'
import SearchBar from '../components/ui/SearchBar'
import Spinner from '../components/ui/Spinner'
import Textarea from '../components/ui/Textarea'
import ProjectCard from '../components/projects/ProjectCard'
import { PlusIcon } from '../components/ui/icons'
import { useCreateProject, useProjects } from '../hooks/useProjects'
import { useI18n } from '../i18n/useI18n'

export default function ProjectsListPage() {
  const { t } = useI18n()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const { data, isLoading } = useProjects(page, search)
  const createProject = useCreateProject()
  const [modalOpen, setModalOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')

  function handleSearch(value) {
    setSearch(value)
    setPage(1)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    try {
      await createProject.mutateAsync({ name, description })
      setModalOpen(false)
      setName('')
      setDescription('')
    } catch {
      setError(t('projects.createFailed'))
    }
  }

  return (
    <div>
      <Breadcrumbs items={[{ label: t('crumb.dashboard'), to: '/dashboard' }, { label: t('projects.title') }]} />
      <div className="mb-6 mt-2 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{t('projects.title')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t('projects.listSubtitle')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <SearchBar value={search} onChange={handleSearch} placeholder={t('projects.searchPlaceholder')} />
          <Button onClick={() => setModalOpen(true)} className="whitespace-nowrap">
            <PlusIcon className="h-4 w-4" />
            {t('projects.newProject')}
          </Button>
        </div>
      </div>

      {isLoading && (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      )}

      {data && data.results.length === 0 && (
        <EmptyState
          title={search ? t('projects.noProjectsFound') : t('projects.noProjectsYet')}
          description={search ? t('projects.trySearch') : t('projects.emptyDescription')}
        />
      )}

      {data && data.results.length > 0 && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.results.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
          <Pagination
            page={page}
            count={data.count}
            hasNext={!!data.next}
            hasPrevious={!!data.previous}
            onPageChange={setPage}
          />
        </>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={t('projects.newProject')}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input label={t('field.name')} value={name} onChange={(e) => setName(e.target.value)} required />
          <Textarea
            label={t('field.description')}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <Button type="submit" loading={createProject.isPending}>
            {t('projects.create')}
          </Button>
        </form>
      </Modal>
    </div>
  )
}
