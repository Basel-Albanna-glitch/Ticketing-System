import { useEffect, useRef, useState } from 'react'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import Table from '../components/ui/Table'
import Textarea from '../components/ui/Textarea'
import {
  PlusIcon,
  UserIcon,
  LockIcon,
  BellIcon,
  BadgeIcon,
  FolderOpenIcon,
  BoardIcon,
  UsersIcon,
} from '../components/ui/icons'
import Breadcrumbs from '../components/ui/Breadcrumbs'
import SearchBar from '../components/ui/SearchBar'
import SectionHeader from '../components/ui/SectionHeader'
import PriorityBadge from '../components/tickets/PriorityBadge'
import { useAuth } from '../auth/useAuth'
import {
  useChangePassword,
  useNotificationPreferences,
  useUpdateNotificationPreferences,
  useUpdateProfile,
} from '../hooks/useSettings'
import {
  useCategories,
  useCreateCategory,
  useDeleteCategory,
  useUpdateCategory,
} from '../hooks/useCategories'
import {
  useCreateSoftwareType,
  useDeleteSoftwareType,
  useSoftwareTypes,
  useUpdateSoftwareType,
} from '../hooks/useSoftwareTypes'
import { useAllUsers, useUpdateUserRole } from '../hooks/useUsers'
import { useTicketSettings, useUpdateTicketSettings } from '../hooks/useTicketSettings'
import { buildCategoryTree, getSelfAndDescendantIds } from '../utils/categoryTree'
import { sortRows, useTableSort } from '../utils/tableSort'
import { useI18n } from '../i18n/useI18n'

function ProfileSection() {
  const { t } = useI18n()
  const { user, refreshUser } = useAuth()
  const [fullName, setFullName] = useState(user?.full_name || '')
  const [email, setEmail] = useState(user?.email || '')
  const [message, setMessage] = useState('')
  const updateProfile = useUpdateProfile()

  useEffect(() => {
    setFullName(user?.full_name || '')
    setEmail(user?.email || '')
  }, [user])

  async function handleSubmit(event) {
    event.preventDefault()
    setMessage('')
    await updateProfile.mutateAsync({ full_name: fullName, email })
    await refreshUser()
    setMessage(t('settings.profile.updated'))
  }

  return (
    <Card>
      <SectionHeader
        icon={UserIcon}
        title={t('settings.profile.title')}
        description={t('settings.profile.description')}
      />
      <form onSubmit={handleSubmit} className="flex max-w-sm flex-col gap-4">
        <Input label={t('field.username')} value={user?.username || ''} disabled />
        <Input label={t('field.fullName')} value={fullName} onChange={(e) => setFullName(e.target.value)} />
        <Input
          label={`${t('field.email')} (${t('common.optional')})`}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        {message && <p className="text-sm text-green-600 dark:text-green-400">{message}</p>}
        <Button type="submit" loading={updateProfile.isPending} className="self-start">
          {t('common.save')}
        </Button>
      </form>
    </Card>
  )
}

