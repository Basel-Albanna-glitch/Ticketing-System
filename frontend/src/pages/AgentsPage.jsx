import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import Avatar from '../components/ui/Avatar'
import AvatarUploader from '../components/ui/AvatarUploader'
import Badge from '../components/ui/Badge'
import Breadcrumbs from '../components/ui/Breadcrumbs'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import Input from '../components/ui/Input'
import Modal from '../components/ui/Modal'
import Pagination from '../components/ui/Pagination'
import SearchBar from '../components/ui/SearchBar'
import Select from '../components/ui/Select'
import Spinner from '../components/ui/Spinner'
import Table from '../components/ui/Table'
import { PlusIcon } from '../components/ui/icons'
import { useAgents, useCreateAgent, useUpdateAgent } from '../hooks/useAgents'
import { useRoles } from '../hooks/useRoles'
import { useAuth } from '../auth/useAuth'
import { deleteUserAvatar, uploadUserAvatar } from '../api/users'
import { useI18n } from '../i18n/useI18n'
import { sortRows, useTableSort } from '../utils/tableSort'
import { usePagedRows } from '../utils/tablePage'

const COLUMNS = [
  { labelKey: 'field.username', sortKey: 'username', value: (a) => a.username },
  { labelKey: 'field.name', sortKey: 'full_name', value: (a) => a.full_name },
  { labelKey: 'field.email', sortKey: 'email', value: (a) => a.email || '' },
  { labelKey: 'settings.roles.title', sortKey: 'staff_role_name', value: (a) => a.staff_role_name || '' },
  { labelKey: 'agents.assigned', sortKey: 'assigned_count', value: (a) => a.assigned_count },
  { labelKey: 'agents.resolved', sortKey: 'resolved_count', value: (a) => a.resolved_count },
  { labelKey: 'agents.availability', sortKey: 'is_available', value: (a) => (a.is_available ? 1 : 0) },
  { labelKey: 'field.status', sortKey: 'is_active', value: (a) => (a.is_active ? 1 : 0) },
  '',
]

const EMPTY_FORM = {
  id: null, username: '', full_name: '', email: '', password: '',
  is_available: true, avatar: null, staff_role: '',
}

