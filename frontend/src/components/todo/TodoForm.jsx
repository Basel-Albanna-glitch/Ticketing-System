import { useEffect, useRef, useState } from 'react'
import Button from '../ui/Button'
import FileInput from '../ui/FileInput'
import Input from '../ui/Input'
import MultiSelect from '../ui/MultiSelect'
import SearchableSelect from '../ui/SearchableSelect'
import Select from '../ui/Select'
import Textarea from '../ui/Textarea'
import Toggle from '../ui/Toggle'
import Avatar from '../ui/Avatar'
import Spinner from '../ui/Spinner'
import { CheckCircleIcon, PaperClipIcon, PlusIcon, TrashIcon } from '../ui/icons'
import { formatBytes, formatDuration } from './format'
import { useAuth } from '../../auth/useAuth'
import { useAgents } from '../../hooks/useAgents'
import { useCustomers } from '../../hooks/useCustomers'
import {
  useCreateTodo,
  useDeleteTodoAttachment,
  useSetTodoAssigneeDone,
  useTodoFolders,
  useUpdateTodo,
  useUploadTodoAttachments,
} from '../../hooks/useTodos'
import { useI18n } from '../../i18n/useI18n'

// Units a "before the due date" reminder can be typed in, as minutes.
const REMINDER_UNITS = [
  { value: 'minutes', minutes: 1, labelKey: 'todo.unitMinutes' },
  { value: 'hours', minutes: 60, labelKey: 'todo.unitHours' },
  { value: 'days', minutes: 1440, labelKey: 'todo.unitDays' },
]

// Room for a week's, a day's and an hour's warning plus a fixed time or two. Mirrors
// MAX_REMINDERS_PER_TODO on the server.
const MAX_REMINDERS = 10

const CELL_INPUT =
  'rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/15 dark:border-white/10 dark:bg-white/5 dark:text-gray-100'

// A stored reminder as a row the form edits: an amount before the due date in the largest
// whole unit it fits ("2 days", not "2880 minutes"), or an exact moment in the
// datetime-local shape. Both shapes are kept on every row so switching kind loses nothing.
function reminderRow(reminder) {
  if (reminder.offset_minutes == null) {
    return { kind: 'at', at: toLocalInput(reminder.remind_at), amount: '1', unit: 'days' }
  }
  const unit =
    [...REMINDER_UNITS].reverse().find((u) => reminder.offset_minutes % u.minutes === 0) ||
    REMINDER_UNITS[0]
  return {
    kind: 'before',
    amount: String(reminder.offset_minutes / unit.minutes),
    unit: unit.value,
    at: '',
  }
}

// Minutes before the due date a row asks for, or null while its amount isn't a whole number.
function rowOffset(row) {
  if (!/^\d+$/.test(String(row.amount))) return null
  const unit = REMINDER_UNITS.find((u) => u.value === row.unit) || REMINDER_UNITS[0]
  return Number(row.amount) * unit.minutes
}

// When a row will actually land, so nobody has to do the arithmetic to find out their
// "7 days before" already fell in the past.
function rowPreview(row, dueAt, t) {
  let when = null
  if (row.kind === 'at') {
    when = row.at ? new Date(row.at) : null
  } else {
    const offset = rowOffset(row)
    when = offset != null && dueAt ? new Date(new Date(dueAt).getTime() - offset * 60000) : null
  }
  if (!when || Number.isNaN(when.getTime())) return ''
  const stamp = when.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
  return when.getTime() <= Date.now() ? `${stamp} — ${t('todo.remindInPast')}` : stamp
}

const EMPTY_FORM = {
  title: '',
  notes: '',
  priority: 'medium',
  // New work is shared by default — the team board is the norm, and a private item is
  // the deliberate exception.
  is_private: false,
  folder_id: '',
  start_at: '',
  due_at: '',
  reminders: [],
  customer_id: '',
  assignee_ids: [],
}