function PasswordSection() {
  const { t } = useI18n()
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const changePassword = useChangePassword()

  async function handleSubmit(event) {
    event.preventDefault()
    setMessage('')
    setError('')
    try {
      await changePassword.mutateAsync({
        old_password: oldPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      })
      setMessage(t('settings.password.updated'))
      setOldPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch {
      setError(t('settings.password.error'))
    }
  }

  return (
    <Card>
      <SectionHeader
        icon={LockIcon}
        title={t('settings.password.title')}
        description={t('settings.password.description')}
      />
      <form onSubmit={handleSubmit} className="flex max-w-sm flex-col gap-4">
        <Input
          label={t('settings.password.current')}
          type="password"
          value={oldPassword}
          onChange={(e) => setOldPassword(e.target.value)}
          required
        />
        <Input
          label={t('settings.password.new')}
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
        />
        <Input
          label={t('settings.password.confirm')}
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />
        {message && <p className="text-sm text-green-600 dark:text-green-400">{message}</p>}
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <Button type="submit" loading={changePassword.isPending} className="self-start">
          {t('settings.password.submit')}
        </Button>
      </form>
    </Card>
  )
}

function NotificationSection() {
  const { t } = useI18n()
  const { data } = useNotificationPreferences()
  const updatePrefs = useUpdateNotificationPreferences()

  if (!data) return null

  function toggle(key) {
    updatePrefs.mutate({ [key]: !data[key] })
  }

  return (
    <Card>
      <SectionHeader
        icon={BellIcon}
        title={t('settings.notifications.title')}
        description={t('settings.notifications.description')}
      />
      <div className="flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
        <label className="flex cursor-pointer items-center justify-between gap-4 py-3">
          <span className="text-sm text-gray-700 dark:text-gray-300">
            {t('settings.notifications.newComment.label')}
            <span className="block text-xs text-gray-400 dark:text-gray-500">
              {t('settings.notifications.newComment.hint')}
            </span>
          </span>
          <input
            type="checkbox"
            className="h-4 w-4 shrink-0 accent-indigo-600"
            checked={data.email_on_new_comment}
            onChange={() => toggle('email_on_new_comment')}
          />
        </label>
        <label className="flex cursor-pointer items-center justify-between gap-4 py-3">
          <span className="text-sm text-gray-700 dark:text-gray-300">
            {t('settings.notifications.statusChange.label')}
            <span className="block text-xs text-gray-400 dark:text-gray-500">
              {t('settings.notifications.statusChange.hint')}
            </span>
          </span>
          <input
            type="checkbox"
            className="h-4 w-4 shrink-0 accent-indigo-600"
            checked={data.email_on_status_change}
            onChange={() => toggle('email_on_status_change')}
          />
        </label>
      </div>
    </Card>
  )
}

function CategoriesSection() {
  const { t } = useI18n()
  const { data: categories } = useCategories()
  const createCategory = useCreateCategory()
  const updateCategory = useUpdateCategory()
  const deleteCategory = useDeleteCategory()
  const formRef = useRef(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('medium')
  const [parentId, setParentId] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [error, setError] = useState('')

  const tree = buildCategoryTree(categories || [])
  // When editing, a category can't be parented to itself or any of its descendants.
  const excludedIds = editingId ? getSelfAndDescendantIds(categories || [], editingId) : new Set()
  const parentOptions = tree.filter((c) => !excludedIds.has(c.id))
  const selectedParent = parentId
    ? (categories || []).find((c) => String(c.id) === String(parentId))
    : null

  function focusForm() {
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  function startEdit(category) {
    setEditingId(category.id)
    setName(category.name)
    setDescription(category.description)
    setPriority(category.priority || 'medium')
    setParentId(category.parent ?? '')
    setError('')
    focusForm()
  }

  // "Create a child inside this group": new category with the parent preselected.
  function startAddChild(category) {
    setEditingId(null)
    setName('')
    setDescription('')
    setPriority(category.priority || 'medium')
    setParentId(String(category.id))
    setError('')
    focusForm()
  }

  function resetForm() {
    setEditingId(null)
    setName('')
    setDescription('')
    setPriority('medium')
    setParentId('')
    setError('')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    const payload = { name, description, priority, parent: parentId ? Number(parentId) : null }
    try {
      if (editingId) {
        await updateCategory.mutateAsync({ id: editingId, ...payload })
      } else {
        await createCategory.mutateAsync(payload)
      }
      resetForm()
    } catch (err) {
      const data = err?.response?.data
      setError(data ? Object.values(data).flat().join(' ') : t('settings.categories.saveError'))
    }
  }

  async function handleDelete(id) {
    setError('')
    try {
      await deleteCategory.mutateAsync(id)
    } catch (err) {
      setError(err?.response?.data?.detail || t('settings.categories.deleteError'))
    }
  }

  return (
    <Card>
      <SectionHeader
        icon={FolderOpenIcon}
        title={t('settings.categories.title')}
        description={t('settings.categories.description')}
      />
      <Table columns={[t('field.name'), t('field.priority'), t('field.description'), '']}>
        {tree.map((category) => (
          <tr key={category.id}>
            <td className="px-4 py-2 font-medium text-gray-900 dark:text-gray-100">
              <span style={{ paddingInlineStart: `${category.depth * 1.25}rem` }} className="inline-flex items-center">
                {category.depth > 0 && (
                  <span className="me-1 text-gray-300 dark:text-gray-600">└</span>
                )}
                {category.name}
              </span>
            </td>
            <td className="px-4 py-2">
              <PriorityBadge priority={category.priority} variant="outline" />
            </td>
            <td className="px-4 py-2 text-gray-600 dark:text-gray-300">{category.description}</td>
            <td className="px-4 py-2 text-end">
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => startAddChild(category)}>
                  <PlusIcon className="h-4 w-4" />
                  {t('settings.categories.subCategory')}
                </Button>
                <Button variant="secondary" onClick={() => startEdit(category)}>
                  {t('common.edit')}
                </Button>
                <Button variant="danger" onClick={() => handleDelete(category.id)}>
                  {t('common.delete')}
                </Button>
              </div>
            </td>
          </tr>
        ))}
      </Table>

      <form ref={formRef} onSubmit={handleSubmit} className="mt-6 flex max-w-sm flex-col gap-4">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {editingId
            ? t('settings.categories.editTitle')
            : selectedParent
              ? `${t('settings.categories.addSubUnder')} “${selectedParent.name}”`
              : t('settings.categories.addTopLevel')}
        </p>
        <Input label={t('field.name')} value={name} onChange={(e) => setName(e.target.value)} required />
        <Textarea
          label={t('field.description')}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <Select label={t('field.priority')} value={priority} onChange={(e) => setPriority(e.target.value)}>
          <option value="low">{t('priority.low')}</option>
          <option value="medium">{t('priority.medium')}</option>
          <option value="high">{t('priority.high')}</option>
          <option value="urgent">{t('priority.urgent')}</option>
        </Select>
        <Select label={t('settings.categories.parent')} value={parentId} onChange={(e) => setParentId(e.target.value)}>
          <option value="">{t('settings.categories.parentNone')}</option>
          {parentOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {`${'  '.repeat(c.depth)}${c.name}`}
            </option>
          ))}
        </Select>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex gap-2">
          <Button type="submit" loading={createCategory.isPending || updateCategory.isPending}>
            {editingId ? t('settings.categories.update') : t('settings.categories.add')}
          </Button>
          {(editingId || selectedParent) && (
            <Button type="button" variant="secondary" onClick={resetForm}>
              {t('common.cancel')}
            </Button>
          )}
        </div>
      </form>
    </Card>
  )
}

