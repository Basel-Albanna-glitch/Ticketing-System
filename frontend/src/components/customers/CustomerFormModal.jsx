import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import AvatarUploader from '../ui/AvatarUploader'
import Button from '../ui/Button'
import FileInput from '../ui/FileInput'
import Input from '../ui/Input'
import Modal from '../ui/Modal'
import Select from '../ui/Select'
import Table from '../ui/Table'
import Textarea from '../ui/Textarea'
import { PlusIcon } from '../ui/icons'
import { useI18n } from '../../i18n/useI18n'
import { useAuth } from '../../auth/useAuth'
import { deleteUserAvatar, uploadUserAvatar } from '../../api/users'
import { useCreateCustomer, useUpdateCustomerProfile } from '../../hooks/useCustomers'
import { useSoftwareTypes } from '../../hooks/useSoftwareTypes'

const EMPTY_FORM = {
  username: '',
  full_name: '',
  email: '',
  password: '',
  address: '',
  phone: '',
  tax_number: '',
  software_type: '',
}

const EMPTY_LICENSE = { name: '', start_date: '', end_date: '' }

const EMPTY_BRANCH = { name: '', address: '' }

const CELL_INPUT =
  'w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/15 dark:border-white/10 dark:bg-white/5 dark:text-gray-100'

function formToState(customer) {
  if (!customer) return { form: { ...EMPTY_FORM }, licenses: [], branches: [] }
  return {
    form: {
      username: customer.username || '',
      full_name: customer.full_name || '',
      email: customer.email || '',
      password: '',
      address: customer.address || '',
      phone: customer.phone || '',
      tax_number: customer.tax_number || '',
      software_type: customer.software_type || '',
    },
    licenses: (customer.licenses || []).map((l) => ({
      name: l.name || '',
      start_date: l.start_date || '',
      end_date: l.end_date || '',
    })),
    branches: (customer.branches || []).map((b) => ({
      name: b.name || '',
      address: b.address || '',
    })),
  }
}

