import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import FileInput from '../components/ui/FileInput'
import Input from '../components/ui/Input'
import SearchableSelect from '../components/ui/SearchableSelect'
import Select from '../components/ui/Select'
import Textarea from '../components/ui/Textarea'
import { CheckCircleIcon, PlusIcon } from '../components/ui/icons'
import Breadcrumbs from '../components/ui/Breadcrumbs'
import PriorityBadge from '../components/tickets/PriorityBadge'
import CategoryCascader from '../components/tickets/CategoryCascader'
import CustomerFormModal from '../components/customers/CustomerFormModal'
import { useAuth } from '../auth/useAuth'
import { usePermissions } from '../auth/usePermissions'
import { useAgents } from '../hooks/useAgents'
import { useCategories } from '../hooks/useCategories'
import { useCustomers, useMyProfile } from '../hooks/useCustomers'
import { createTicket } from '../api/tickets'
import { useI18n } from '../i18n/useI18n'

// Local calendar date (YYYY-MM-DD) for the current day — used as the default start date.
function todayLocal() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export default function TicketCreatePage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const isStaff = user?.role === 'admin' || user?.role === 'agent'
  const isAdmin = user?.role === 'admin'
  // Staff always choose the priority. A customer does only if their record allows it, and the
  // server drops it otherwise; `!== false` keeps the field for a session loaded before the
  // switch existed.
  const canChoosePriority = isStaff || user?.can_set_ticket_priority !== false
  const { data: categories } = useCategories()
  const { data: customers } = useCustomers({ enabled: isStaff })
  // A customer picks from their own branches, which come with their profile.
  const { data: myProfile } = useMyProfile({ enabled: !isStaff })
  const { data: agents } = useAgents({ enabled: isAdmin, includeAdmins: true })
  const permissions = usePermissions()
  // Mirrors the backend rule in accounts/views.py: creating a customer is
  // admin-only unless settings open it up to agents. Offering the shortcut to
  // anyone else would just produce a 403 after they filled the whole form.
  const canCreateCustomers = !!permissions.allow_agent_create_customers
  const [customerModalOpen, setCustomerModalOpen] = useState(false)
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [priority, setPriority] = useState('medium')
  const [customerId, setCustomerId] = useState('')
  const [branchId, setBranchId] = useState('')
  const [startDate, setStartDate] = useState(todayLocal())
  const [assignedAgentIds, setAssignedAgentIds] = useState([])
  const [attachments, setAttachments] = useState([])
  const [error, setError] = useState('')
  const [createdTicket, setCreatedTicket] = useState(null)

  const selectedCategory = (categories || []).find((c) => String(c.id) === String(category))
  const selectedCustomer = (customers || []).find((c) => String(c.id) === String(customerId))
  // Staff see the chosen customer's branches; a customer sees their own.
  const branchOptions = ((isStaff ? selectedCustomer : myProfile)?.branches || []).map((b) => ({
    value: b.id,
    label: b.address ? `${b.name} — ${b.address}` : b.name,
  }))

  // Changing the customer resets the branch, since branches belong to a specific customer.
  function handleCustomerChange(value) {
    setCustomerId(value)
    setBranchId('')
  }

  const mutation = useMutation({
    mutationFn: createTicket,
    onSuccess: (ticket) => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      setCreatedTicket(ticket)
    },
    onError: (err) => {
      const data = err?.response?.data
      setError(data ? Object.values(data).flat().join(' ') : t('tickets.createError'))
    },
  })

  function handleSubmit(event) {
    event.preventDefault()
    setError('')
    if (isStaff && !customerId) {
      setError(t('tickets.selectCustomer'))
      return
    }
    // A customer with branches says which one the ticket is for. Required here rather than on
    // the server, which still accepts no branch so the mobile app (whose customer form has no
    // branch picker) keeps working; the server does refuse a branch that isn't theirs.
    if (!isStaff && branchOptions.length > 0 && !branchId) {
      setError(t('tickets.branchRequired'))
      return
    }
    // The subject must contain actual text (any language), not just numbers or symbols.
    if (!/\p{L}/u.test(subject)) {
      setError(t('tickets.subjectMustContainText'))
      return
    }
    mutation.mutate({ subject, description, category, priority, customerId, branchId, startDate, assignedAgentIds, attachments })
  }

  function toggleAgent(id) {
    setAssignedAgentIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  function resetForm() {
    setSubject('')
    setDescription('')
    setCategory('')
    setPriority('medium')
    setCustomerId('')
    setBranchId('')
    setStartDate(todayLocal())
    setAssignedAgentIds([])
    setAttachments([])
    setError('')
    setCreatedTicket(null)
  }

  if (createdTicket) {
    return (
      <div className="mx-auto max-w-xl">
        <Card className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-300">
            <CheckCircleIcon className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              {t('tickets.createdSuccess')}
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-300">
              {t('tickets.keepReference')}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200/70 bg-gray-50 px-6 py-4 dark:border-white/10 dark:bg-white/5">
            <p className="text-xs uppercase tracking-wide text-gray-400 dark:text-gray-400">
              {t('tickets.ticketNumber')}
            </p>
            <p className="font-mono text-3xl font-bold text-indigo-600 dark:text-indigo-400">
              #{createdTicket.id}
            </p>
            {createdTicket.reference && (
              <p className="mt-1 break-all font-mono text-xs text-gray-400 dark:text-gray-400">
                {createdTicket.reference}
              </p>
            )}
          </div>
          <p className="max-w-sm text-sm text-gray-600 dark:text-gray-300">
            <span className="font-medium text-gray-900 dark:text-gray-100">{createdTicket.subject}</span>
          </p>
          <div className="mt-2 flex gap-3">
            <Button onClick={() => navigate(`/tickets/${createdTicket.id}`)}>{t('tickets.viewTicket')}</Button>
            <Button variant="secondary" onClick={resetForm}>
              {t('tickets.createAnother')}
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto w-1/2 [&_input]:py-3 [&_input]:text-base [&_label]:text-[15px] [&_select]:py-3 [&_select]:text-base [&_textarea]:py-3 [&_textarea]:text-base">
      <Breadcrumbs
        items={[
          { label: t('crumb.dashboard'), to: '/dashboard' },
          { label: t('nav.tickets'), to: '/tickets' },
          { label: t('tickets.newTicket') },
        ]}
      />
      <h1 className="mb-6 text-3xl font-semibold text-gray-900 dark:text-gray-100">{t('tickets.create')}</h1>
      <Card className="p-6 sm:p-8">
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          {isStaff && (
            <div className="flex items-end gap-2">
              <div className="min-w-0 flex-1">
                <SearchableSelect
                  label={t('field.customer')}
                  value={customerId}
                  onChange={handleCustomerChange}
                  placeholder={t('tickets.selectCustomer')}
                  options={(customers || []).map((c) => ({
                    value: c.id,
                    label: `${c.full_name} (${c.username})`,
                  }))}
                />
              </div>
              {/* A modal rather than a link to /customers: the ticket being
                  written would be lost on navigation. */}
              {canCreateCustomers && (
                <Button
                  type="button"
                  variant="secondary"
                  title={t('customers.addCustomer')}
                  aria-label={t('customers.addCustomer')}
                  onClick={() => setCustomerModalOpen(true)}
                >
                  <PlusIcon className="h-5 w-5" />
                </Button>
              )}
            </div>
          )}
          {branchOptions.length > 0 && (
            <SearchableSelect
              // Optional for staff; a customer with branches must choose one.
              label={isStaff ? t('tickets.branch') : `${t('tickets.branch')} *`}
              value={branchId}
              onChange={setBranchId}
              placeholder={t('tickets.selectBranch')}
              options={branchOptions}
            />
          )}
          <CategoryCascader
            categories={categories || []}
            value={category}
            onChange={setCategory}
            required
          />
          {/* The admin-set priority is for staff; a customer only states their own below. */}
          {isStaff && selectedCategory && (
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              <span>{t('tickets.categoryPriorityByAdmin')}</span>
              <PriorityBadge priority={selectedCategory.priority} variant="outline" />
            </div>
          )}
          <Input label={t('field.subject')} value={subject} onChange={(e) => setSubject(e.target.value)} required />
          <Textarea
            label={t('field.description')}
            rows={7}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Only staff choose a start date; a customer's ticket always starts on its
                creation date (enforced server-side). */}
            {isStaff && (
              <Input
                label={t('field.startDate')}
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            )}
            {canChoosePriority && (
              <Select label={t('field.priority')} value={priority} onChange={(e) => setPriority(e.target.value)}>
                <option value="low">{t('priority.low')}</option>
                <option value="medium">{t('priority.medium')}</option>
                <option value="high">{t('priority.high')}</option>
                <option value="urgent">{t('priority.urgent')}</option>
              </Select>
            )}
          </div>
          <FileInput label={t('tickets.attachment')} files={attachments} onChange={setAttachments} />
          {isAdmin && (
            <div className="flex flex-col gap-2">
              <SearchableSelect
                label={`${t('tickets.assignToAgents')} (${t('common.optional')})`}
                value=""
                onChange={(value) => {
                  if (value) toggleAgent(String(value))
                }}
                placeholder={t('tickets.selectAgent')}
                options={(agents || [])
                  .filter((a) => !assignedAgentIds.includes(String(a.id)))
                  .map((a) => ({ value: a.id, label: a.full_name }))}
              />
              {assignedAgentIds.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {assignedAgentIds.map((id, index) => {
                    const agent = (agents || []).find((a) => String(a.id) === id)
                    return (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 py-1 ps-3 pe-1.5 text-sm text-indigo-700 ring-1 ring-inset ring-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-300"
                      >
                        {agent?.full_name || id}
                        {index === 0 && (
                          <span className="rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300">
                            {t('tickets.primary')}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => toggleAgent(id)}
                          className="flex h-5 w-5 items-center justify-center rounded-full text-indigo-500 hover:bg-indigo-100 hover:text-indigo-700 dark:hover:bg-indigo-500/20"
                          aria-label={`${t('common.remove')} ${agent?.full_name || t('role.agent')}`}
                        >
                          ✕
                        </button>
                      </span>
                    )
                  })}
                </div>
              )}
              {assignedAgentIds.length > 1 && (
                <p className="text-xs text-gray-500 dark:text-gray-300">
                  {t('tickets.primaryHint')}
                </p>
              )}
            </div>
          )}
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <div className="[&_button]:w-full [&_button]:py-3 [&_button]:text-base">
            <Button type="submit" loading={mutation.isPending}>
              {t('common.submit')}
            </Button>
          </div>
        </form>
      </Card>

      {/* Selecting the new customer relies on the modal invalidating the
          customers query, so the option exists by the time it is picked. */}
      <CustomerFormModal
        open={customerModalOpen}
        onClose={() => setCustomerModalOpen(false)}
        onCreated={(id) => handleCustomerChange(String(id))}
      />
    </div>
  )
}