function SoftwareTypesSection() {
  const { t } = useI18n()
  const { data: softwareTypes } = useSoftwareTypes()
  const createSoftwareType = useCreateSoftwareType()
  const updateSoftwareType = useUpdateSoftwareType()
  const deleteSoftwareType = useDeleteSoftwareType()
  const formRef = useRef(null)
  const [name, setName] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [error, setError] = useState('')

  function startEdit(softwareType) {
    setEditingId(softwareType.id)
    setName(softwareType.name)
    setError('')
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  function resetForm() {
    setEditingId(null)
    setName('')
    setError('')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    try {
      if (editingId) {
        await updateSoftwareType.mutateAsync({ id: editingId, name })
      } else {
        await createSoftwareType.mutateAsync({ name })
      }
      resetForm()
    } catch (err) {
      const data = err?.response?.data
      setError(data ? Object.values(data).flat().join(' ') : t('settings.softwareTypes.saveError'))
    }
  }

  async function handleDelete(id) {
    setError('')
    try {
      await deleteSoftwareType.mutateAsync(id)
    } catch (err) {
      setError(err?.response?.data?.detail || t('settings.softwareTypes.deleteError'))
    }
  }

  return (
    <Card>
      <SectionHeader
        icon={BoardIcon}
        title={t('settings.softwareTypes.title')}
        description={t('settings.softwareTypes.description')}
      />
      {softwareTypes?.length ? (
        <Table columns={[t('field.name'), '']}>
          {softwareTypes.map((softwareType) => (
            <tr key={softwareType.id}>
              <td className="px-4 py-2 font-medium text-gray-900 dark:text-gray-100">
                {softwareType.name}
              </td>
              <td className="px-4 py-2 text-end">
                <div className="flex justify-end gap-2">
                  <Button variant="secondary" onClick={() => startEdit(softwareType)}>
                    {t('common.edit')}
                  </Button>
                  <Button variant="danger" onClick={() => handleDelete(softwareType.id)}>
                    {t('common.delete')}
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </Table>
      ) : (
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('settings.softwareTypes.empty')}</p>
      )}

      <form ref={formRef} onSubmit={handleSubmit} className="mt-6 flex max-w-sm flex-col gap-4">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {editingId ? t('settings.softwareTypes.editTitle') : t('settings.softwareTypes.addTitle')}
        </p>
        <Input label={t('field.name')} value={name} onChange={(e) => setName(e.target.value)} required />
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex gap-2">
          <Button
            type="submit"
            loading={createSoftwareType.isPending || updateSoftwareType.isPending}
          >
            {editingId ? t('settings.softwareTypes.update') : t('settings.softwareTypes.add')}
          </Button>
          {editingId && (
            <Button type="button" variant="secondary" onClick={resetForm}>
              {t('common.cancel')}
            </Button>
          )}
        </div>
      </form>
    </Card>
  )
}

// Ticket permission toggles, in display order. `i18n` maps to the
// settings.permissions.<i18n>.label / .hint translation keys.
const PERMISSION_FIELDS = [
  { key: 'allow_agent_self_assign', i18n: 'selfAssign' },
  { key: 'allow_agent_reassign', i18n: 'reassign' },
  { key: 'allow_agent_edit_after_close', i18n: 'editAfterClose' },
  { key: 'allow_agent_delete', i18n: 'deleteTicket' },
  { key: 'allow_agent_edit_customers', i18n: 'editCustomers' },
  { key: 'allow_agent_link_customer', i18n: 'linkCustomer' },
]

function PermissionsSection() {
  const { t } = useI18n()
  const { data } = useTicketSettings()
  const updateSettings = useUpdateTicketSettings()
  // Draft copy — toggles edit this locally and are only persisted on Save.
  const [form, setForm] = useState(null)
  const [message, setMessage] = useState('')

  // Seed (and re-sync) the draft whenever the saved settings load or change.
  useEffect(() => {
    if (data) {
      setForm(Object.fromEntries(PERMISSION_FIELDS.map((f) => [f.key, data[f.key]])))
    }
  }, [data])

  if (!data || !form) return null

  const dirty = PERMISSION_FIELDS.some((f) => form[f.key] !== data[f.key])

  function toggle(key) {
    setMessage('')
    setForm((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setMessage('')
    await updateSettings.mutateAsync(form)
    setMessage(t('settings.permissions.saved'))
  }

  return (
    <Card>
      <SectionHeader
        icon={BadgeIcon}
        title={t('settings.permissions.title')}
        description={t('settings.permissions.description')}
      />
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {PERMISSION_FIELDS.map((f) => (
          <label
            key={f.key}
            className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300"
          >
            <input
              type="checkbox"
              className="mt-0.5 accent-indigo-600"
              checked={form[f.key]}
              onChange={() => toggle(f.key)}
            />
            <span>
              {t(`settings.permissions.${f.i18n}.label`)}
              <span className="block text-xs text-gray-400 dark:text-gray-500">
                {t(`settings.permissions.${f.i18n}.hint`)}
              </span>
            </span>
          </label>
        ))}
        {message && <p className="text-sm text-green-600 dark:text-green-400">{message}</p>}
        <Button
          type="submit"
          loading={updateSettings.isPending}
          disabled={!dirty}
          className="self-start"
        >
          {t('common.save')}
        </Button>
      </form>
    </Card>
  )
}

const USER_COLUMNS = [
  { labelKey: 'field.username', sortKey: 'username', value: (u) => u.username },
  { labelKey: 'field.name', sortKey: 'full_name', value: (u) => u.full_name },
  { labelKey: 'field.email', sortKey: 'email', value: (u) => u.email || '' },
  { labelKey: 'settings.userRoles.roleColumn', sortKey: 'role', value: (u) => u.role },
]

function UserRolesSection() {
  const { t } = useI18n()
  const { data: users } = useAllUsers()
  const updateRole = useUpdateUserRole()
  const [search, setSearch] = useState('')
  const { sortBy, sortDir, onSort } = useTableSort('full_name')
  const columns = USER_COLUMNS.map((c) => ({ ...c, label: t(c.labelKey) }))

  const q = search.trim().toLowerCase()
  const filtered = (users || []).filter((u) =>
    !q ||
    u.full_name.toLowerCase().includes(q) ||
    u.username.toLowerCase().includes(q) ||
    (u.email || '').toLowerCase().includes(q)
  )
  const rows = sortRows(filtered, columns, sortBy, sortDir)

  return (
    <Card>
      <SectionHeader
        icon={UsersIcon}
        title={t('settings.userRoles.title')}
        description={t('settings.userRoles.description')}
        action={<SearchBar value={search} onChange={setSearch} placeholder={t('settings.userRoles.searchPlaceholder')} />}
      />
      <Table columns={columns} sortBy={sortBy} sortDir={sortDir} onSort={onSort}>
        {rows.map((u) => (
          <tr key={u.id}>
            <td className="px-4 py-2 text-gray-600 dark:text-gray-300">{u.username}</td>
            <td className="px-4 py-2 font-medium text-gray-900 dark:text-gray-100">{u.full_name}</td>
            <td className="px-4 py-2 text-gray-600 dark:text-gray-300">{u.email || '—'}</td>
            <td className="px-4 py-2">
              <Select
                value={u.role}
                onChange={(e) => updateRole.mutate({ id: u.id, role: e.target.value })}
                className="w-36"
              >
                <option value="customer">{t('role.customer')}</option>
                <option value="agent">{t('role.agent')}</option>
                <option value="admin">{t('role.admin')}</option>
              </Select>
            </td>
          </tr>
        ))}
      </Table>
    </Card>
  )
}

export default function SettingsPage() {
  const { t } = useI18n()
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'

  const sections = [
    { id: 'profile', label: t('settings.nav.profile'), icon: UserIcon, Component: ProfileSection },
    { id: 'security', label: t('settings.nav.security'), icon: LockIcon, Component: PasswordSection },
    { id: 'notifications', label: t('settings.nav.notifications'), icon: BellIcon, Component: NotificationSection },
    isAdmin && { id: 'permissions', label: t('settings.nav.permissions'), icon: BadgeIcon, Component: PermissionsSection },
    isAdmin && { id: 'categories', label: t('settings.nav.categories'), icon: FolderOpenIcon, Component: CategoriesSection },
    isAdmin && { id: 'software-types', label: t('settings.nav.softwareTypes'), icon: BoardIcon, Component: SoftwareTypesSection },
    isAdmin && { id: 'users', label: t('settings.nav.userRoles'), icon: UsersIcon, Component: UserRolesSection },
  ].filter(Boolean)

  const [active, setActive] = useState(sections[0].id)
  const current = sections.find((s) => s.id === active) ?? sections[0]
  const Current = current.Component

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Breadcrumbs items={[{ label: t('crumb.dashboard'), to: '/dashboard' }, { label: t('settings.title') }]} />
        <h1 className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">{t('settings.title')}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {isAdmin ? t('settings.subtitle.admin') : t('settings.subtitle.user')}
        </p>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <nav className="lg:sticky lg:top-6 lg:w-56 lg:shrink-0">
          <div className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
            {sections.map((s) => {
              const Icon = s.icon
              const isActive = s.id === active
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setActive(s.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {s.label}
                </button>
              )
            })}
          </div>
        </nav>

        <div className="min-w-0 flex-1">
          <Current />
        </div>
      </div>
    </div>
  )
}
