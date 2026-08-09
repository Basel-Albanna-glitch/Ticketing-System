import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import AvatarUploader from '../components/ui/AvatarUploader'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import FileInput from '../components/ui/FileInput'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import Table from '../components/ui/Table'
import Textarea from '../components/ui/Textarea'
import Toggle from '../components/ui/Toggle'
import {
  PlusIcon,
  UserIcon,
  LockIcon,
  BellIcon,
  BadgeIcon,
  BookIcon,
  ChatIcon,
  FolderOpenIcon,
  TrashIcon,
  BoardIcon,
  TicketIcon,
  UsersIcon,
} from '../components/ui/icons'
import Breadcrumbs from '../components/ui/Breadcrumbs'
import Pagination from '../components/ui/Pagination'
import SearchBar from '../components/ui/SearchBar'
import SectionHeader from '../components/ui/SectionHeader'
import Spinner from '../components/ui/Spinner'
import PriorityBadge from '../components/tickets/PriorityBadge'
import CategoryCascader from '../components/tickets/CategoryCascader'
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
import {
  useArticles,
  useCreateArticle,
  useDeleteArticle,
  useUpdateArticle,
} from '../hooks/useArticles'
import {
  deleteArticleAttachment,
  fetchArticle,
  uploadArticleAttachments,
} from '../api/articles'
import { deleteMyAvatar, uploadMyAvatar } from '../api/auth'
import { useAllUsers, useUpdateUserRole } from '../hooks/useUsers'
import { useTicketSettings, useUpdateTicketSettings } from '../hooks/useTicketSettings'
import { buildCategoryTree, getSelfAndDescendantIds } from '../utils/categoryTree'
import { sortRows, useTableSort } from '../utils/tableSort'
import { usePagedRows } from '../utils/tablePage'
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
      <AvatarUploader
        name={user?.full_name}
        src={user?.avatar}
        onUpload={uploadMyAvatar}
        onRemove={deleteMyAvatar}
        onDone={refreshUser}
        className="mb-6 border-b border-gray-100 pb-6 dark:border-white/10"
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

// One switchable row. `disabled` covers "we can't email you at all" — the toggle stays
// visible so the preference is still readable, it just can't be acted on.
function PreferenceRow({ icon: Icon, label, hint, checked, disabled, onChange }) {
  return (
    <div className="flex items-start justify-between gap-4 py-4 first:pt-0 last:pb-0">
      <div className="flex min-w-0 gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{label}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-gray-500 dark:text-gray-400">{hint}</p>
        </div>
      </div>
      <Toggle checked={checked} disabled={disabled} onChange={onChange} aria-label={label} />
    </div>
  )
}