export default function AgentsPage() {
  const { t } = useI18n()
  const { data: agents, isLoading } = useAgents()
  const { user } = useAuth()
  // Roles are only listable by an admin who holds none themselves, so don't
  // request them for anyone else — the endpoint would 403.
  const isFullAdmin = Boolean(user?.is_full_admin)
  const { data: roles } = useRoles({ enabled: isFullAdmin })
  const createAgent = useCreateAgent()
  const updateAgent = useUpdateAgent()
  const [modalOpen, setModalOpen] = useState(false)
  const queryClient = useQueryClient()
  const [form, setForm] = useState(EMPTY_FORM)
  // Picture picked while creating an agent, uploaded once the account has an id.
  const [pendingAvatar, setPendingAvatar] = useState(null)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const { sortBy, sortDir, onSort } = useTableSort('full_name')

  const q = search.trim().toLowerCase()
  const filtered = (agents || []).filter((a) =>
    !q ||
    a.full_name.toLowerCase().includes(q) ||
    a.username.toLowerCase().includes(q) ||
    (a.email || '').toLowerCase().includes(q)
  )
  const columns = COLUMNS.map((c) => (typeof c === 'string' ? c : { ...c, label: t(c.labelKey) }))
  const rows = sortRows(filtered, columns, sortBy, sortDir)
  const { pageRows, ...pager } = usePagedRows(rows)

  function openCreate() {
    setForm(EMPTY_FORM)
    setPendingAvatar(null)
    setError('')
    setModalOpen(true)
  }

  // Open the "add agent" modal when arriving from a Quick Action (/agents?new=1).
  const [searchParams, setSearchParams] = useSearchParams()
  useEffect(() => {
    if (searchParams.get('new')) {
      openCreate()
      searchParams.delete('new')
      setSearchParams(searchParams, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  function openEdit(agent) {
    setForm({
      id: agent.id,
      username: agent.username,
      full_name: agent.full_name,
      email: agent.email,
      password: '',
      is_available: agent.is_available,
      avatar: agent.avatar,
      staff_role: agent.staff_role ?? '',
    })
    setPendingAvatar(null)
    setError('')
    setModalOpen(true)
  }

  function toggleActive(agent) {
    updateAgent.mutate({ id: agent.id, is_active: !agent.is_active })
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    try {
      if (form.id) {
        const payload = {
          id: form.id,
          full_name: form.full_name,
          email: form.email,
          is_available: form.is_available,
          staff_role: form.staff_role || null,
        }
        if (form.password) payload.password = form.password
        await updateAgent.mutateAsync(payload)
      } else {
        const created = await createAgent.mutateAsync({
          username: form.username,
          full_name: form.full_name,
          email: form.email,
          password: form.password,
          role: 'agent',
          is_available: form.is_available,
          staff_role: form.staff_role || null,
        })
        if (pendingAvatar) {
          try {
            await uploadUserAvatar(created.id, pendingAvatar)
            queryClient.invalidateQueries({ queryKey: ['agents'] })
          } catch {
            // The agent exists now, so don't fail the whole save. Turn the modal into an
            // edit form for the new agent so the picture can be retried on the spot.
            setForm((f) => ({ ...f, id: created.id, avatar: null }))
            setPendingAvatar(null)
            setError(t('settings.avatar.savedWithoutPicture'))
            return
          }
        }
      }
      setModalOpen(false)
    } catch (err) {
      // Show DRF's per-field validation messages (taken username, password under
      // the minimum) rather than a generic failure that hides which field to fix.
      const detail = err?.response?.data
      const fieldErrors =
        detail && typeof detail === 'object' && !Array.isArray(detail)
          ? Object.entries(detail)
              .map(([field, messages]) => `${field}: ${[].concat(messages).join(' ')}`)
              .join(' · ')
          : ''
      setError(fieldErrors || t('agents.saveError'))
    }
  }

  return (
    <div>
      <Breadcrumbs items={[{ label: t('crumb.dashboard'), to: '/dashboard' }, { label: t('agents.title') }]} />
      <div className="mb-6 mt-2 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{t('agents.title')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-300">
            {t('agents.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <SearchBar value={search} onChange={setSearch} placeholder={t('agents.searchPlaceholder')} />
          <Button onClick={openCreate} className="whitespace-nowrap">
            <PlusIcon className="h-4 w-4" />
            {t('agents.addAgent')}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState title={t('agents.emptyTitle')} />
      ) : (
        <>
        <Table columns={columns} sortBy={sortBy} sortDir={sortDir} onSort={onSort}>
          {pageRows.map((agent) => (
            <tr key={agent.id}>
              <td className="px-4 py-2 text-gray-500 dark:text-gray-300">@{agent.username}</td>
              <td className="px-4 py-2">
                <Link
                  to={`/agents/${agent.id}`}
                  className="flex items-center gap-2.5 transition-colors hover:text-indigo-600 dark:hover:text-indigo-400"
                  title={t('agents.viewProfile')}
                >
                  <Avatar name={agent.full_name} src={agent.avatar} />
                  <span className="font-medium text-gray-900 hover:text-indigo-600 dark:text-gray-100 dark:hover:text-indigo-400">
                    {agent.full_name}
                  </span>
                </Link>
              </td>
              <td className="px-4 py-2 text-gray-600 dark:text-gray-300">{agent.email || '—'}</td>
              <td className="px-4 py-2">
                {agent.staff_role_name ? (
                  <Badge color="purple">{agent.staff_role_name}</Badge>
                ) : (
                  <span className="text-xs text-gray-400 dark:text-gray-400">{t('agents.noRole')}</span>
                )}
              </td>
              <td className="px-4 py-2 tabular-nums text-gray-600 dark:text-gray-300">{agent.assigned_count}</td>
              <td className="px-4 py-2 tabular-nums text-gray-600 dark:text-gray-300">{agent.resolved_count}</td>
              <td className="px-4 py-2">
                <Badge color={agent.is_available ? 'green' : 'gray'}>
                  {agent.is_available ? t('agents.available') : t('agents.unavailable')}
                </Badge>
              </td>
              <td className="px-4 py-2">
                <Badge color={agent.is_active ? 'green' : 'red'}>
                  {agent.is_active ? t('agents.active') : t('agents.inactive')}
                </Badge>
              </td>
              <td className="px-4 py-2 text-end">
                <div className="flex justify-end gap-2">
                  <Button variant="secondary" onClick={() => openEdit(agent)}>
                    {t('common.edit')}
                  </Button>
                  <Button
                    variant={agent.is_active ? 'danger' : 'secondary'}
                    onClick={() => toggleActive(agent)}
                  >
                    {agent.is_active ? t('agents.deactivate') : t('agents.activate')}
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </Table>
        <Pagination {...pager} onPageChange={pager.setPage} />
        </>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={form.id ? t('agents.editAgent') : t('agents.addAgent')}
        dismissOnBackdrop={false}
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* An existing agent uploads immediately; a new one has no id yet, so the file is
              held and uploaded right after the account is created. */}
          <AvatarUploader
            name={form.full_name}
            src={form.avatar}
            size="lg"
            onUpload={
              form.id
                ? (file) =>
                    uploadUserAvatar(form.id, file).then((u) =>
                      setForm((f) => ({ ...f, avatar: u.avatar }))
                    )
                : undefined
            }
            onSelect={form.id ? undefined : setPendingAvatar}
            onRemove={
              form.id
                ? () =>
                    deleteUserAvatar(form.id).then((u) => setForm((f) => ({ ...f, avatar: u.avatar })))
                : undefined
            }
            onDone={() => queryClient.invalidateQueries({ queryKey: ['agents'] })}
            className="border-b border-gray-100 pb-4 dark:border-white/10"
          />
          {!form.id && (
            <Input
              label={t('field.username')}
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              required
            />
          )}
          <Input
            label={t('field.fullName')}
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            required
          />
          <Input
            label={t('agents.emailOptional')}
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <Input
            label={form.id ? t('agents.newPassword') : t('field.password')}
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required={!form.id}
            minLength={8}
          />
          {/* Only offered to an admin who may manage roles; for anyone else the
              field would be read-only noise, and the API would reject the write. */}
          {isFullAdmin && (
            <Select
              label={t('settings.roles.title')}
              value={form.staff_role}
              onChange={(e) => setForm({ ...form, staff_role: e.target.value })}
            >
              <option value="">{t('agents.noRole')}</option>
              {(roles || []).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
          )}
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              className="h-4 w-4 accent-indigo-600"
              checked={form.is_available}
              onChange={(e) => setForm({ ...form, is_available: e.target.checked })}
            />
            {t('agents.available')}
          </label>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <Button type="submit" loading={createAgent.isPending || updateAgent.isPending}>
            {t('common.save')}
          </Button>
        </form>
      </Modal>
    </div>
  )
}
