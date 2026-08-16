import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import ActivityTimeline from '../components/tickets/ActivityTimeline'
import AttachmentList from '../components/tickets/AttachmentList'
import CommentThread from '../components/tickets/CommentThread'
import PhaseList from '../components/tickets/PhaseList'
import EditTicketModal from '../components/tickets/EditTicketModal'
import PriorityBadge from '../components/tickets/PriorityBadge'
import StatusBadge from '../components/tickets/StatusBadge'
import Breadcrumbs from '../components/ui/Breadcrumbs'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Input from '../components/ui/Input'
import SearchableSelect from '../components/ui/SearchableSelect'
import Select from '../components/ui/Select'
import Spinner from '../components/ui/Spinner'
import Textarea from '../components/ui/Textarea'
import SectionHeader from '../components/ui/SectionHeader'
import {
  BadgeIcon,
  BoardIcon,
  BookIcon,
  CalendarIcon,
  ChatIcon,
  CheckCircleIcon,
  ClockIcon,
  FolderOpenIcon,
  LockIcon,
  PaperClipIcon,
  SettingsIcon,
  StarIcon,
  TicketIcon,
  TrashIcon,
  UserIcon,
  UsersIcon,
} from '../components/ui/icons'
import { useAuth } from '../auth/useAuth'
import { usePermissions } from '../auth/usePermissions'
import { useAgents } from '../hooks/useAgents'
import { useCustomers } from '../hooks/useCustomers'
import {
  useAssignTicket,
  useDeleteTicket,
  useSetTicketArticles,
  useSetTicketCollaborators,
  useSetTicketCustomer,
  useSetTicketDeadline,
  useTicket,
  useTicketActivity,
  useUpdateTicket,
  useUpdateTicketStatus,
} from '../hooks/useTicket'
import { useArticles } from '../hooks/useArticles'
import { useI18n } from '../i18n/useI18n'
import { elapsedFor, formatElapsed, isTicketRunning } from '../utils/elapsed'

// Local calendar date (YYYY-MM-DD) for the current day — for comparing against start_date.
function todayLocal() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// ISO datetime -> value for <input type="datetime-local"> (local time, minute precision).
function toDateTimeLocal(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// Small labelled group inside the Actions card. `tone="danger"` sets the destructive group
// apart, so deleting a ticket doesn't look like just another dropdown.
function ActionGroup({ label, tone = 'default', children }) {
  const danger = tone === 'danger'
  return (
    <div
      className={`flex flex-col gap-2 border-t pt-4 first:border-0 first:pt-0 ${
        danger
          ? 'mt-2 border-red-200/70 dark:border-red-500/20'
          : 'border-gray-100 dark:border-white/10'
      }`}
    >
      {label && (
        <span
          className={`text-xs font-medium uppercase tracking-wide ${
            danger ? 'text-red-600 dark:text-red-400' : 'text-gray-400 dark:text-gray-400'
          }`}
        >
          {label}
        </span>
      )}
      {children}
    </div>
  )
}

// Collaborator name chips. `onRemove` is omitted for viewers who can only read them,
// which is what turns the ✕ off.
function CollaboratorChips({ collaborators, onRemove, removeLabel }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {collaborators.map((c) => (
        <span
          key={c.id}
          className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700 ring-1 ring-inset ring-gray-500/15 dark:bg-white/10 dark:text-gray-200 dark:ring-white/10"
        >
          {c.full_name}
          {onRemove && (
            <button
              type="button"
              onClick={() => onRemove(c.id)}
              className="text-gray-400 hover:text-red-600 dark:hover:text-red-400"
              aria-label={`${removeLabel} ${c.full_name}`}
            >
              ✕
            </button>
          )}
        </span>
      ))}
    </div>
  )
}

function MetaItem({ icon: Icon, children }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-gray-500 dark:text-gray-300">
      <Icon className="h-3.5 w-3.5 text-gray-400 dark:text-gray-400" />
      {children}
    </span>
  )
}

// One labelled row in the Details card: an indigo icon chip + micro label + value.
// Rows are separated by hairline dividers (skipped on the first row).
function DetailRow({ icon: Icon, label, children }) {
  return (
    <div className="flex items-start gap-3 border-t border-gray-100 py-3 first:border-0 first:pt-0 dark:border-white/5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 ring-1 ring-inset ring-indigo-500/10 dark:bg-indigo-500/10 dark:text-indigo-300 dark:ring-indigo-400/20">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <dt className="text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-400">
          {label}
        </dt>
        <dd className="mt-0.5 break-words text-sm text-gray-800 dark:text-gray-200">{children}</dd>
      </div>
    </div>
  )
}