function NotificationSection() {
  const { t } = useI18n()
  const { user } = useAuth()
  const { data, isLoading } = useNotificationPreferences()
  const updatePrefs = useUpdateNotificationPreferences()

  if (isLoading || !data) {
    return (
      <Card>
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      </Card>
    )
  }

  // Without an address on the account there is nowhere to send any of this.
  const hasEmail = Boolean(user?.email)

  const rows = [
    {
      key: 'email_on_new_comment',
      icon: ChatIcon,
      label: t('settings.notifications.newComment.label'),
      hint: t('settings.notifications.newComment.hint'),
    },
    {
      key: 'email_on_status_change',
      icon: TicketIcon,
      label: t('settings.notifications.statusChange.label'),
      hint: t('settings.notifications.statusChange.hint'),
    },
    // Assignment only ever targets an agent, so hide it from customers.
    user?.role !== 'customer' && {
      key: 'email_on_assignment',
      icon: BadgeIcon,
      label: t('settings.notifications.assignment.label'),
      hint: t('settings.notifications.assignment.hint'),
    },
    // Only admins and customers are in the expiry mail; agents never are.
    user?.role !== 'agent' && {
      key: 'email_on_license_expiry',
      icon: BadgeIcon,
      label: t('settings.notifications.licenseExpiry.label'),
      hint: t('settings.notifications.licenseExpiry.hint'),
    },
  ].filter(Boolean)

  const allOff = rows.every((row) => !data[row.key])

  return (
    <Card>
      <SectionHeader
        icon={BellIcon}
        title={t('settings.notifications.title')}
        description={t('settings.notifications.description')}
        action={
          updatePrefs.isPending ? (
            <span className="text-xs text-gray-400 dark:text-gray-500">{t('common.loading')}</span>
          ) : updatePrefs.isSuccess ? (
            <span className="text-xs text-green-600 dark:text-green-400">
              {t('settings.notifications.saved')}
            </span>
          ) : null
        }
      />

      {!hasEmail && (
        <p className="mb-4 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700 ring-1 ring-inset ring-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/20">
          {t('settings.notifications.noEmail')}
        </p>
      )}

      <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
        {t('settings.notifications.emailGroup')}
      </p>
      <div className="flex flex-col divide-y divide-gray-100 dark:divide-white/10">
        {rows.map((row) => (
          <PreferenceRow
            key={row.key}
            icon={row.icon}
            label={row.label}
            hint={row.hint}
            checked={data[row.key]}
            disabled={!hasEmail || updatePrefs.isPending}
            onChange={(next) => updatePrefs.mutate({ [row.key]: next })}
          />
        ))}
      </div>

      <p className="mt-4 border-t border-gray-100 pt-4 text-xs text-gray-500 dark:border-white/10 dark:text-gray-400">
        {allOff && hasEmail
          ? t('settings.notifications.allOff')
          : t('settings.notifications.inAppNote')}
      </p>
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
  // The tree is already flattened to depth-tagged rows, so a page can start mid-branch —
  // the indent still shows the level, and the parent is one page back.
  const { pageRows: categoryRows, ...categoryPager } = usePagedRows(tree)
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
        {categoryRows.map((category) => (
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
      <Pagination {...categoryPager} onPageChange={categoryPager.setPage} />

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
  const { pageRows: softwareTypeRows, ...softwareTypePager } = usePagedRows(softwareTypes)
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
        <>
        <Table columns={[t('field.name'), '']}>
          {softwareTypeRows.map((softwareType) => (
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
        <Pagination {...softwareTypePager} onPageChange={softwareTypePager.setPage} />
        </>
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

// Agent permission toggles, grouped by area. `i18n` maps to the
// settings.permissions.<i18n>.label / .hint translation keys.
const PERMISSION_GROUPS = [
  {
    icon: TicketIcon,
    titleKey: 'settings.permissions.group.tickets',
    fields: [
      { key: 'allow_agent_self_assign', i18n: 'selfAssign' },
      { key: 'allow_agent_reassign', i18n: 'reassign' },
      { key: 'allow_agent_edit_after_close', i18n: 'editAfterClose' },
      { key: 'allow_agent_delete', i18n: 'deleteTicket' },
    ],
  },
  {
    icon: UsersIcon,
    titleKey: 'settings.permissions.group.customers',
    fields: [
      { key: 'allow_agent_create_customers', i18n: 'createCustomers' },
      { key: 'allow_agent_edit_customers', i18n: 'editCustomers' },
      { key: 'allow_agent_link_customer', i18n: 'linkCustomer' },
    ],
  },
  {
    icon: BookIcon,
    titleKey: 'settings.permissions.group.kb',
    fields: [{ key: 'allow_agent_manage_kb', i18n: 'manageKb' }],
  },
  {
    icon: BoardIcon,
    titleKey: 'settings.permissions.group.projects',
    fields: [
      { key: 'allow_agent_assign_projects', i18n: 'assignProjects' },
      { key: 'allow_agent_unassign_projects', i18n: 'unassignProjects' },
      { key: 'allow_agent_assign_tasks', i18n: 'assignTasks' },
    ],
  },
]

const PERMISSION_FIELDS = PERMISSION_GROUPS.flatMap((g) => g.fields)

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
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {PERMISSION_GROUPS.map((group) => (
          <div key={group.titleKey}>
            <div className="mb-1 flex items-center gap-2">
              <group.icon className="h-4 w-4 text-gray-400 dark:text-gray-500" />
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                {t(group.titleKey)}
              </h3>
            </div>
            <div className="divide-y divide-gray-100 rounded-xl border border-gray-200/70 dark:divide-white/5 dark:border-white/10">
              {group.fields.map((f) => (
                <div key={f.key} className="flex items-center justify-between gap-4 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                      {t(`settings.permissions.${f.i18n}.label`)}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
                      {t(`settings.permissions.${f.i18n}.hint`)}
                    </p>
                  </div>
                  <Toggle
                    checked={form[f.key]}
                    onChange={() => toggle(f.key)}
                    aria-label={t(`settings.permissions.${f.i18n}.label`)}
                  />
                </div>
              ))}
            </div>
          </div>
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
  const { pageRows, ...pager } = usePagedRows(rows)

  return (
    <Card>
      <SectionHeader
        icon={UsersIcon}
        title={t('settings.userRoles.title')}
        description={t('settings.userRoles.description')}
        action={<SearchBar value={search} onChange={setSearch} placeholder={t('settings.userRoles.searchPlaceholder')} />}
      />
      <Table columns={columns} sortBy={sortBy} sortDir={sortDir} onSort={onSort}>
        {pageRows.map((u) => (
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
      <Pagination {...pager} onPageChange={pager.setPage} />
    </Card>
  )
}

function ArticlesSection() {
  const { t } = useI18n()
  const { data: articles } = useArticles()
  const { data: categories } = useCategories()
  const createArticle = useCreateArticle()
  const updateArticle = useUpdateArticle()
  const deleteArticle = useDeleteArticle()
  const { pageRows: articleRows, ...articlePager } = usePagedRows(articles)
  const formRef = useRef(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [isPublished, setIsPublished] = useState(true)
  const [editingId, setEditingId] = useState(null)
  // Files already on the article being edited, and newly picked ones waiting for save.
  const [attachments, setAttachments] = useState([])
  const [newFiles, setNewFiles] = useState([])
  const [error, setError] = useState('')

  function focusForm() {
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  function resetForm() {
    setEditingId(null)
    setTitle('')
    setBody('')
    setCategoryId('')
    setIsPublished(true)
    setAttachments([])
    setNewFiles([])
    setError('')
  }

  async function startEdit(article) {
    // The list omits the body, so fetch the full article to edit it.
    const full = await fetchArticle(article.id)
    setEditingId(full.id)
    setTitle(full.title)
    setBody(full.body)
    setCategoryId(full.category?.id ? String(full.category.id) : '')
    setIsPublished(full.is_published)
    setAttachments(full.attachments || [])
    setNewFiles([])
    setError('')
    focusForm()
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    const payload = {
      title,
      body,
      category_id: categoryId ? Number(categoryId) : null,
      is_published: isPublished,
    }
    try {
      let articleId = editingId
      if (articleId) {
        await updateArticle.mutateAsync({ id: articleId, ...payload })
      } else {
        const created = await createArticle.mutateAsync(payload)
        articleId = created.id
      }
      if (newFiles.length) {
        // The article exists by now, so a failed upload shouldn't undo the save — keep the
        // form open on the saved article so the files can be retried.
        try {
          await uploadArticleAttachments(articleId, newFiles)
        } catch {
          const full = await fetchArticle(articleId)
          setEditingId(articleId)
          setAttachments(full.attachments || [])
          setNewFiles([])
          setError(t('settings.kb.attachmentError'))
          return
        }
      }
      resetForm()
    } catch (err) {
      const data = err?.response?.data
      setError(data ? Object.values(data).flat().join(' ') : t('settings.kb.saveError'))
    }
  }

  async function removeAttachment(attachmentId) {
    setError('')
    try {
      await deleteArticleAttachment(editingId, attachmentId)
      setAttachments((current) => current.filter((a) => a.id !== attachmentId))
    } catch {
      setError(t('settings.kb.attachmentError'))
    }
  }

  async function handleDelete(id) {
    setError('')
    try {
      await deleteArticle.mutateAsync(id)
      if (editingId === id) resetForm()
    } catch {
      setError(t('settings.kb.deleteError'))
    }
  }

  return (
    <Card>
      <SectionHeader
        icon={BookIcon}
        title={t('settings.kb.title')}
        description={t('settings.kb.description')}
      />
      {articles?.length ? (
        <>
        <Table columns={[t('field.title'), t('field.category'), t('field.status'), '']}>
          {articleRows.map((a) => (
            <tr key={a.id}>
              <td className="px-4 py-2 font-medium text-gray-900 dark:text-gray-100">{a.title}</td>
              <td className="px-4 py-2 text-gray-600 dark:text-gray-300">{a.category?.name || '—'}</td>
              <td className="px-4 py-2">
                <Badge color={a.is_published ? 'green' : 'amber'}>
                  {a.is_published ? t('kb.published') : t('kb.draft')}
                </Badge>
              </td>
              <td className="px-4 py-2 text-end">
                <div className="flex justify-end gap-2">
                  <Button variant="secondary" onClick={() => startEdit(a)}>
                    {t('common.edit')}
                  </Button>
                  <Button variant="danger" onClick={() => handleDelete(a.id)}>
                    {t('common.delete')}
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </Table>
        <Pagination {...articlePager} onPageChange={articlePager.setPage} />
        </>
      ) : (
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('settings.kb.empty')}</p>
      )}

      <form ref={formRef} onSubmit={handleSubmit} className="mt-6 flex max-w-xl flex-col gap-4">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {editingId ? t('settings.kb.editTitle') : t('settings.kb.addTitle')}
        </p>
        <Input label={t('field.title')} value={title} onChange={(e) => setTitle(e.target.value)} required />
        <CategoryCascader
          categories={categories || []}
          value={categoryId}
          onChange={setCategoryId}
          label={`${t('field.category')} (${t('common.optional')})`}
        />
        <Textarea label={t('field.content')} rows={8} value={body} onChange={(e) => setBody(e.target.value)} required />
        {attachments.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('kb.attachments')}
            </span>
            <ul className="flex flex-wrap gap-2">
              {attachments.map((a) => (
                <li
                  key={a.id}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200/70 bg-white px-2.5 py-1.5 text-sm text-gray-700 dark:border-white/10 dark:bg-white/5 dark:text-gray-200"
                >
                  <a href={a.file} target="_blank" rel="noreferrer" className="hover:underline">
                    {a.original_filename}
                  </a>
                  <button
                    type="button"
                    onClick={() => removeAttachment(a.id)}
                    aria-label={t('common.remove')}
                    className="text-gray-400 transition-colors hover:text-red-600 dark:hover:text-red-400"
                  >
                    <TrashIcon className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        <FileInput
          label={`${t('settings.kb.addFiles')} (${t('common.optional')})`}
          files={newFiles}
          onChange={setNewFiles}
        />
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input
            type="checkbox"
            className="accent-indigo-600"
            checked={isPublished}
            onChange={(e) => setIsPublished(e.target.checked)}
          />
          {t('settings.kb.published')}
        </label>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex gap-2">
          <Button type="submit" loading={createArticle.isPending || updateArticle.isPending}>
            {editingId ? t('settings.kb.update') : t('settings.kb.add')}
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

export default function SettingsPage() {
  const { t } = useI18n()
  const { user } = useAuth()
  const { data: ticketSettings } = useTicketSettings()
  const [searchParams] = useSearchParams()
  const isAdmin = user?.role === 'admin'
  // Agents can manage the knowledge base when an admin has granted the permission.
  const canManageKb = isAdmin || (user?.role === 'agent' && ticketSettings?.allow_agent_manage_kb)

  const sections = [
    { id: 'profile', label: t('settings.nav.profile'), icon: UserIcon, Component: ProfileSection },
    { id: 'security', label: t('settings.nav.security'), icon: LockIcon, Component: PasswordSection },
    { id: 'notifications', label: t('settings.nav.notifications'), icon: BellIcon, Component: NotificationSection },
    isAdmin && { id: 'permissions', label: t('settings.nav.permissions'), icon: BadgeIcon, Component: PermissionsSection },
    isAdmin && { id: 'categories', label: t('settings.nav.categories'), icon: FolderOpenIcon, Component: CategoriesSection },
    canManageKb && { id: 'kb', label: t('settings.nav.kb'), icon: BookIcon, Component: ArticlesSection },
    isAdmin && { id: 'software-types', label: t('settings.nav.softwareTypes'), icon: BoardIcon, Component: SoftwareTypesSection },
    isAdmin && { id: 'users', label: t('settings.nav.userRoles'), icon: UsersIcon, Component: UserRolesSection },
  ].filter(Boolean)

  // Allow deep-linking to a section, e.g. /settings?section=categories.
  const requestedSection = searchParams.get('section')
  const [active, setActive] = useState(() =>
    sections.some((s) => s.id === requestedSection) ? requestedSection : sections[0].id
  )
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
