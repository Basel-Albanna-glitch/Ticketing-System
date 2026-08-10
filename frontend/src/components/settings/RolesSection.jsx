import { useEffect, useState } from 'react'

import Button from '../ui/Button'
import Card from '../ui/Card'
import Input from '../ui/Input'
import Modal from '../ui/Modal'
import Toggle from '../ui/Toggle'
import { PlusIcon, TrashIcon } from '../ui/icons'
import { DEFAULT_ON_FLAGS, PERMISSION_FIELDS, PERMISSION_GROUPS } from '../../constants/permissions'
import { useCreateRole, useDeleteRole, useRoles, useUpdateRole } from '../../hooks/useRoles'
import { useI18n } from '../../i18n/useI18n'

// A new role starts with the section-visibility flags on and everything else
// off, matching the model defaults — otherwise creating a role to grant one
// small permission would hide tickets, customers and projects from its holder.
const EMPTY = Object.fromEntries(
  PERMISSION_FIELDS.map((f) => [f.key, DEFAULT_ON_FLAGS.has(f.key)])
)

function RoleFormModal({ open, onClose, role }) {
  const { t } = useI18n()
  const createRole = useCreateRole()
  const updateRole = useUpdateRole()
  const isEdit = Boolean(role)
  const [form, setForm] = useState({ name: '', description: '', ...EMPTY })
  const [error, setError] = useState('')

  // Re-seed whenever the modal opens or the target role changes, so a previous
  // edit never bleeds into the next one.
  useEffect(() => {
    if (!open) return
    setError('')
    setForm({
      name: role?.name || '',
      description: role?.description || '',
      // Editing mirrors the stored role exactly; creating starts from EMPTY, so
      // the default-on section flags survive rather than being reset to false.
      ...(role
        ? Object.fromEntries(PERMISSION_FIELDS.map((f) => [f.key, Boolean(role[f.key])]))
        : EMPTY),
    })
  }, [open, role])

  const granted = PERMISSION_FIELDS.filter((f) => form[f.key]).length

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    try {
      if (isEdit) await updateRole.mutateAsync({ id: role.id, ...form })
      else await createRole.mutateAsync(form)
      onClose()
    } catch (err) {
      const detail = err?.response?.data
      setError(
        detail && typeof detail === 'object' && !Array.isArray(detail)
          ? Object.entries(detail)
              .map(([field, messages]) => `${field}: ${[].concat(messages).join(' ')}`)
              .join(' · ')
          : t('settings.roles.errorSave')
      )
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? t('settings.roles.editRole') : t('settings.roles.addRole')}
      size="xl"
      dismissOnBackdrop={false}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <Input
          label={t('settings.roles.name')}
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
        <Input
          label={`${t('settings.roles.description')} (${t('common.optional')})`}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />

        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('settings.roles.permissionsHint')}
          </p>
          {PERMISSION_GROUPS.map((group) => (
            <div key={group.titleKey} className="flex flex-col gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-200">
                <group.icon className="h-4 w-4 text-indigo-500" />
                {t(group.titleKey)}
              </div>
              {group.fields.map((field) => (
                <label
                  key={field.key}
                  className="flex items-center justify-between gap-4 rounded-xl border border-gray-200/70 px-3 py-2 dark:border-white/10"
                >
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {t(`settings.permissions.${field.i18n}.label`)}
                  </span>
                  <Toggle
                    checked={Boolean(form[field.key])}
                    onChange={() => setForm((prev) => ({ ...prev, [field.key]: !prev[field.key] }))}
                  />
                </label>
              ))}
            </div>
          ))}
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {t('settings.roles.grantedCount').replace('{n}', granted)}
          </span>
          <div className="flex gap-3">
            <Button type="button" variant="secondary" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={createRole.isPending || updateRole.isPending}>
              {t('common.save')}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  )
}

export default function RolesSection() {
  const { t } = useI18n()
  const { data: roles, isLoading } = useRoles()
  const deleteRole = useDeleteRole()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)

  function openCreate() {
    setEditing(null)
    setModalOpen(true)
  }

  function openEdit(role) {
    setEditing(role)
    setModalOpen(true)
  }

  async function handleDelete(role) {
    // Holders revert to the site-wide defaults rather than losing access
    // entirely, but that still changes what they can do — so confirm, and say
    // how many people it affects.
    const message = role.user_count
      ? t('settings.roles.confirmDeleteInUse')
          .replace('{name}', role.name)
          .replace('{n}', role.user_count)
      : t('settings.roles.confirmDelete').replace('{name}', role.name)
    if (!window.confirm(message)) return
    await deleteRole.mutateAsync(role.id)
  }

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {t('settings.roles.title')}
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t('settings.roles.subtitle')}
          </p>
        </div>
        <Button onClick={openCreate}>
          <span className="flex items-center gap-2">
            <PlusIcon className="h-4 w-4" />
            {t('settings.roles.addRole')}
          </span>
        </Button>
      </div>

      {isLoading && <p className="text-sm text-gray-500 dark:text-gray-400">{t('common.loading')}</p>}

      {!isLoading && (roles || []).length === 0 && (
        <p className="rounded-xl border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-500 dark:border-white/10 dark:text-gray-400">
          {t('settings.roles.empty')}
        </p>
      )}

      <div className="flex flex-col gap-3">
        {(roles || []).map((role) => {
          const granted = PERMISSION_FIELDS.filter((f) => role[f.key])
          return (
            <div
              key={role.id}
              className="flex flex-col gap-2 rounded-2xl border border-gray-200/70 p-4 dark:border-white/10"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 dark:text-gray-100">{role.name}</p>
                  {role.description && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">{role.description}</p>
                  )}
                  <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                    {t('settings.roles.userCount').replace('{n}', role.user_count ?? 0)}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button variant="secondary" onClick={() => openEdit(role)}>
                    {t('common.edit')}
                  </Button>
                  <Button
                    variant="secondary"
                    title={t('common.delete')}
                    aria-label={`${t('common.delete')} ${role.name}`}
                    onClick={() => handleDelete(role)}
                  >
                    <TrashIcon className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {granted.length === 0 ? (
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    {t('settings.roles.noPermissions')}
                  </span>
                ) : (
                  granted.map((f) => (
                    <span
                      key={f.key}
                      className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300"
                    >
                      {t(`settings.permissions.${f.i18n}.label`)}
                    </span>
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>

      <RoleFormModal open={modalOpen} onClose={() => setModalOpen(false)} role={editing} />
    </Card>
  )
}