// <input type="datetime-local"> speaks 'YYYY-MM-DDTHH:mm' in local time, while the API
// speaks ISO with an offset. These two convert between them without a UTC round trip.
function toLocalInput(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

function fromLocalInput(value) {
  return value ? new Date(value).toISOString() : null
}

function formFromTodo(todo, initialDue, initialPrivate) {
  // Both defaults come from what the user already told us on the way in: which list they
  // picked, and — from the agenda — which day they pressed Add on. `initialDue` is already
  // in the 'YYYY-MM-DDTHH:mm' shape the date inputs speak, not the API's ISO.
  if (!todo) {
    return {
      ...EMPTY_FORM,
      ...(initialDue ? { due_at: initialDue } : null),
      ...(initialPrivate === null || initialPrivate === undefined
        ? null
        : { is_private: initialPrivate }),
    }
  }
  return {
    title: todo.title,
    notes: todo.notes || '',
    priority: todo.priority,
    is_private: todo.is_private,
    folder_id: todo.folder?.id ?? '',
    start_at: toLocalInput(todo.start_at),
    due_at: toLocalInput(todo.due_at),
    reminders: (todo.reminders || []).map(reminderRow),
    customer_id: todo.customer?.id ?? '',
    assignee_ids: (todo.assignees || []).map((a) => a.id),
  }
}

// Who has finished their share of a to-do that several people are carrying. Only shown
// once there is more than one assignee: on a one-person item `done` already says it, and
// a second control saying the same thing invites the two to disagree.
//
// It reads the *saved* assignees rather than the draft above it, because ticking a share
// posts to the server about that to-do as it currently stands — so a pending change to
// the assignee list is called out rather than silently reflected.
function AssigneeShares({ todo, draftAssigneeIds, t }) {
  const { user } = useAuth()
  const setDone = useSetTodoAssigneeDone()
  const assignees = todo.assignees || []
  const completedBy = new Map((todo.assignee_completions || []).map((c) => [c.user_id, c]))
  const finished = assignees.filter((person) => completedBy.has(person.id)).length
  const saved = assignees.map((a) => a.id)
  const stale =
    saved.length !== draftAssigneeIds.length ||
    saved.some((id) => !draftAssigneeIds.includes(id))

  function toggle(person, done) {
    setDone.mutate(
      { id: todo.id, userId: person.id, done },
      { onError: () => window.alert(t('todo.shareFailed')) }
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {t('todo.shares')}
        </span>
        <span className="text-xs tabular-nums text-gray-500 dark:text-gray-300">
          {finished}/{assignees.length}
        </span>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-300">{t('todo.sharesHint')}</p>
      <ul className="flex flex-col gap-1">
        {assignees.map((person) => {
          const completion = completedBy.get(person.id)
          const isDone = Boolean(completion)
          // Your own share is yours to close; an admin may close anyone's. The server
          // enforces the same rule, so this only spares people a refused click.
          const mayToggle = user?.role === 'admin' || person.id === user?.id
          const pending = setDone.isPending && setDone.variables?.userId === person.id
          return (
            <li
              key={person.id}
              className="flex items-center gap-2 rounded-lg border border-gray-200/70 px-2 py-1.5 dark:border-white/10"
            >
              <Avatar name={person.full_name} src={person.avatar} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-gray-800 dark:text-gray-200">
                  {person.full_name}
                </p>
                {isDone && (
                  <p className="truncate text-[11px] text-gray-400 dark:text-gray-400">
                    {new Date(completion.completed_at).toLocaleString([], {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                    {/* Somebody else closing your part is worth saying out loud. */}
                    {completion.marked_by_id && completion.marked_by_id !== person.id
                      ? ` · ${t('todo.shareMarkedByAdmin')}`
                      : ''}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => toggle(person, !isDone)}
                disabled={!mayToggle || pending}
                title={mayToggle ? undefined : t('todo.shareNotYours')}
                aria-pressed={isDone}
                className={`inline-flex shrink-0 items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 disabled:cursor-not-allowed disabled:opacity-50 ${
                  isDone
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/20'
                    : 'border-gray-200 text-gray-500 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 dark:border-white/10 dark:text-gray-300 dark:hover:border-emerald-500/30 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-300'
                }`}
              >
                {pending ? <Spinner /> : <CheckCircleIcon className="h-3.5 w-3.5" />}
                {t(isDone ? 'todo.shareUndo' : 'todo.shareDone')}
              </button>
            </li>
          )
        })}
      </ul>
      {stale && (
        <p className="text-xs text-amber-600 dark:text-amber-400">{t('todo.sharesStale')}</p>
      )}
    </div>
  )
}

// The one to-do form. It lives in two shells — a modal over the list for editing, and a
// page of its own for adding — so it owns its state and its saving rather than having
// either shell hand it in; the shells only say what to edit and where to go afterwards.
//
// `todo` is null when adding. `onDone` is handed the saved item. `onCancel`, when given,
// renders a way out beside the submit button — the modal already has its own close.
export default function TodoForm({
  todo = null,
  initialDue = '',
  initialPrivate = null,
  onDone,
  onCancel,
  onDirtyChange,
}) {
  const { t } = useI18n()
  const { user } = useAuth()
  const { data: agents } = useAgents({ includeAdmins: true })
  const { data: customers } = useCustomers()
  const { data: folders } = useTodoFolders()
  const createTodo = useCreateTodo()
  const updateTodo = useUpdateTodo()
  const uploadAttachments = useUploadTodoAttachments()
  const deleteAttachment = useDeleteTodoAttachment()

  const [form, setForm] = useState(() => formFromTodo(todo, initialDue, initialPrivate))
  // What the form looked like before anyone touched it, so a shell around this one can
  // tell whether backing out would throw away work. Captured once — it is the baseline,
  // not a mirror of the current values.
  const initialForm = useRef(form)
  // Files chosen here but not yet uploaded — they go up once the to-do exists.
  const [pendingFiles, setPendingFiles] = useState([])
  // A local copy, so removing a file takes it off the screen straight away instead of
  // leaving it there until the form is reopened.
  const [attachments, setAttachments] = useState(() => todo?.attachments || [])
  const [error, setError] = useState('')

  const dirty =
    pendingFiles.length > 0 || JSON.stringify(form) !== JSON.stringify(initialForm.current)
  useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])

  // A new item is always yours; an existing one only if you wrote it.
  const canChangePrivacy = !todo || todo.created_by?.id === user?.id
  // The folders this item could move into: the side it is on, and — for a private
  // folder — only your own, which is all the server sends anyway.
  const folderOptions = (folders || []).filter((f) => f.is_private === form.is_private)

  // A new reminder starts as "1 day before" when there is a due date to count back from,
  // and as an exact time otherwise.
  function addReminder() {
    setForm((current) => ({
      ...current,
      reminders: [
        ...current.reminders,
        { kind: current.due_at ? 'before' : 'at', amount: '1', unit: 'days', at: '' },
      ],
    }))
  }

  function updateReminder(index, changes) {
    setForm((current) => ({
      ...current,
      reminders: current.reminders.map((row, i) => (i === index ? { ...row, ...changes } : row)),
    }))
  }

  function removeReminder(index) {
    setForm((current) => ({
      ...current,
      reminders: current.reminders.filter((_, i) => i !== index),
    }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    // Every extra field is optional: empty means null, not an empty string.
    const payload = {
      ...form,
      start_at: fromLocalInput(form.start_at),
      due_at: fromLocalInput(form.due_at),
      // Each row becomes an amount before the due date or an exact moment. A row left
      // incomplete is dropped rather than refused; the server works out when relative
      // ones land.
      reminders: form.reminders
        .map((row) => {
          if (row.kind === 'at') return row.at ? { remind_at: fromLocalInput(row.at) } : null
          const offset = rowOffset(row)
          return offset != null && form.due_at ? { offset_minutes: offset } : null
        })
        .filter(Boolean),
      customer_id: form.customer_id || null,
      folder_id: form.folder_id || null,
    }
    try {
      const saved = todo
        ? await updateTodo.mutateAsync({ id: todo.id, ...payload })
        : await createTodo.mutateAsync(payload)
      // Files go up after the to-do exists, since a new one has no id to hang them on.
      // Failing here leaves the saved to-do alone and says so, rather than pretending
      // the whole save failed and inviting a duplicate.
      if (pendingFiles.length) {
        try {
          await uploadAttachments.mutateAsync({ id: saved.id, files: pendingFiles })
        } catch {
          setError(t('todo.attachmentUploadFailed'))
          setPendingFiles([])
          return
        }
      }
      onDone?.(saved)
    } catch (err) {
      const data = err?.response?.data
      setError(data ? Object.values(data).flat().join(' ') : t('todo.saveFailed'))
    }
  }

  function handleDeleteAttachment(attachment) {
    if (!todo) return
    if (!window.confirm(`${t('todo.deleteAttachmentConfirm')} "${attachment.original_filename}"?`))
      return
    deleteAttachment.mutate(
      { id: todo.id, attachmentId: attachment.id },
      {
        onSuccess: () => setAttachments((current) => current.filter((a) => a.id !== attachment.id)),
        onError: () => window.alert(t('todo.attachmentDeleteFailed')),
      }
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input
        label={t('projects.taskTitle')}
        value={form.title}
        onChange={(e) => setForm({ ...form, title: e.target.value })}
        required
      />
      <Textarea
        label={t('todo.notes')}
        rows={3}
        value={form.notes}
        onChange={(e) => setForm({ ...form, notes: e.target.value })}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select
          label={t('field.priority')}
          value={form.priority}
          onChange={(e) => setForm({ ...form, priority: e.target.value })}
        >
          <option value="low">{t('priority.low')}</option>
          <option value="medium">{t('priority.medium')}</option>
          <option value="high">{t('priority.high')}</option>
          <option value="urgent">{t('priority.urgent')}</option>
        </Select>
        <Input
          label={t('projects.fromDate')}
          type="datetime-local"
          value={form.start_at}
          onChange={(e) => setForm({ ...form, start_at: e.target.value })}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label={t('projects.toDate')}
          type="datetime-local"
          value={form.due_at}
          onChange={(e) => setForm({ ...form, due_at: e.target.value })}
        />
        {/* Read-only: it follows the dates rather than being typed. */}
        <Input
          label={t('todo.duration')}
          value={
            form.start_at && form.due_at
              ? formatDuration(
                  Math.round((new Date(form.due_at) - new Date(form.start_at)) / 60000),
                  t
                )
              : t('common.none')
          }
          readOnly
          disabled
        />
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {t('todo.reminders')}
        </span>
        {form.reminders.length > 0 && (
          <ul className="flex flex-col gap-2">
            {form.reminders.map((row, index) => (
              <li
                key={index}
                className="flex flex-col gap-1 rounded-xl border border-gray-200/70 p-2 dark:border-white/10"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    aria-label={t('todo.reminderKind')}
                    className={CELL_INPUT}
                    value={row.kind}
                    onChange={(e) => updateReminder(index, { kind: e.target.value })}
                  >
                    {/* Counting back needs something to count back from. */}
                    <option value="before" disabled={!form.due_at}>
                      {t('todo.reminderBefore')}
                    </option>
                    <option value="at">{t('todo.reminderAt')}</option>
                  </select>
                  {row.kind === 'before' ? (
                    <>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        aria-label={t('todo.reminderAmount')}
                        className={`${CELL_INPUT} w-20`}
                        value={row.amount}
                        onChange={(e) => updateReminder(index, { amount: e.target.value })}
                      />
                      <select
                        aria-label={t('todo.reminderUnit')}
                        className={CELL_INPUT}
                        value={row.unit}
                        onChange={(e) => updateReminder(index, { unit: e.target.value })}
                      >
                        {REMINDER_UNITS.map((u) => (
                          <option key={u.value} value={u.value}>
                            {t(u.labelKey)}
                          </option>
                        ))}
                      </select>
                      <span className="text-sm text-gray-500 dark:text-gray-300">
                        {t('todo.beforeDue')}
                      </span>
                    </>
                  ) : (
                    <input
                      type="datetime-local"
                      aria-label={t('todo.reminderAt')}
                      className={CELL_INPUT}
                      value={row.at}
                      onChange={(e) => updateReminder(index, { at: e.target.value })}
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => removeReminder(index)}
                    aria-label={t('todo.removeReminder')}
                    className="ms-auto shrink-0 rounded p-1 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-300">
                  {row.kind === 'before' && !form.due_at
                    ? t('todo.remindBeforeNeedsDue')
                    : rowPreview(row, form.due_at, t)}
                </p>
              </li>
            ))}
          </ul>
        )}
        {form.reminders.length < MAX_REMINDERS && (
          <Button type="button" variant="secondary" onClick={addReminder} className="self-start">
            <PlusIcon className="h-4 w-4" />
            {t('todo.addReminder')}
          </Button>
        )}
        <p className="text-xs text-gray-500 dark:text-gray-300">
          {/* Who gets them matters: "remind me" is the natural reading, and on a shared
              item it is wrong. */}
          {form.reminders.length === 0
            ? t('todo.remindNoneHint')
            : form.is_private
              ? t('todo.remindersHintPrivate')
              : form.assignee_ids.length
                ? t('todo.remindersHintAssigned')
                : t('todo.remindersHintUnassigned')}
        </p>
      </div>
      <Select
        label={t('todo.folder')}
        value={form.folder_id}
        onChange={(e) => setForm({ ...form, folder_id: e.target.value })}
      >
        <option value="">{t('todo.unfiled')}</option>
        {folderOptions.map((f) => (
          <option key={f.id} value={f.id}>
            {f.name}
          </option>
        ))}
      </Select>
      <SearchableSelect
        label={`${t('field.customer')} (${t('common.optional')})`}
        value={form.customer_id}
        onChange={(value) => setForm({ ...form, customer_id: value })}
        placeholder={t('todo.noCustomer')}
        options={[
          { value: '', label: t('todo.noCustomer') },
          ...(customers || []).map((c) => ({
            value: c.id,
            label: `${c.full_name} (${c.username})`,
          })),
        ]}
      />
      {/* Absent, not disabled, on a private to-do: there is nobody it could be assigned
          to, since nobody else can read it. A greyed-out picker would suggest the option
          exists and is merely unavailable. The server refuses the pairing either way. */}
      {form.is_private ? (
        <p className="rounded-xl border border-gray-200/70 px-3 py-2 text-xs text-gray-500 dark:border-white/10 dark:text-gray-300">
          {t('todo.privateUnassignable')}
        </p>
      ) : (
        <div>
          <MultiSelect
            label={t('projects.assignees')}
            value={form.assignee_ids}
            onChange={(ids) => setForm({ ...form, assignee_ids: ids })}
            placeholder={t('projects.unassigned')}
            options={(agents || []).map((a) => ({ value: a.id, label: a.full_name }))}
          />
          {/* Assigning is not just a label — it decides who still sees the item. */}
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-300">
            {form.assignee_ids.length ? t('todo.assignNarrowsHint') : t('todo.unassignedHint')}
          </p>
        </div>
      )}
      {/* Directly under the assignee picker: it is about the same people. Absent while
          adding, since the shares belong to a to-do that does not exist yet. */}
      {todo && (todo.assignees?.length || 0) > 1 && (
        <AssigneeShares todo={todo} draftAssigneeIds={form.assignee_ids} t={t} />
      )}
      {/* Only the author may move an item between the two lists, so this is read-only
          on someone else's — the server refuses it either way. */}
      <div className="flex items-start justify-between gap-4 rounded-xl border border-gray-200/70 p-3 dark:border-white/10">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
            {t('todo.makePrivate')}
          </p>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-300">
            {canChangePrivacy ? t('todo.makePrivateHint') : t('todo.privacyOwnerOnly')}
          </p>
        </div>
        <Toggle
          checked={form.is_private}
          disabled={!canChangePrivacy}
          // Folders belong to one side, so a folder chosen before the flip is no longer
          // a legal home — drop back to the Inbox. Going private drops the assignees for
          // the same reason: neither is a legal pairing, and the server refuses both.
          // Clearing here rather than on save means you watch it happen and can undo it.
          onChange={(value) =>
            setForm({
              ...form,
              is_private: value,
              folder_id: '',
              assignee_ids: value ? [] : form.assignee_ids,
            })
          }
          aria-label={t('todo.makePrivate')}
        />
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {t('todo.attachments')}
        </span>
        {/* Already-uploaded files, each removable. Only on an existing to-do — a new
            one has nothing stored yet. */}
        {attachments.length > 0 && (
          <ul className="flex flex-col gap-1">
            {attachments.map((a) => (
              <li
                key={a.id}
                className="flex items-center gap-2 rounded-lg border border-gray-200/70 px-2 py-1.5 text-xs dark:border-white/10"
              >
                <PaperClipIcon className="h-3.5 w-3.5 shrink-0 text-gray-400 dark:text-gray-400" />
                <a
                  href={a.file}
                  target="_blank"
                  rel="noreferrer"
                  className="min-w-0 flex-1 truncate text-indigo-600 hover:underline dark:text-indigo-400"
                >
                  {a.original_filename}
                </a>
                <span className="shrink-0 tabular-nums text-gray-400 dark:text-gray-400">
                  {formatBytes(a.size)}
                </span>
                <button
                  type="button"
                  onClick={() => handleDeleteAttachment(a)}
                  aria-label={`${t('common.delete')} ${a.original_filename}`}
                  className="shrink-0 rounded p-1 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                >
                  <TrashIcon className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <FileInput files={pendingFiles} onChange={setPendingFiles} />
        {!todo && pendingFiles.length > 0 && (
          <p className="text-xs text-gray-500 dark:text-gray-300">
            {t('todo.attachmentsAfterSave')}
          </p>
        )}
      </div>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <div className="flex items-center gap-3">
        <Button type="submit" loading={createTodo.isPending || updateTodo.isPending}>
          {t(todo ? 'projects.saveChanges' : 'todo.addItem')}
        </Button>
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
        )}
      </div>
    </form>
  )
}
