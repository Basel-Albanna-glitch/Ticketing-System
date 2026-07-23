import { useState } from 'react'
import Avatar from '../components/ui/Avatar'
import Badge from '../components/ui/Badge'
import Breadcrumbs from '../components/ui/Breadcrumbs'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import Input from '../components/ui/Input'
import Modal from '../components/ui/Modal'
import SearchBar from '../components/ui/SearchBar'
import Spinner from '../components/ui/Spinner'
import Table from '../components/ui/Table'
import { PlusIcon } from '../components/ui/icons'
import { useAgents, useCreateAgent, useUpdateAgent } from '../hooks/useAgents'
import { useI18n } from '../i18n/useI18n'
import { sortRows, useTableSort } from '../utils/tableSort'

const COLUMNS = [
  { labelKey: 'field.username', sortKey: 'username', value: (a) => a.username },
  { labelKey: 'field.name', sortKey: 'full_name', value: (a) => a.full_name },
  { labelKey: 'field.email', sortKey: 'email', value: (a) => a.email || '' },
  { labelKey: 'agents.assigned', sortKey: 'assigned_count', value: (a) => a.assigned_count },
  { labelKey: 'agents.resolved', sortKey: 'resolved_count', value: (a) => a.resolved_count },
  { labelKey: 'agents.availability', sortKey: 'is_available', value: (a) => (a.is_available ? 1 : 0) },
  { labelKey: 'field.status', sortKey: 'is_active', value: (a) => (a.is_active ? 1 : 0) },
  '',
]

const EMPTY_FORM = { id: null, username: '', full_name: '', email: '', password: '', is_available: true }

export default function AgentsPage() {
  const { t } = useI18n()
  const { data: agents, isLoading } = useAgents()
  const createAgent = useCreateAgent()
  const updateAgent = useUpdateAgent()
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
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

  function openCreate() {
    setForm(EMPTY_FORM)
    setError('')
    setModalOpen(true)
  }

  function openEdit(agent) {
    setForm({
      id: agent.id,
      username: agent.username,
      full_name: agent.full_name,
      email: agent.email,
      password: '',
      is_available: agent.is_available,
    })
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
        const payload = { id: form.id, full_name: form.full_name, email: form.email, is_available: form.is_available }
        if (form.password) payload.password = form.password
        await updateAgent.mutateAsync(payload)
      } else {
        await createAgent.mutateAsync({
          username: form.username,
          full_name: form.full_name,
          email: form.email,
          password: form.password,
          role: 'agent',
          is_available: form.is_available,
        })
      }
      setModalOpen(false)
    } catch {
      setError(t('agents.saveError'))
    }
  }

  return (
    <div>
      <Breadcrumbs items={[{ label: t('crumb.dashboard'), to: '/dashboard' }, { label: t('agents.title') }]} />
      <div className="mb-6 mt-2 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{t('agents.title')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
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
        <Table columns={columns} sortBy={sortBy} sortDir={sortDir} onSort={onSort}>
          {rows.map((agent) => (
            <tr key={agent.id}>
              <td className="px-4 py-2 text-gray-500 dark:text-gray-400">@{agent.username}</td>
              <td className="px-4 py-2">
                <div className="flex items-center gap-2.5">
                  <Avatar name={agent.full_name} />
                  <span className="font-medium text-gray-900 dark:text-gray-100">{agent.full_name}</span>
                </div>
              </td>
              <td className="px-4 py-2 text-gray-600 dark:text-gray-300">{agent.email || '—'}</td>
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
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={form.id ? t('agents.editAgent') : t('agents.addAgent')}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
          />
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
