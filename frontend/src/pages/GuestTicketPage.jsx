import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import GuestShell from '../components/layout/GuestShell'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import Textarea from '../components/ui/Textarea'
import FileInput from '../components/ui/FileInput'
import CategoryCascader from '../components/tickets/CategoryCascader'
import { CheckCircleIcon } from '../components/ui/icons'
import { createGuestTicket, fetchPublicCategories } from '../api/tickets'
import { useI18n } from '../i18n/useI18n'

export default function GuestTicketPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [categories, setCategories] = useState([])
  const [form, setForm] = useState({
    guestName: '',
    guestCompany: '',
    hasBranch: false,
    guestBranch: '',
    guestPhone: '',
    guestEmail: '',
    category: '',
    priority: 'medium',
    subject: '',
    description: '',
  })
  const [files, setFiles] = useState([])
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [created, setCreated] = useState(null)

  useEffect(() => {
    fetchPublicCategories()
      .then(setCategories)
      .catch(() => setCategories([]))
  }, [])

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      // An unticked box must never submit a branch, even if one was typed and then hidden.
      const ticket = await createGuestTicket({
        ...form,
        guestBranch: form.hasBranch ? form.guestBranch.trim() : '',
        attachments: files,
      })
      setCreated(ticket)
    } catch (err) {
      const data = err?.response?.data
      setError(data ? Object.values(data).flat().join(' ') : t('guest.submit.error'))
    } finally {
      setSubmitting(false)
    }
  }

  if (created) {
    return (
      <GuestShell title={t('guest.success.title')} subtitle={t('guest.success.subtitle')}>
        <Card>
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
              <CheckCircleIcon className="h-7 w-7" />
            </span>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-300">{t('guest.success.refIs')}</p>
              <p className="font-mono text-3xl font-bold text-indigo-600 dark:text-indigo-400">
                #{created.id}
              </p>
              {created.reference && (
                <p className="mt-1 break-all font-mono text-xs text-gray-400 dark:text-gray-400">
                  {created.reference}
                </p>
              )}
            </div>
            <p className="max-w-sm text-sm text-gray-600 dark:text-gray-300">
              {t('guest.success.saveNote')}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={() => navigate(`/guest/track?ref=${created.id}`)}>{t('guest.success.trackThis')}</Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setCreated(null)
                  setForm({ guestName: '', guestCompany: '', hasBranch: false, guestBranch: '', guestPhone: '', guestEmail: '', category: '', priority: 'medium', subject: '', description: '' })
                  setFiles([])
                }}
              >
                {t('guest.success.submitAnother')}
              </Button>
            </div>
          </div>
        </Card>
      </GuestShell>
    )
  }

  return (
    <GuestShell
      title={t('guest.submit.title')}
      subtitle={t('guest.submit.subtitle')}
      footer={
        <>
          {t('guest.submit.haveReference')}{' '}
          <Link to="/guest/track" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
            {t('guest.trackTicket')}
          </Link>
        </>
      }
    >
      <Card>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label={t('guest.field.yourName')}
              value={form.guestName}
              onChange={(e) => set('guestName', e.target.value)}
              required
            />
            <Input
              label={t('field.phone')}
              name="guestPhone"
              type="tel"
              placeholder={t('guest.field.phonePlaceholder')}
              hint={t('guest.field.phoneHint')}
              value={form.guestPhone}
              onChange={(e) => set('guestPhone', e.target.value)}
              required
            />
          </div>
          <Input
            label={t('guest.field.company')}
            value={form.guestCompany}
            onChange={(e) => set('guestCompany', e.target.value)}
          />
          <div className="flex flex-col gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                className="h-4 w-4 accent-indigo-600"
                checked={form.hasBranch}
                onChange={(e) =>
                  // Clearing on untick keeps the hidden value from lingering in state.
                  setForm((f) => ({
                    ...f,
                    hasBranch: e.target.checked,
                    guestBranch: e.target.checked ? f.guestBranch : '',
                  }))
                }
              />
              {t('guest.field.hasBranch')}
            </label>
            {form.hasBranch && (
              <Input
                label={t('guest.field.branchName')}
                placeholder={t('guest.field.branchPlaceholder')}
                value={form.guestBranch}
                onChange={(e) => set('guestBranch', e.target.value)}
                required
              />
            )}
          </div>
          <Input
            label={t('guest.field.emailOptional')}
            type="email"
            placeholder={t('guest.field.emailPlaceholder')}
            value={form.guestEmail}
            onChange={(e) => set('guestEmail', e.target.value)}
          />
          <CategoryCascader
            categories={categories}
            value={form.category}
            onChange={(v) => set('category', v)}
            label={t('field.category')}
            required
          />
          <Input
            label={t('field.subject')}
            value={form.subject}
            onChange={(e) => set('subject', e.target.value)}
            required
          />
          <Textarea
            label={t('guest.field.describeIssue')}
            rows={5}
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            required
          />
          <Select
            label={t('field.priority')}
            value={form.priority}
            onChange={(e) => set('priority', e.target.value)}
          >
            <option value="low">{t('priority.low')}</option>
            <option value="medium">{t('priority.medium')}</option>
            <option value="high">{t('priority.high')}</option>
            <option value="urgent">{t('priority.urgent')}</option>
          </Select>
          <FileInput label={t('guest.field.attachmentsOptional')} files={files} onChange={setFiles} />
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <Button type="submit" loading={submitting} className="self-start">
            {t('guest.submit.button')}
          </Button>
        </form>
      </Card>
    </GuestShell>
  )
}
