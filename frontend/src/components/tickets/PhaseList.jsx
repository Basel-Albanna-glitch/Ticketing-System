import { useState } from 'react'
import Avatar from '../ui/Avatar'
import Button from '../ui/Button'
import Textarea from '../ui/Textarea'
import { TrashIcon } from '../ui/icons'
import { useAddTicketPhase, useDeleteTicketPhase } from '../../hooks/useTicket'
import { useAuth } from '../../auth/useAuth'
import { useI18n } from '../../i18n/useI18n'

// The steps staff log while working a ticket. A ticket can have any number, and adding them
// is always optional — they're a record of how the work went, numbered in the order added.
export default function PhaseList({ ticketId, phases, canAdd = false }) {
  const { t } = useI18n()
  const { user } = useAuth()
  const [body, setBody] = useState('')
  const addPhase = useAddTicketPhase(ticketId)
  const deletePhase = useDeleteTicketPhase(ticketId)

  async function handleSubmit(event) {
    event.preventDefault()
    if (!body.trim()) return
    await addPhase.mutateAsync(body.trim())
    setBody('')
  }

  return (
    <div className="flex flex-col gap-4">
      {phases?.length ? (
        <ol className="flex flex-col gap-3">
          {phases.map((phase, i) => {
            // A phase can be removed by whoever logged it, or by an admin.
            const canRemove = user?.role === 'admin' || phase.author?.id === user?.id
            return (
              <li
                key={phase.id}
                className="flex gap-3 rounded-xl border border-gray-200/70 bg-gray-50/50 p-3 dark:border-white/10 dark:bg-white/5"
              >
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-semibold text-indigo-600 ring-1 ring-inset ring-indigo-200/70 dark:bg-indigo-500/10 dark:text-indigo-300 dark:ring-indigo-400/20">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center justify-between gap-2 text-xs text-gray-400 dark:text-gray-400">
                    <span className="inline-flex items-center gap-1.5 font-medium text-gray-700 dark:text-gray-300">
                      <Avatar name={phase.author_name} src={phase.author?.avatar} size="sm" />
                      {phase.author_name || '—'}
                    </span>
                    <span className="flex items-center gap-2">
                      {new Date(phase.created_at).toLocaleString()}
                      {canAdd && canRemove && (
                        <button
                          type="button"
                          onClick={() => deletePhase.mutate(phase.id)}
                          title={t('common.delete')}
                          className="text-gray-400 transition-colors hover:text-red-600 dark:hover:text-red-400"
                        >
                          <TrashIcon className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200">
                    {phase.body}
                  </p>
                </div>
              </li>
            )
          })}
        </ol>
      ) : (
        <p className="rounded-xl border border-dashed border-gray-200 py-6 text-center text-sm text-gray-400 dark:border-white/10 dark:text-gray-400">
          {t('tickets.noPhases')}
        </p>
      )}

      {canAdd && (
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-2 border-t border-gray-100 pt-4 dark:border-white/10"
        >
          <Textarea
            placeholder={t('tickets.phasePlaceholder')}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={2}
          />
          <Button
            type="submit"
            loading={addPhase.isPending}
            disabled={!body.trim()}
            className="self-start"
          >
            {t('tickets.addPhase')}
          </Button>
        </form>
      )}
    </div>
  )
}
