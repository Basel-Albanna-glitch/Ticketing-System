import { useCallback, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Breadcrumbs from '../components/ui/Breadcrumbs'
import Card from '../components/ui/Card'
import TodoForm from '../components/todo/TodoForm'
import { LockIcon, UsersIcon } from '../components/ui/icons'
import { useI18n } from '../i18n/useI18n'

// The two lists a new to-do can land on. Asked before the form rather than settled by a
// toggle buried at the bottom of it: which list an item is on decides who can see it, and
// that is a decision, not a field. Deciding it first also means the folder picker only
// ever offers folders from the side you actually chose.
const CHOICES = [
  {
    isPrivate: false,
    icon: UsersIcon,
    labelKey: 'todo.sectionPublic',
    hintKey: 'todo.chooseSharedHint',
    tone: 'hover:border-indigo-400 hover:bg-indigo-50/60 dark:hover:border-indigo-400/40 dark:hover:bg-indigo-500/10',
    iconTone: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300',
  },
  {
    isPrivate: true,
    icon: LockIcon,
    labelKey: 'todo.sectionPrivate',
    hintKey: 'todo.choosePrivateHint',
    tone: 'hover:border-amber-400 hover:bg-amber-50/60 dark:hover:border-amber-400/40 dark:hover:bg-amber-500/10',
    iconTone: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300',
  },
]

function VisibilityPicker({ onChoose, t }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {CHOICES.map((choice) => (
        <button
          key={choice.labelKey}
          type="button"
          onClick={() => onChoose(choice.isPrivate)}
          className={`flex flex-col items-start gap-3 rounded-2xl border border-gray-200/80 p-5 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 dark:border-white/10 ${choice.tone}`}
        >
          <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${choice.iconTone}`}>
            <choice.icon className="h-5 w-5" />
          </span>
          <span className="text-base font-semibold text-gray-900 dark:text-gray-100">
            {t(choice.labelKey)}
          </span>
          <span className="text-sm text-gray-500 dark:text-gray-300">{t(choice.hintKey)}</span>
        </button>
      ))}
    </div>
  )
}

// Adding a to-do gets a page of its own. The form asks for dates, a reminder, a folder,
// a customer, people and files — that is a sitting-down job, not something to squeeze
// into a dialog over the list.
export default function TodoCreatePage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { state } = useLocation()
  // Back to the view they left, so adding from Today does not land them in the Inbox.
  // Typed straight into the address bar there is no such view, hence the fallback.
  const back = state?.from || '/todo/inbox'
  // null until the question is answered — the form does not exist before then.
  const [isPrivate, setIsPrivate] = useState(null)
  // Going back to the question restarts the form, so it only asks when there is
  // something to lose — a confirm on an untouched form is pure friction.
  const [dirty, setDirty] = useState(false)
  const handleDirtyChange = useCallback((value) => setDirty(value), [])

  function reopenQuestion() {
    if (dirty && !window.confirm(t('todo.changeVisibilityConfirm'))) return
    setDirty(false)
    setIsPrivate(null)
  }
  const chosen = isPrivate !== null
  const choice = CHOICES.find((c) => c.isPrivate === isPrivate)

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <Breadcrumbs
        items={[
          { label: t('crumb.dashboard'), to: '/dashboard' },
          { label: t('nav.todo'), to: back },
          { label: t('todo.newItem') },
        ]}
      />

      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
          {t('todo.newItem')}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-300">
          {chosen ? t('todo.newItemHint') : t('todo.chooseVisibilityHint')}
        </p>
      </div>

      <Card>
        {!chosen ? (
          <div className="flex flex-col gap-4">
            <h2 className="text-sm font-medium text-gray-700 dark:text-gray-200">
              {t('todo.chooseVisibility')}
            </h2>
            <VisibilityPicker onChoose={setIsPrivate} t={t} />
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {/* What was chosen, and a way back to it. The form's own privacy toggle can
                still flip it — this is the answer to the question, not a lock. */}
            <div className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2 text-sm dark:bg-white/5">
              <choice.icon className="h-4 w-4 shrink-0 text-gray-500 dark:text-gray-300" />
              <span className="font-medium text-gray-800 dark:text-gray-100">
                {t(choice.labelKey)}
              </span>
              <span className="min-w-0 flex-1 truncate text-gray-500 dark:text-gray-400">
                {t(choice.hintKey)}
              </span>
              <button
                type="button"
                onClick={reopenQuestion}
                className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-indigo-600 transition-colors hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-500/10"
              >
                {t('todo.changeVisibility')}
              </button>
            </div>
            {/* `key` remounts the form when the answer changes, so switching side clears
                a folder that belonged to the other one. */}
            <TodoForm
              key={String(isPrivate)}
              initialPrivate={isPrivate}
              // Set when the add came from a particular day in the agenda, so the to-do
              // lands on the day it was asked for rather than undated.
              initialDue={state?.dueDate || ''}
              onDirtyChange={handleDirtyChange}
              onDone={() => navigate(back)}
              onCancel={() => navigate(back)}
            />
          </div>
        )}
      </Card>
    </div>
  )
}