export default function CustomerFormModal({ open, onClose, customer = null }) {
  const { t } = useI18n()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const isEdit = Boolean(customer)
  // Setting someone else's picture is admin-only, even where agents may edit customers.
  const canSetAvatar = user?.role === 'admin'
  const [avatar, setAvatar] = useState(customer?.avatar || null)
  // Picture picked while creating a customer, uploaded once the account has an id. If the
  // account saved but the picture didn't, createdId keeps a retry from creating a duplicate.
  const [pendingAvatar, setPendingAvatar] = useState(null)
  const [createdId, setCreatedId] = useState(null)
  const { data: softwareTypes } = useSoftwareTypes()
  const createCustomer = useCreateCustomer()
  const updateCustomer = useUpdateCustomerProfile()
  const [form, setForm] = useState(EMPTY_FORM)
  const [licenses, setLicenses] = useState([])
  const [branches, setBranches] = useState([])
  const [attachments, setAttachments] = useState([])
  const [error, setError] = useState('')

  // Re-seed the form whenever the modal opens (or the target customer changes).
  useEffect(() => {
    if (!open) return
    const { form: seededForm, licenses: seededLicenses, branches: seededBranches } =
      formToState(customer)
    setForm(seededForm)
    setLicenses(seededLicenses)
    setBranches(seededBranches)
    setAttachments([])
    setAvatar(customer?.avatar || null)
    setPendingAvatar(null)
    setCreatedId(null)
    setError('')
  }, [open, customer])

  function addLicense() {
    setLicenses([...licenses, { ...EMPTY_LICENSE }])
  }

  function updateLicense(index, field, value) {
    setLicenses(licenses.map((lic, i) => (i === index ? { ...lic, [field]: value } : lic)))
  }

  function removeLicense(index) {
    setLicenses(licenses.filter((_, i) => i !== index))
  }

  function addBranch() {
    setBranches([...branches, { ...EMPTY_BRANCH }])
  }

  function updateBranch(index, field, value) {
    setBranches(branches.map((b, i) => (i === index ? { ...b, [field]: value } : b)))
  }

  function removeBranch(index) {
    setBranches(branches.filter((_, i) => i !== index))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    const cleanedLicenses = licenses.filter((l) => l.name || l.start_date || l.end_date)
    const cleanedBranches = branches.filter((b) => b.name || b.address)
    const payload = {
      full_name: form.full_name,
      email: form.email,
      address: form.address,
      phone: form.phone,
      tax_number: form.tax_number,
      software_type: form.software_type,
      password: form.password,
      licenses: cleanedLicenses,
      branches: cleanedBranches,
      attachments,
    }
    try {
      let targetId = customer?.id || createdId
      if (targetId) {
        await updateCustomer.mutateAsync({ id: targetId, ...payload })
      } else {
        const created = await createCustomer.mutateAsync({ username: form.username, ...payload })
        targetId = created.id
      }
      if (pendingAvatar) {
        try {
          await uploadUserAvatar(targetId, pendingAvatar)
          queryClient.invalidateQueries({ queryKey: ['customers'] })
        } catch {
          // The account exists now, so don't fail the whole save — keep the modal open so
          // the picture can be retried without creating a second customer.
          setCreatedId(targetId)
          setError(t('settings.avatar.savedWithoutPicture'))
          return
        }
      }
      onClose()
    } catch {
      setError(isEdit ? t('customers.errorSave') : t('customers.errorCreate'))
    }
  }

  const pending = createCustomer.isPending || updateCustomer.isPending
  // Upload immediately once the account exists; before that the file is held locally.
  const avatarTargetId = customer?.id || createdId

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? t('customers.editCustomer') : t('customers.addCustomer')} size="xl">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {canSetAvatar && (
          <AvatarUploader
            name={form.full_name}
            src={avatar}
            size="lg"
            onUpload={
              avatarTargetId
                ? (file) => uploadUserAvatar(avatarTargetId, file).then((u) => setAvatar(u.avatar))
                : undefined
            }
            onSelect={avatarTargetId ? undefined : setPendingAvatar}
            onRemove={
              avatarTargetId
                ? () => deleteUserAvatar(avatarTargetId).then((u) => setAvatar(u.avatar))
                : undefined
            }
            onDone={() => queryClient.invalidateQueries({ queryKey: ['customers'] })}
            className="border-b border-gray-100 pb-4 dark:border-white/10"
          />
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {isEdit ? (
            <Input label={t('field.username')} value={form.username} disabled />
          ) : (
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
            label={`${t('field.email')} (${t('common.optional')})`}
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <Input
            label={isEdit ? `${t('customers.newPassword')} (${t('common.optional')})` : t('field.password')}
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required={!isEdit}
          />
          <Input
            label={t('field.phone')}
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
          <Input
            label={t('customers.taxNumber')}
            value={form.tax_number}
            onChange={(e) => setForm({ ...form, tax_number: e.target.value })}
          />
          <Select
            label={t('customers.softwareType')}
            value={form.software_type}
            onChange={(e) => setForm({ ...form, software_type: e.target.value })}
          >
            <option value="">{t('common.select')}</option>
            {(softwareTypes || []).map((st) => (
              <option key={st.id} value={st.name}>
                {st.name}
              </option>
            ))}
          </Select>
        </div>

        <Textarea
          label={t('field.address')}
          rows={2}
          value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
        />

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('customers.licenses')}</span>
            <Button type="button" variant="secondary" onClick={addLicense} className="whitespace-nowrap">
              <PlusIcon className="h-4 w-4" />
              {t('customers.addLicense')}
            </Button>
          </div>
          {licenses.length === 0 ? (
            <p className="text-xs text-gray-500 dark:text-gray-400">{t('customers.noLicensesYet')}</p>
          ) : (
            <Table columns={[t('customers.licenseName'), t('customers.startDate'), t('customers.endDate'), '']}>
              {licenses.map((lic, index) => (
                <tr key={index}>
                  <td className="px-4 py-2">
                    <input
                      className={CELL_INPUT}
                      placeholder={t('field.name')}
                      value={lic.name}
                      onChange={(e) => updateLicense(index, 'name', e.target.value)}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="date"
                      className={CELL_INPUT}
                      value={lic.start_date}
                      onChange={(e) => updateLicense(index, 'start_date', e.target.value)}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="date"
                      className={CELL_INPUT}
                      value={lic.end_date}
                      onChange={(e) => updateLicense(index, 'end_date', e.target.value)}
                    />
                  </td>
                  <td className="px-4 py-2 text-end">
                    <button
                      type="button"
                      onClick={() => removeLicense(index)}
                      className="text-xs font-medium text-red-600 hover:underline dark:text-red-400"
                    >
                      {t('common.remove')}
                    </button>
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('customers.branches')}</span>
            <Button type="button" variant="secondary" onClick={addBranch} className="whitespace-nowrap">
              <PlusIcon className="h-4 w-4" />
              {t('customers.addBranch')}
            </Button>
          </div>
          {branches.length === 0 ? (
            <p className="text-xs text-gray-500 dark:text-gray-400">{t('customers.noBranchesYet')}</p>
          ) : (
            <Table columns={[t('customers.branchName'), t('field.address'), '']}>
              {branches.map((b, index) => (
                <tr key={index}>
                  <td className="px-4 py-2">
                    <input
                      className={CELL_INPUT}
                      placeholder={t('field.name')}
                      value={b.name}
                      onChange={(e) => updateBranch(index, 'name', e.target.value)}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      className={CELL_INPUT}
                      placeholder={t('field.address')}
                      value={b.address}
                      onChange={(e) => updateBranch(index, 'address', e.target.value)}
                    />
                  </td>
                  <td className="px-4 py-2 text-end">
                    <button
                      type="button"
                      onClick={() => removeBranch(index)}
                      className="text-xs font-medium text-red-600 hover:underline dark:text-red-400"
                    >
                      {t('common.remove')}
                    </button>
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </div>

        <FileInput
          label={isEdit ? t('customers.addAttachments') : t('field.attachments')}
          files={attachments}
          onChange={setAttachments}
        />
        {isEdit && (
          <p className="-mt-2 text-xs text-gray-500 dark:text-gray-400">
            {t('customers.attachmentsNote')}
          </p>
        )}

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <Button type="submit" loading={pending}>
          {t('common.save')}
        </Button>
      </form>
    </Modal>
  )
}
