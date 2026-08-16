import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Breadcrumbs from '../components/ui/Breadcrumbs'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import Input from '../components/ui/Input'
import Modal from '../components/ui/Modal'
import Pagination from '../components/ui/Pagination'
import SearchBar from '../components/ui/SearchBar'
import MultiSelect from '../components/ui/MultiSelect'
import SearchableSelect from '../components/ui/SearchableSelect'
import Select from '../components/ui/Select'
import Spinner from '../components/ui/Spinner'
import Textarea from '../components/ui/Textarea'
import ProjectCard from '../components/projects/ProjectCard'
import { PlusIcon } from '../components/ui/icons'
import { useAuth } from '../auth/useAuth'
import { usePermissions } from '../auth/usePermissions'
import { useAgents } from '../hooks/useAgents'
import { useCustomers } from '../hooks/useCustomers'
import { useCreateProject, useProjects, useUpdateProject } from '../hooks/useProjects'
import { useI18n } from '../i18n/useI18n'

export default function ProjectsListPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  // Closed projects are finished work, so they stay out of the way until asked for.
  const [statusFilter, setStatusFilter] = useState('open')
  const { data, isLoading } = useProjects(page, search, statusFilter)
  const createProject = useCreateProject()
  const [modalOpen, setModalOpen] = useState(false)
  // The project being edited, or null when the modal is creating a new one.
  const [editing, setEditing] = useState(null)
  const updateProject = useUpdateProject(editing?.id)
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const { data: customers } = useCustomers()
  const { data: agents } = useAgents({ includeAdmins: true })
  const permissions = usePermissions()
  // Putting yourself on a project never needs permission; the switch governs
  // involving other people, so the picker narrows rather than disappearing.
  const canAssignOthers = !!permissions.allow_agent_assign_projects
  const canCreateCustomers = !!permissions.allow_agent_create_customers
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState('open')
  const [customerId, setCustomerId] = useState('')
  const [branchId, setBranchId] = useState('')
  const [assigneeIds, setAssigneeIds] = useState([])
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [remark, setRemark] = useState('')
  const [error, setError] = useState('')

  // Only the selected customer's branches can be chosen, and picking a different
  // customer must not leave their branch behind.
  const selectedCustomer = (customers || []).find((c) => String(c.id) === String(customerId))
  const branchOptions = selectedCustomer?.branches || []

  function handleCustomerChange(value) {
    setCustomerId(value)
    setBranchId('')
  }

  function handleSearch(value) {
    setSearch(value)
    setPage(1)
  }

  // Page 3 of the open projects rarely exists once closed ones join the list.
  function handleStatusFilter(value) {
    setStatusFilter(value)
    setPage(1)
  }

  function openCreate() {
    setEditing(null)
    setName('')
    setDescription('')
    setStatus('open')
    setCustomerId('')
    setBranchId('')
    setAssigneeIds([])
    setStartDate('')
    setEndDate('')
    setRemark('')
    setError('')
    setModalOpen(true)
  }

  function openEdit(project) {
    setEditing(project)
    setName(project.name)
    setDescription(project.description || '')
    setStatus(project.status || 'open')
    setCustomerId(project.customer?.id ?? '')
    setBranchId(project.branch?.id ?? '')
    setAssigneeIds((project.assignees || []).map((a) => a.id))
    setStartDate(project.start_date || '')
    setEndDate(project.end_date || '')
    // Absent for non-admins: the API does not send it to them at all.
    setRemark(project.remark || '')
    setError('')
    setModalOpen(true)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    // A name of only digits or punctuation names nothing — same rule the ticket
    // subject uses, and \p{L} keeps it true for every language, not just Latin.
    if (!/\p{L}/u.test(name)) {
      setError(t('projects.nameMustContainText'))
      return
    }
    // Mirrors the serializer's check so the round trip is not needed to learn it.
    if (startDate && endDate && startDate > endDate) {
      setError(t('projects.dateOrder'))
      return
    }
    // An empty pick means "no customer", which the API takes as an explicit null.
    const payload = {
      name,
      description,
      status,
      customer_id: customerId || null,
      // Cleared with the customer: a branch cannot outlive the link that gave it meaning.
      branch_id: customerId ? branchId || null : null,
      assignee_ids: assigneeIds,
      // Empty means 'no date', which the API stores as null.
      start_date: startDate || null,
      end_date: endDate || null,
    }
    // Never sent by a non-admin, whose serializer would reject the field anyway.
    if (isAdmin) payload.remark = remark
    try {
      if (editing) {
        await updateProject.mutateAsync(payload)
      } else {
        await createProject.mutateAsync(payload)
      }
      setModalOpen(false)
      setEditing(null)
      setName('')
      setDescription('')
      setStatus('open')
      setCustomerId('')
      setBranchId('')
      setAssigneeIds([])
      setStartDate('')
      setEndDate('')
      setRemark('')
    } catch (err) {
      // The serializer explains exactly what is wrong — a date order, an
      // assignee who may not be assigned, the tasks blocking a close. Replacing
      // that with a generic failure left the form looking broken for something
      // the message would have answered outright.
      const detail = err?.response?.data
      const fieldErrors =
        detail && typeof detail === 'object' && !Array.isArray(detail)
          ? Object.entries(detail)
              .map(([field, messages]) => `${field}: ${[].concat(messages).join(' ')}`)
              .join(' · ')
          : ''
      setError(fieldErrors || t(editing ? 'projects.updateFailed' : 'projects.createFailed'))
    }
  }

  return (
    <div>
      <Breadcrumbs items={[{ label: t('crumb.dashboard'), to: '/dashboard' }, { label: t('projects.title') }]} />
      <div className="mb-6 mt-2 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{t('projects.title')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-300">
            {t('projects.listSubtitle')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <SearchBar value={search} onChange={handleSearch} placeholder={t('projects.searchPlaceholder')} />
          <Select
            aria-label={t('field.status')}
            value={statusFilter}
            onChange={(e) => handleStatusFilter(e.target.value)}
            className="w-36"
          >
            <option value="open">{t('projects.status.open')}</option>
            <option value="closed">{t('projects.status.closed')}</option>
            <option value="all">{t('common.all')}</option>
          </Select>
          <Button onClick={openCreate} className="whitespace-nowrap">
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
          title={
            search
              ? t('projects.noProjectsFound')
              : statusFilter === 'all'
                ? t('projects.noProjectsYet')
                : t('projects.noneWithStatus')
          }
          description={
            search
              ? t('projects.trySearch')
              : statusFilter === 'all'
                ? t('projects.emptyDescription')
                : t('projects.tryStatusFilter')
          }
        />
      )}

      {data && data.results.length > 0 && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.results.map((project) => (
              <ProjectCard key={project.id} project={project} onEdit={openEdit} />
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

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={t(editing ? 'projects.editProject' : 'projects.newProject')}
        dismissOnBackdrop={false}
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input label={t('field.name')} value={name} onChange={(e) => setName(e.target.value)} required />
          <Textarea
            label={t('field.description')}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <Select label={t('field.status')} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="open">{t('projects.status.open')}</option>
            <option value="closed">{t('projects.status.closed')}</option>
          </Select>
          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <SearchableSelect
                label={t('field.customer')}
                value={customerId}
                onChange={handleCustomerChange}
            placeholder={t('projects.noCustomer')}
                // The link is optional, and SearchableSelect has no clear
                // button — this leading entry is how an already-linked project
                // gets unlinked again.
                options={[
                  { value: '', label: t('projects.noCustomer') },
                  ...(customers || []).map((c) => ({
                    value: c.id,
                    label: `${c.full_name} (${c.username})`,
                  })),
                ]}
              />
            </div>
            {/* Offered to whoever may actually create a customer, so the
                shortcut never leads to a page that refuses. */}
            {canCreateCustomers && (
              <Button
                type="button"
                variant="secondary"
                title={t('customers.addCustomer')}
                onClick={() => navigate('/customers?new=1')}
              >
                <PlusIcon className="h-4 w-4" />
                {t('common.add')}
              </Button>
            )}
          </div>
          {branchOptions.length > 0 && (
            <Select
              label={t('tickets.branch')}
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
            >
              <option value="">{t('projects.noBranch')}</option>
              {branchOptions.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label={t('projects.fromDate')}
              type="date"
              value={startDate}
              max={endDate || undefined}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <Input
              label={t('projects.toDate')}
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <MultiSelect
            label={t('projects.assignees')}
            value={assigneeIds}
            onChange={setAssigneeIds}
            placeholder={t('projects.unassigned')}
            options={(agents || [])
              .filter((agent) => canAssignOthers || agent.id === user?.id || assigneeIds.includes(agent.id))
              .map((agent) => ({ value: agent.id, label: agent.full_name }))}
          />
          {!canAssignOthers && (
            <p className="-mt-2 text-xs text-gray-500 dark:text-gray-300">
              {t('projects.selfAssignOnly')}
            </p>
          )}
          {isAdmin && (
            <div className="rounded-xl border border-amber-200/70 bg-amber-50/60 p-3 dark:border-amber-500/20 dark:bg-amber-500/5">
              <Textarea
                label={t('projects.remark')}
                rows={3}
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                placeholder={t('projects.remarkPlaceholder')}
              />
              <p className="mt-1.5 text-xs text-amber-700 dark:text-amber-400">
                {t('projects.remarkAdminOnly')}
              </p>
            </div>
          )}
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <Button type="submit" loading={editing ? updateProject.isPending : createProject.isPending}>
            {t(editing ? 'projects.saveChanges' : 'projects.create')}
          </Button>
        </form>
      </Modal>

    </div>
  )
}
