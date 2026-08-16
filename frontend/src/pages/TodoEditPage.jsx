import { useLocation, useNavigate, useParams } from 'react-router-dom'
import Breadcrumbs from '../components/ui/Breadcrumbs'
import Card from '../components/ui/Card'
import EmptyState from '../components/ui/EmptyState'
import Spinner from '../components/ui/Spinner'
import TodoForm from '../components/todo/TodoForm'
import { useTodo } from '../hooks/useTodos'
import { useI18n } from '../i18n/useI18n'

// Editing gets the same page treatment as adding, and for the same reason: the form is
// long enough to want the room. Loading by id rather than by whatever the list happened
// to hold means the URL works on its own — shareable, bookmarkable, survives a refresh.
export default function TodoEditPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { id } = useParams()
  const { state } = useLocation()
  const { data: todo, isLoading, isError } = useTodo(id)
  // Back to the view they left. Typed straight into the address bar there is no such
  // view, hence the fallback.
  const back = state?.from || '/todo/inbox'

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <Breadcrumbs
        items={[
          { label: t('crumb.dashboard'), to: '/dashboard' },
          { label: t('nav.todo'), to: back },
          { label: todo?.title || t('todo.editItem') },
        ]}
      />

      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
          {t('todo.editItem')}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-300">{t('todo.editItemHint')}</p>
      </div>

      <Card>
        {/* A missing item and an unreadable one look the same from here, and should:
            the server does not distinguish them either, on purpose. */}
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : isError || !todo ? (
          <EmptyState title={t('todo.notFound')} description={t('todo.notFoundHint')} />
        ) : (
          <TodoForm todo={todo} onDone={() => navigate(back)} onCancel={() => navigate(back)} />
        )}
      </Card>
    </div>
  )
}
