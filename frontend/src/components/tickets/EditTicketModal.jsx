import { useEffect, useState } from 'react'
import Button from '../ui/Button'
import Input from '../ui/Input'
import Modal from '../ui/Modal'
import Select from '../ui/Select'
import Textarea from '../ui/Textarea'
import CategoryCascader from './CategoryCascader'
import { useCategories } from '../../hooks/useCategories'
import { useUpdateTicket } from '../../hooks/useTicket'
import { useI18n } from '../../i18n/useI18n'

// Admin-only modal to edit a ticket's core details: subject, description, category,
// priority and start date. Assignment, status, due date and customer are handled by
// their own dedicated actions elsewhere on the page.
// `id` is the ticket id from the route params — the same value the page's useTicket()
// query is keyed by — so cache invalidation after saving matches and the page refreshes.
export default function EditTicketModal({ open, onClose, ticket, id }) {
  const { t } = useI18n()
  const { data: categories } = useCategories()
  const updateTicket = useUpdateTicket(id ?? ticket.id)
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [priority, setPriority] = useState('medium')
  const [startDate, setStartDate] = useState('')
  const [error, setError] = useState('')

  // Seed the form from the ticket each time the modal opens.
  useEffect(() => {
    if (open) {
      setSubject(ticket.subject || '')
      setDescription(ticket.description || '')
      setCategory(ticket.category?.id ? String(ticket.category.id) : '')
      setPriority(ticket.priority || 'medium')
      setStartDate(ticket.start_date || '')
      setError('')
    }
  }, [open, ticket])

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    try {
      await updateTicket.mutateAsync({
        subject,
        description,
        category_id: category ? Number(category) : null,
        priority,
        start_date: startDate || null,
      })
      onClose()
    } catch (err) {
      const data = err?.response?.data
      setError(data ? Object.values(data).flat().join(' ') : t('tickets.editDetailsError'))
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={t('tickets.editDetails')} size="lg">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input label={t('field.subject')} value={subject} onChange={(e) => setSubject(e.target.value)} required />
        <Textarea
          label={t('field.description')}
          rows={5}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
        />
        <CategoryCascader
          categories={categories || []}
          value={category}
          onChange={setCategory}
          required
        />
        <Select label={t('field.priority')} value={priority} onChange={(e) => setPriority(e.target.value)}>
          <option value="low">{t('priority.low')}</option>
          <option value="medium">{t('priority.medium')}</option>
          <option value="high">{t('priority.high')}</option>
          <option value="urgent">{t('priority.urgent')}</option>
        </Select>
        <Input
          label={t('field.startDate')}
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex gap-2">
          <Button type="submit" loading={updateTicket.isPending}>
            {t('common.save')}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