export default function TicketDetailPage() {
  const { t } = useI18n()
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data: ticket, isLoading, error } = useTicket(id)
  const { data: activities } = useTicketActivity(id)
  const { data: agents } = useAgents({ includeAdmins: true })
  const { data: customers } = useCustomers({ enabled: user?.role !== 'customer' })
  const permissions = usePermissions()
  const updateStatus = useUpdateTicketStatus(id)
  const updateTicket = useUpdateTicket(id)
  const assignTicket = useAssignTicket(id)
  const setDeadline = useSetTicketDeadline(id)
  const setCollaborators = useSetTicketCollaborators(id)
  const setArticles = useSetTicketArticles(id)
  const { data: allArticles } = useArticles()
  const setTicketCustomer = useSetTicketCustomer(id)
  const deleteTicket = useDeleteTicket(id)
  const [status, setStatus] = useState('')
  const [categoryPriority, setCategoryPriority] = useState('')
  const [holdReason, setHoldReason] = useState('')
  const [agentId, setAgentId] = useState('')
  const [notice, setNotice] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [customerBranchId, setCustomerBranchId] = useState('')
  const [reassignId, setReassignId] = useState('')
  // An already-assigned ticket shows its agent as settled fact; the picker only comes
  // back once the admin asks to change it.
  const [editingAssignee, setEditingAssignee] = useState(false)
  const [collaboratorId, setCollaboratorId] = useState('')
  const [articleToAdd, setArticleToAdd] = useState('')
  const [deadline, setDeadlineInput] = useState('')
  const [editOpen, setEditOpen] = useState(false)
  // The activity log is reference material, not something you read on arrival.
  const [showActivity, setShowActivity] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  // How long this ticket has been running — the same counter the guest tracker shows, so
  // staff and customer are looking at the same number. Ticks only while it's still open.
  const elapsed = elapsedFor(ticket, now)
  const ticking = isTicketRunning(ticket)
  useEffect(() => {
    if (!ticking) return undefined
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [ticking])

  // The status box mirrors the ticket's own status, so a fresh page load — or a change
  // someone else made — shows where the ticket actually stands instead of an empty prompt.
  // Keyed on the server values, so a selection in progress survives the 15s poll.
  const serverStatus = ticket?.status
  const serverHoldReason = ticket?.hold_reason
  const serverAssignedId = ticket?.assigned_agent?.id ?? null
  useEffect(() => {
    if (!serverStatus) return
    // "Open" is this app's word for nobody having taken the ticket, so it isn't a state an
    // assigned ticket can sit in — assigning doesn't move the status off it either. Leave
    // the box empty there and let the agent say where the work actually stands.
    const shown = serverAssignedId && serverStatus === 'open' ? '' : serverStatus
    setStatus(shown)
    setHoldReason(shown === 'on_hold' ? serverHoldReason || '' : '')
  }, [serverStatus, serverHoldReason, serverAssignedId])

  // Same idea for the category-priority override. Empty means "inherit from the category",
  // which is what a ticket does until someone deliberately lifts it off that level.
  const serverCategoryOverride = ticket?.category_priority_override ?? ''
  useEffect(() => {
    setCategoryPriority(serverCategoryOverride)
  }, [serverCategoryOverride])

  // Auto-dismiss the action confirmation after a few seconds.
  useEffect(() => {
    if (!notice) return undefined
    const timer = setTimeout(() => setNotice(''), 5000)
    return () => clearTimeout(timer)
  }, [notice])

  // The ticket was deleted (or never existed) — don't render stale, actionable data.
  if (error?.response?.status === 404) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {t('tickets.notFound')}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-300">{t('tickets.notFoundHint')}</p>
        <Button className="mt-4" onClick={() => navigate('/tickets')}>
          {t('nav.tickets')}
        </Button>
      </div>
    )
  }

  if (isLoading || !ticket) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    )
  }

  const isOverdue =
    ticket.due_at &&
    new Date(ticket.due_at) < new Date() &&
    !['resolved', 'closed'].includes(ticket.status)
  // The ticket has a future start date — its work hasn't begun yet, so actions are
  // locked until that date arrives. start_date is a plain calendar date (YYYY-MM-DD),
  // so a lexicographic compare against today's local date is exact. Admins bypass the
  // lock so they can set the ticket up before its start date.
  const notStarted =
    user?.role !== 'admin' && ticket.start_date && ticket.start_date > todayLocal()
  const canAssign = user?.role === 'admin'
  const isCustomer = user?.role === 'customer'
  const isAssignedToMe = ticket.assigned_agent?.id === user?.id
  const collaborators = ticket.collaborators || []
  const collaboratorIds = collaborators.map((c) => c.id)
  const isCollaborator = collaboratorIds.includes(user?.id)
  const isAdmin = user?.role === 'admin'
  // A closed ticket is locked for everyone but admins. Agents can also edit a closed
  // ticket only when an admin has enabled that permission; customers never can.
  // Admins can always reopen/edit.
  const closedLocked =
    ticket.status === 'closed' && !permissions.allow_agent_edit_after_close
  // Admin, the assigned agent, or an added collaborator may edit; other agents are
  // read-only — and nobody but an admin may edit once the ticket is closed & locked.
  const canEdit = (isAdmin || isAssignedToMe || isCollaborator) && !closedLocked
  // Delete: admin or the agent the ticket is assigned to.
  // Admins always; the assigned agent only when the delete permission is enabled — and,
  // like every other change, never once the ticket is closed & locked.
  const canDelete =
    (isAdmin || isAssignedToMe) && !!permissions.allow_agent_delete && !closedLocked
  // Watching agent = an agent who is neither assigned nor a collaborator (read-only view).
  const isWatchingAgent = user?.role === 'agent' && !isAssignedToMe && !isCollaborator
  // Customers reply on their own tickets; admins, the assigned agent, and collaborators too.
  const canReply =
    (isAdmin || user?.role === 'customer' || isAssignedToMe || isCollaborator) && !closedLocked
  // Phases record the staff-side work, so customers read them but never log them.
  const canLogPhases = (isAdmin || isAssignedToMe || isCollaborator) && !closedLocked
  // Agents can claim an unassigned ticket, but can't unassign themselves once they take it.
  // A closed & locked ticket blocks these too — only an admin can change a closed ticket.
  const canSelfAssign =
    user?.role === 'agent' &&
    permissions.allow_agent_self_assign &&
    ticket.assigned_agent === null &&
    !closedLocked
  const canReassign =
    user?.role === 'agent' &&
    permissions.allow_agent_reassign &&
    isAssignedToMe &&
    !closedLocked
  // Guest-origin tickets carry contact details even after being linked to a customer.
  const isGuestOrigin = Boolean(
    ticket.guest_name || ticket.guest_phone || ticket.guest_email || ticket.guest_company
  )
  // Linking/changing a guest ticket's customer follows its own permission: admins always,
  // agents only when it's enabled — and never on a closed & locked ticket.
  const canManageTicketCustomer =
    !!permissions.allow_agent_link_customer && !closedLocked
  const canLinkCustomer = canManageTicketCustomer && isGuestOrigin && !ticket.customer
  const canUnlinkCustomer = canManageTicketCustomer && isGuestOrigin && Boolean(ticket.customer)
  const hasActions =
    canAssign || canSelfAssign || canReassign || canEdit || canDelete ||
    canLinkCustomer || canUnlinkCustomer

  // Branches of the customer currently chosen in the link picker.
  const linkCustomer = (customers || []).find((c) => String(c.id) === String(customerId))
  const linkBranchOptions = (linkCustomer?.branches || []).map((b) => ({
    value: b.id,
    label: b.address ? `${b.name} — ${b.address}` : b.name,
  }))

  // Show a confirmation banner at the top of the page for any ticket change.
  function showNotice(message) {
    setNotice(message)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleUpdateStatus() {
    if (!status) return
    updateStatus.mutate(
      { status, holdReason: status === 'on_hold' ? holdReason : undefined },
      // The status/hold-reason boxes resync from the refetched ticket, so nothing to reset here.
      { onSuccess: () => showNotice(t('tickets.noticeStatusUpdated')) }
    )
  }

  // Lifts this one ticket off its category's priority — the category itself, and every
  // other ticket in it, are untouched. Empty hands the ticket back to the category.
  function handleUpdateCategoryPriority() {
    if (categoryPriority === serverCategoryOverride) return
    updateTicket.mutate(
      { category_priority_override: categoryPriority || null },
      { onSuccess: () => showNotice(t('tickets.noticePriorityUpdated')) }
    )
  }

  function handleLinkCustomerChange(value) {
    setCustomerId(value)
    setCustomerBranchId('')
  }

  function handleLinkCustomer() {
    if (customerId) {
      setTicketCustomer.mutate(
        { customer: customerId, branch: customerBranchId },
        {
          onSuccess: () => {
            setCustomerId('')
            setCustomerBranchId('')
            showNotice(t('tickets.noticeCustomerLinked'))
          },
        }
      )
    }
  }

  function handleRemoveCustomer() {
    setTicketCustomer.mutate(
      { customer: '' },
      { onSuccess: () => showNotice(t('tickets.noticeCustomerRemoved')) }
    )
  }

  function agentNameById(aid) {
    return (agents || []).find((a) => String(a.id) === String(aid))?.full_name || ''
  }

  function noticeAssignedTo(name) {
    showNotice(`${t('tickets.assignedTo')} ${name}`)
  }

  // Assignment decides who owns the ticket and who gets notified, and an agent can't undo
  // taking one, so every assign action asks first.
  const ticketLabel = ticket.reference || `#${ticket.id}`

  function handleAssign() {
    if (agentId) {
      const name = agentNameById(agentId)
      if (
        !window.confirm(
          `${t('tickets.confirmAssignPrefix')}${ticketLabel}${t('tickets.confirmAssignMiddle')}${name}${t('tickets.confirmAssignSuffix')}`
        )
      )
        return
      assignTicket.mutate(agentId, {
        onSuccess: () => {
          noticeAssignedTo(name)
          setAgentId('')
          setEditingAssignee(false)
        },
      })
    }
  }

  // Open the picker on the current agent, so changing an assignment starts from who
  // has it now rather than from a blank field.
  function handleEditAssignee() {
    setAgentId(ticket.assigned_agent?.id ?? '')
    setEditingAssignee(true)
  }

  function handleCancelEditAssignee() {
    setAgentId('')
    setEditingAssignee(false)
  }

  function handleSelfAssign() {
    if (
      !window.confirm(
        `${t('tickets.confirmSelfAssignPrefix')}${ticketLabel}${t('tickets.confirmSelfAssignSuffix')}`
      )
    )
      return
    assignTicket.mutate(user.id, { onSuccess: () => noticeAssignedTo(user.full_name) })
  }

  function handleReassign() {
    if (reassignId) {
      if (
        !window.confirm(
          `${t('tickets.confirmReassignPrefix')}${ticketLabel}${t('tickets.confirmReassignMiddle')}${agentNameById(reassignId)}${t('tickets.confirmReassignSuffix')}`
        )
      )
        return
      // After handing off, this agent loses access to the ticket, so return to the list.
      assignTicket.mutate(reassignId, { onSuccess: () => navigate('/tickets') })
    }
  }

  function handleSetDeadline() {
    if (deadline) {
      setDeadline.mutate(deadline, {
        onSuccess: () => showNotice(t('tickets.noticeDueDateSet')),
      })
      setDeadlineInput('')
    }
  }

  function handleDelete() {
    if (
      !window.confirm(
        `${t('tickets.confirmDeletePrefix')}${ticket.reference || `#${ticket.id}`}${t('tickets.confirmDeleteSuffix')}`
      )
    )
      return
    deleteTicket.mutate(undefined, { onSuccess: () => navigate('/tickets') })
  }

  function handleAddCollaborator() {
    if (collaboratorId && !collaboratorIds.includes(Number(collaboratorId))) {
      setCollaborators.mutate([...collaboratorIds, Number(collaboratorId)], {
        onSuccess: () => showNotice(t('tickets.noticeCollaboratorAdded')),
      })
      setCollaboratorId('')
    }
  }

  function handleRemoveCollaborator(removeId) {
    setCollaborators.mutate(collaboratorIds.filter((cid) => cid !== removeId), {
      onSuccess: () => showNotice(t('tickets.noticeCollaboratorRemoved')),
    })
  }

  // Agents eligible to be added as collaborators: exclude the primary assignee and any
  // already-added collaborators.
  const availableCollaborators = (agents || []).filter(
    (a) => a.id !== ticket.assigned_agent?.id && !collaboratorIds.includes(a.id)
  )

  // Related knowledge-base articles.
  const linkedArticles = ticket.articles || []
  const articleIds = linkedArticles.map((a) => a.id)
  // Only offer articles filed under the ticket's own category — the help that actually
  // relates to the issue. Already-linked articles keep showing regardless of category.
  const availableArticles = (allArticles || []).filter(
    (a) => !articleIds.includes(a.id) && a.category?.id === ticket.category?.id
  )
  const canManageArticles = isAdmin || user?.role === 'agent'

  function handleAddArticle(value) {
    const aid = Number(value)
    if (aid && !articleIds.includes(aid)) {
      setArticles.mutate([...articleIds, aid], {
        onSuccess: () => showNotice(t('tickets.noticeArticleLinked')),
      })
    }
    setArticleToAdd('')
  }

  function handleRemoveArticle(removeId) {
    setArticles.mutate(
      articleIds.filter((x) => x !== removeId),
      { onSuccess: () => showNotice(t('tickets.noticeArticleUnlinked')) }
    )
  }

  // Once a ticket has an owner, the open question is when it's due — so this group leads
  // the Actions card. On an unassigned ticket it stays put, below status.
  const dueDateGroup = canEdit ? (
    <ActionGroup label={t('field.dueDate')}>
      <Input
        type="datetime-local"
        value={deadline || toDateTimeLocal(ticket.due_at)}
        onChange={(e) => setDeadlineInput(e.target.value)}
      />
      <div className="flex gap-2">
        <Button onClick={handleSetDeadline} loading={setDeadline.isPending} disabled={!deadline}>
          {t('tickets.setDueDate')}
        </Button>
        {ticket.due_at && (
          <Button
            variant="secondary"
            onClick={() => {
              setDeadline.mutate(null, {
                onSuccess: () => showNotice(t('tickets.noticeDueDateCleared')),
              })
              setDeadlineInput('')
            }}
            loading={setDeadline.isPending}
          >
            {t('tickets.clear')}
          </Button>
        )}
      </div>
    </ActionGroup>
  ) : null

  return (
    <div className="flex flex-col gap-4 lg:min-h-0 lg:flex-1 lg:overflow-hidden">
      <Breadcrumbs
        items={[
          { label: t('crumb.dashboard'), to: '/dashboard' },
          { label: t('nav.tickets'), to: '/tickets' },
          { label: ticket.reference || `#${ticket.id}` },
        ]}
      />
      {notice && (
        <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800 dark:border-green-900/50 dark:bg-green-900/20 dark:text-green-300">
          <CheckCircleIcon className="h-4 w-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}
      {isWatchingAgent && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-300">
          <UserIcon className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {t('tickets.watchingPrefix')}
            {ticket.assigned_agent?.full_name || t('tickets.theAssignedAgent')}
            {t('tickets.watchingSuffix')}
          </span>
        </div>
      )}
      {closedLocked && (
        <div className="flex items-start gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-300">
          <LockIcon className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{t('tickets.closedLocked')}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:min-h-0 lg:flex-1 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2 lg:min-h-0 lg:overflow-y-auto lg:pe-1">
          {/* Hero header */}
          <Card className="relative overflow-hidden">
            {/* Ambient indigo glow — premium depth without noise */}
            <div
              aria-hidden
              className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-indigo-500/10 blur-3xl dark:bg-indigo-500/20"
            />
            <div className="relative">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-gray-100 px-2 py-0.5 font-mono text-xs font-medium text-gray-500 dark:bg-white/10 dark:text-gray-300">
                  {ticket.reference || `#${ticket.id}`}
                </span>
                {ticket.reference && (
                  <span className="rounded-md bg-gray-100 px-2 py-0.5 font-mono text-xs font-medium text-gray-500 dark:bg-white/10 dark:text-gray-300">
                    #{ticket.id}
                  </span>
                )}
                <PriorityBadge priority={ticket.priority} />
                <StatusBadge status={ticket.status} assigned={Boolean(ticket.assigned_agent)} />
                {isOverdue && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-500/20 dark:bg-red-900/40 dark:text-red-300">
                    <ClockIcon className="h-3 w-3" />
                    {t('tickets.overdue')}
                  </span>
                )}
              </div>
              <h1 className="mt-3 text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
                {ticket.subject}
              </h1>

              <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs">
                <MetaItem icon={UserIcon}>
                  {ticket.customer
                    ? ticket.customer.full_name
                    : `${ticket.guest_name || t('tickets.guest')} (${t('tickets.guest')})`}
                </MetaItem>
                <MetaItem icon={FolderOpenIcon}>{ticket.category?.name}</MetaItem>
                <MetaItem icon={CalendarIcon}>
                  {t('field.createdAt')} {new Date(ticket.created_at).toLocaleDateString()}
                </MetaItem>
              </div>

              <div className="mt-5">
                <span className="text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-400">
                  {t('field.description')}
                </span>
                <div className="mt-1.5 rounded-xl border border-gray-100 bg-gray-50/70 p-4 dark:border-white/10 dark:bg-white/5">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                    {ticket.description}
                  </p>
                </div>
              </div>

              {ticket.status === 'on_hold' && ticket.hold_reason && (
                <div className="mt-4 flex items-start gap-2 rounded-xl border border-purple-200 bg-purple-50 px-3 py-2 text-sm text-purple-800 dark:border-purple-900/50 dark:bg-purple-900/20 dark:text-purple-200">
                  <ClockIcon className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    <span className="font-medium">{t('tickets.onHold')}</span> {ticket.hold_reason}
                  </span>
                </div>
              )}

            </div>
          </Card>

          {ticket.attachments?.length > 0 && (
            <Card>
              <SectionHeader
                icon={PaperClipIcon}
                title={`${t('field.attachments')} (${ticket.attachments.length})`}
              />
              <AttachmentList attachments={ticket.attachments} />
            </Card>
          )}

          <Card>
            <SectionHeader
              icon={ChatIcon}
              title={
                ticket.comments?.length
                  ? `${t('tickets.comments')} (${ticket.comments.length})`
                  : t('tickets.comments')
              }
            />
            <CommentThread ticketId={ticket.id} comments={ticket.comments} canReply={canReply} />
          </Card>

          <Card>
            <SectionHeader
              icon={BoardIcon}
              title={
                ticket.phases?.length
                  ? `${t('tickets.phases')} (${ticket.phases.length})`
                  : t('tickets.phases')
              }
              description={t('tickets.phasesDescription')}
            />
            <PhaseList ticketId={ticket.id} phases={ticket.phases} canAdd={canLogPhases} />
          </Card>

          <Card>
            <SectionHeader
              icon={ClockIcon}
              title={
                activities?.length
                  ? `${t('tickets.activityHistory')} (${activities.length})`
                  : t('tickets.activityHistory')
              }
              className={showActivity ? undefined : 'mb-0 border-b-0 pb-0'}
              action={
                <button
                  type="button"
                  onClick={() => setShowActivity((v) => !v)}
                  className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                >
                  {showActivity ? t('common.hide') : t('common.show')}
                </button>
              }
            />
            {showActivity && <ActivityTimeline activities={activities} />}
          </Card>
        </div>

        <div className="flex flex-col gap-6 lg:min-h-0 lg:overflow-y-auto lg:pe-1">
          <Card>
            <SectionHeader
              icon={TicketIcon}
              title={t('tickets.details')}
              action={
                isAdmin && (
                  <Button variant="secondary" onClick={() => setEditOpen(true)}>
                    {t('tickets.editDetails')}
                  </Button>
                )
              }
            />
            <dl className="flex flex-col">
              <DetailRow
                icon={UserIcon}
                label={ticket.customer ? t('field.customer') : t('tickets.guest')}
              >
                <div className="flex flex-col gap-1.5">
                  {ticket.customer && (
                    <span>{`${ticket.customer.full_name} (@${ticket.customer.username})`}</span>
                  )}
                  {isGuestOrigin && (
                    <span className="flex flex-col gap-0.5">
                      {ticket.customer && (
                        <span className="text-[10px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-400">
                          {t('tickets.guest')}
                        </span>
                      )}
                      <span>{ticket.guest_name || t('tickets.guest')}</span>
                      {ticket.guest_company && (
                        <span className="text-xs text-gray-500 dark:text-gray-300">🏢 {ticket.guest_company}</span>
                      )}
                      {/* Kept here even when a real branch is linked below: this is what the
                          guest actually typed, which is worth seeing next to the rest. */}
                      {ticket.guest_branch && (
                        <span className="text-xs text-gray-500 dark:text-gray-300">🏬 {ticket.guest_branch}</span>
                      )}
                      {ticket.guest_phone && (
                        <span className="text-xs text-gray-500 dark:text-gray-300">📞 {ticket.guest_phone}</span>
                      )}
                      {ticket.guest_email && (
                        <span className="text-xs text-gray-500 dark:text-gray-300">✉ {ticket.guest_email}</span>
                      )}
                    </span>
                  )}
                </div>
              </DetailRow>

              <DetailRow icon={FolderOpenIcon} label={t('field.category')}>
                {ticket.category?.name}
              </DetailRow>

              {ticket.category_priority && (
                <DetailRow icon={StarIcon} label={t('tickets.categoryPriority')}>
                  <PriorityBadge priority={ticket.category_priority} variant="outline" />
                  {ticket.category_priority_override && (
                    <span className="mt-0.5 block text-xs text-gray-400 dark:text-gray-400">
                      {t('tickets.categoryPriorityHint')}
                    </span>
                  )}
                </DetailRow>
              )}

              {ticket.branch && (
                <DetailRow icon={BadgeIcon} label={t('tickets.branch')}>
                  {ticket.branch.name}
                  {ticket.branch.address ? ` — ${ticket.branch.address}` : ''}
                </DetailRow>
              )}

              {!isCustomer && (
                <DetailRow icon={UserIcon} label={t('field.assignedAgent')}>
                  {ticket.assigned_agent?.full_name || (
                    <span className="text-gray-400 dark:text-gray-400">{t('status.open')}</span>
                  )}
                  {ticket.assigned_agent && ticket.assigned_at && (
                    <span className="mt-0.5 block text-xs text-gray-400 dark:text-gray-400">
                      {t('field.assignedOn')} {new Date(ticket.assigned_at).toLocaleString()}
                    </span>
                  )}
                </DetailRow>
              )}

              {!isCustomer && (
                <DetailRow icon={UsersIcon} label={t('tickets.collaboratingAgents')}>
                  {collaborators.length ? (
                    <CollaboratorChips
                      collaborators={collaborators}
                      onRemove={canAssign ? handleRemoveCollaborator : null}
                      removeLabel={t('common.remove')}
                    />
                  ) : (
                    <span className="text-gray-400 dark:text-gray-400">{t('tickets.none')}</span>
                  )}
                </DetailRow>
              )}

              <DetailRow icon={CalendarIcon} label={t('field.createdAt')}>
                {new Date(ticket.created_at).toLocaleString()}
              </DetailRow>

              {elapsed && (
                <DetailRow
                  icon={ClockIcon}
                  label={elapsed.settled ? t('tickets.resolvedIn') : t('tickets.openFor')}
                >
                  <span className="font-medium tabular-nums">{formatElapsed(elapsed.ms, t)}</span>
                  {elapsed.settled && (
                    <span className="mt-0.5 block text-xs text-gray-400 dark:text-gray-400">
                      {new Date(ticket.resolved_at || ticket.closed_at).toLocaleString()}
                    </span>
                  )}
                </DetailRow>
              )}

              <DetailRow icon={CalendarIcon} label={t('field.startDate')}>
                {ticket.start_date ? (
                  new Date(ticket.start_date).toLocaleDateString()
                ) : (
                  <span className="text-gray-400 dark:text-gray-400">{t('tickets.none')}</span>
                )}
              </DetailRow>

              <DetailRow icon={ClockIcon} label={t('field.dueDate')}>
                {ticket.due_at ? (
                  <span
                    className={
                      isOverdue ? 'font-medium text-red-600 dark:text-red-400' : undefined
                    }
                  >
                    {new Date(ticket.due_at).toLocaleString()}
                    {isOverdue && (
                      <span className="ms-2 rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/40 dark:text-red-300">
                        {t('tickets.overdue')}
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="text-gray-400 dark:text-gray-400">{t('tickets.none')}</span>
                )}
              </DetailRow>

              {ticket.rating != null && (
                <DetailRow icon={StarIcon} label={t('rate.rating')}>
                  <span className="flex items-center gap-1 text-amber-400">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <StarIcon key={n} filled={n <= ticket.rating} className="h-4 w-4" />
                    ))}
                    <span className="ms-1 text-sm text-gray-600 dark:text-gray-300">
                      {ticket.rating}/5
                    </span>
                  </span>
                  {ticket.rating_comment && (
                    <span className="mt-1 block whitespace-pre-wrap text-sm text-gray-600 dark:text-gray-300">
                      “{ticket.rating_comment}”
                    </span>
                  )}
                </DetailRow>
              )}

              {canManageArticles && (
                <DetailRow icon={BookIcon} label={t('tickets.relatedArticles')}>
                  {linkedArticles.length ? (
                    <div className="flex flex-col gap-1.5">
                      {linkedArticles.map((a) => (
                        <span key={a.id} className="flex items-center gap-1.5">
                          <Link
                            to={`/kb/${a.id}`}
                            className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                          >
                            {a.title}
                          </Link>
                          {canManageArticles && (
                            <button
                              type="button"
                              onClick={() => handleRemoveArticle(a.id)}
                              className="text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                              aria-label={`${t('common.remove')} ${a.title}`}
                            >
                              ✕
                            </button>
                          )}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-gray-400 dark:text-gray-400">{t('tickets.none')}</span>
                  )}
                </DetailRow>
              )}
            </dl>
          </Card>

          {hasActions && (
            <Card>
              <SectionHeader icon={SettingsIcon} title={t('common.actions')} />
              {notStarted && (
                <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-300">
                  <LockIcon className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    {t('tickets.actionsLockedUntilStart')} (
                    {new Date(ticket.start_date).toLocaleDateString()})
                  </span>
                </div>
              )}
              <fieldset
                disabled={notStarted}
                className={`flex min-w-0 flex-col gap-4 ${
                  notStarted ? 'pointer-events-none opacity-60' : ''
                }`}
              >
                {ticket.assigned_agent && dueDateGroup}

                {(canLinkCustomer || canUnlinkCustomer) && (
                  <ActionGroup label={t('field.customer')}>
                    {canUnlinkCustomer ? (
                      <Button
                        variant="secondary"
                        onClick={handleRemoveCustomer}
                        loading={setTicketCustomer.isPending}
                      >
                        {t('tickets.editCustomer')}
                      </Button>
                    ) : (
                      <>
                        <SearchableSelect
                          value={customerId}
                          onChange={handleLinkCustomerChange}
                          placeholder={t('tickets.selectCustomer')}
                          options={(customers || []).map((c) => ({
                            value: c.id,
                            label: `${c.full_name} (@${c.username})`,
                          }))}
                        />
                        {linkBranchOptions.length > 0 && (
                          <SearchableSelect
                            value={customerBranchId}
                            onChange={setCustomerBranchId}
                            placeholder={t('tickets.selectBranch')}
                            options={linkBranchOptions}
                          />
                        )}
                        <Button
                          onClick={handleLinkCustomer}
                          loading={setTicketCustomer.isPending}
                          disabled={!customerId}
                        >
                          {t('tickets.linkCustomer')}
                        </Button>
                      </>
                    )}
                  </ActionGroup>
                )}

                {canAssign && (
                  <ActionGroup label={t('tickets.assignAgent')}>
                    {ticket.assigned_agent && !editingAssignee ? (
                      <>
                        <div className="truncate rounded-xl border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 dark:border-white/10 dark:bg-white/5 dark:text-gray-100">
                          {ticket.assigned_agent.full_name}
                        </div>
                        <Button variant="secondary" onClick={handleEditAssignee}>
                          {t('common.edit')}
                        </Button>
                      </>
                    ) : (
                      <>
                        <SearchableSelect
                          value={agentId}
                          onChange={setAgentId}
                          placeholder={t('tickets.assignToAgent')}
                          options={(agents || []).map((agent) => ({
                            value: agent.id,
                            label: agent.full_name,
                          }))}
                        />
                        <Button
                          onClick={handleAssign}
                          loading={assignTicket.isPending}
                          disabled={!agentId || String(agentId) === String(ticket.assigned_agent?.id)}
                        >
                          {t('tickets.assign')}
                        </Button>
                        {ticket.assigned_agent && (
                          <Button variant="ghost" onClick={handleCancelEditAssignee}>
                            {t('common.cancel')}
                          </Button>
                        )}
                      </>
                    )}
                  </ActionGroup>
                )}

                {canAssign && (
                  <ActionGroup label={t('tickets.collaborators')}>
                    {collaborators.length > 0 && (
                      <div className="rounded-xl border border-gray-300 bg-gray-50 px-3 py-2 dark:border-white/10 dark:bg-white/5">
                        <CollaboratorChips
                          collaborators={collaborators}
                          onRemove={handleRemoveCollaborator}
                          removeLabel={t('common.remove')}
                        />
                      </div>
                    )}
                    <SearchableSelect
                      value={collaboratorId}
                      onChange={setCollaboratorId}
                      placeholder={t('tickets.addCollaboratingAgent')}
                      options={availableCollaborators.map((agent) => ({
                        value: agent.id,
                        label: agent.full_name,
                      }))}
                    />
                    <Button
                      onClick={handleAddCollaborator}
                      loading={setCollaborators.isPending}
                      disabled={!collaboratorId}
                    >
                      {t('tickets.addCollaborator')}
                    </Button>
                  </ActionGroup>
                )}

                {canManageArticles && availableArticles.length > 0 && (
                  <ActionGroup label={t('tickets.relatedArticles')}>
                    <SearchableSelect
                      value={articleToAdd}
                      onChange={handleAddArticle}
                      placeholder={t('tickets.linkArticle')}
                      options={availableArticles.map((a) => ({ value: a.id, label: a.title }))}
                    />
                  </ActionGroup>
                )}

                {canSelfAssign && (
                  <ActionGroup label={t('tickets.assignment')}>
                    <Button
                      onClick={handleSelfAssign}
                      loading={assignTicket.isPending}
                      className="w-full"
                    >
                      {t('tickets.assignToMe')}
                    </Button>
                  </ActionGroup>
                )}

                {canReassign && (
                  <ActionGroup label={t('tickets.reassign')}>
                    <SearchableSelect
                      value={reassignId}
                      onChange={setReassignId}
                      placeholder={t('tickets.reassignToAnother')}
                      options={(agents || [])
                        .filter((agent) => agent.id !== user?.id)
                        .map((agent) => ({ value: agent.id, label: agent.full_name }))}
                    />
                    <Button
                      onClick={handleReassign}
                      loading={assignTicket.isPending}
                      disabled={!reassignId}
                    >
                      {t('tickets.reassign')}
                    </Button>
                  </ActionGroup>
                )}

                {canEdit && (
                  <ActionGroup label={t('field.status')}>
                    {ticket.assigned_agent ? (
                      <>
                        <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                          {/* Only reachable in the frame before the ticket's status syncs in. */}
                          <option value="" disabled>
                            {t('tickets.updateStatus')}
                          </option>
                          {/* "Unassigned" is the state of a ticket nobody has taken yet, so
                              it's not a status an assigned ticket can be moved back into. */}
                          <option value="open" disabled={Boolean(ticket.assigned_agent)}>
                            {t('status.open')}
                          </option>
                          <option value="in_progress">{t('status.in_progress')}</option>
                          <option value="on_hold">{t('status.on_hold')}</option>
                          <option value="resolved">{t('status.resolved')}</option>
                          <option value="closed">{t('status.closed')}</option>
                        </Select>
                        {status === 'on_hold' && (
                          <Textarea
                            label={t('tickets.reasonForHold')}
                            rows={2}
                            placeholder={t('tickets.holdReasonPlaceholder')}
                            value={holdReason}
                            onChange={(e) => setHoldReason(e.target.value)}
                          />
                        )}
                        <Button
                          onClick={handleUpdateStatus}
                          loading={updateStatus.isPending}
                          // The box now starts on the current status, so there's nothing to
                          // submit until it's changed. On hold is the exception: re-submitting
                          // the same status is how you revise the reason.
                          disabled={
                            !status ||
                            (status === 'on_hold'
                              ? !holdReason.trim()
                              : status === ticket.status)
                          }
                        >
                          {t('tickets.updateStatus')}
                        </Button>
                      </>
                    ) : (
                      <p className="text-xs text-gray-500 dark:text-gray-300">
                        {t('tickets.assignBeforeStatus')}
                      </p>
                    )}
                  </ActionGroup>
                )}

                {canEdit && ticket.category && (
                  <ActionGroup label={t('tickets.categoryPriority')}>
                    <Select
                      value={categoryPriority}
                      onChange={(e) => setCategoryPriority(e.target.value)}
                    >
                      {/* Empty = inherit, so the category default reads as a real choice
                          rather than a blank the admin has to guess at. */}
                      <option value="">
                        {t('tickets.useCategoryPriority')} ({t(`priority.${ticket.category.priority}`)})
                      </option>
                      <option value="low">{t('priority.low')}</option>
                      <option value="medium">{t('priority.medium')}</option>
                      <option value="high">{t('priority.high')}</option>
                      <option value="urgent">{t('priority.urgent')}</option>
                    </Select>
                    <p className="text-xs text-gray-500 dark:text-gray-300">
                      {t('tickets.categoryPriorityHint')}
                    </p>
                    <Button
                      onClick={handleUpdateCategoryPriority}
                      loading={updateTicket.isPending}
                      disabled={categoryPriority === serverCategoryOverride}
                    >
                      {t('tickets.updatePriority')}
                    </Button>
                  </ActionGroup>
                )}

                {!ticket.assigned_agent && dueDateGroup}

                {canDelete && (
                  <ActionGroup label={t('tickets.dangerZone')} tone="danger">
                    <Button
                      variant="danger"
                      onClick={handleDelete}
                      loading={deleteTicket.isPending}
                      className="w-full"
                    >
                      <TrashIcon className="h-4 w-4" />
                      {t('tickets.deleteTicket')}
                    </Button>
                  </ActionGroup>
                )}
              </fieldset>
            </Card>
          )}
        </div>
      </div>

      {isAdmin && (
        <EditTicketModal open={editOpen} onClose={() => setEditOpen(false)} ticket={ticket} id={id} />
      )}
    </div>
  )
}
