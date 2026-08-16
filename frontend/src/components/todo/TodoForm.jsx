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
import { CheckCircleIcon, PaperClipIcon, TrashIcon } from '../ui/icons'
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

// Reminder offsets, in minutes before the due date. Coarse on purpose: a to-do list
// wants "a few days' warning", not a time picker.
const REMINDER_OFFSETS = [
  { minutes: 0, labelKey: 'todo.remindAtDue' },
  { minutes: 60, labelKey: 'todo.remind1h' },
  { minutes: 1440, labelKey: 'todo.remind1d' },
  { minutes: 4320, labelKey: 'todo.remind3d' },
  { minutes: 10080, labelKey: 'todo.remind7d' },
  { minutes: 20160, labelKey: 'todo.remind14d' },
]

// What the chosen offset works out to, so nobody has to do the arithmetic to find out
// their "7 days before" already fell in the past.
function remindPreview(form, t) {
  const due = new Date(form.due_at)
  if (Number.isNaN(due.getTime())) return ''
  const when = new Date(due.getTime() - Number(form.remind_offset_minutes) * 60000)
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
  remind_offset_minutes: '',
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
    remind_offset_minutes:
      todo.remind_offset_minutes == null ? '' : String(todo.remind_offset_minutes),
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

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    // Every extra field is optional: empty means null, not an empty string.
    const payload = {
      ...form,
      start_at: fromLocalInput(form.start_at),
      due_at: fromLocalInput(form.due_at),
      // '' means no reminder; the server derives remind_at from this and the due date.
      remind_offset_minutes:
        form.remind_offset_minutes === '' ? null : Number(form.remind_offset_minutes),
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
      <div>
        <Select
          label={t('todo.remindAt')}
          value={form.remind_offset_minutes}
          disabled={!form.due_at}
          onChange={(e) => setForm({ ...form, remind_offset_minutes: e.target.value })}
        >
          <option value="">{t('todo.remindNone')}</option>
          {REMINDER_OFFSETS.map((o) => (
            <option key={o.minutes} value={o.minutes}>
              {t(o.labelKey)}
            </option>
          ))}
        </Select>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-300">
          {/* Three things a reader needs: that it hangs off the due date, when it
              will actually land, and who gets it — "remind me" is the natural
              reading and on a shared item it is wrong. */}
          {!form.due_at
            ? t('todo.remindNeedsDueDate')
            : form.remind_offset_minutes === ''
              ? t('todo.remindNoneHint')
              : `${remindPreview(form, t)} · ${
                  form.is_private
                    ? t('todo.remindAtHintPrivate')
                    : form.assignee_ids.length
                      ? t('todo.remindAtHintAssigned')
                      : t('todo.remindAtHintUnassigned')
                }`}
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
