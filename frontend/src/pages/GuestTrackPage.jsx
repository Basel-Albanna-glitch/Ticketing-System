import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import GuestShell from '../components/layout/GuestShell'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Input from '../components/ui/Input'
import Textarea from '../components/ui/Textarea'
import Spinner from '../components/ui/Spinner'
import StatusBadge from '../components/tickets/StatusBadge'
import PriorityBadge from '../components/tickets/PriorityBadge'
import { replyGuestTicket, trackGuestTicket } from '../api/tickets'
import { useI18n } from '../i18n/useI18n'

function initials(name = '') {
  return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?'
}

export default function GuestTrackPage() {
  const { t } = useI18n()
  const [params] = useSearchParams()
  const [phone, setPhone] = useState('')
  const [reference, setReference] = useState(params.get('ref') || '')
  const [ticket, setTicket] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [reply, setReply] = useState('')
  const [replying, setReplying] = useState(false)

  async function lookup(event) {
    event?.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await trackGuestTicket({ phone, reference })
      setTicket(data)
    } catch (err) {
      setTicket(null)
      setError(
        err?.response?.status === 404
          ? t('guest.track.notFound')
          : t('guest.track.error')
      )
    } finally {
      setLoading(false)
    }
  }

  async function handleReply(event) {
    event.preventDefault()
    if (!reply.trim()) return
    setReplying(true)
    try {
      await replyGuestTicket({ phone, reference, body: reply })
      setReply('')
      const data = await trackGuestTicket({ phone, reference })
      setTicket(data)
    } catch {
      setError(t('guest.track.replyError'))
    } finally {
      setReplying(false)
    }
  }

  return (
    <GuestShell
      title={t('guest.track.title')}
      subtitle={t('guest.track.subtitle')}
      footer={
        <>
          {t('guest.track.needNew')}{' '}
          <Link to="/guest/new" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
            {t('guest.submitTicket')}
          </Link>
        </>
      }
    >
      <Card>
        <form onSubmit={lookup} className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <Input
            label={t('guest.field.referenceNumber')}
            placeholder={t('guest.field.referencePlaceholder')}
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            required
            className="sm:w-40"
          />
          <Input
            label={t('field.phone')}
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            className="flex-1"
          />
          <Button type="submit" loading={loading} className="whitespace-nowrap">
            {t('guest.track.button')}
          </Button>
        </form>
        {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
      </Card>

      {loading && (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      )}

      {ticket && !loading && (
        <div className="mt-6 flex flex-col gap-6">
          <Card>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-gray-100 px-2 py-0.5 font-mono text-xs font-medium text-gray-500 dark:bg-white/10 dark:text-gray-400">
                {ticket.reference || `#${ticket.id}`}
              </span>
              {ticket.reference && (
                <span className="rounded-md bg-gray-100 px-2 py-0.5 font-mono text-xs font-medium text-gray-500 dark:bg-white/10 dark:text-gray-400">
                  #{ticket.id}
                </span>
              )}
              <PriorityBadge priority={ticket.priority} />
              <StatusBadge status={ticket.status} assigned={ticket.is_assigned} />
            </div>
            <h2 className="mt-2 text-lg font-semibold text-gray-900 dark:text-gray-100">{ticket.subject}</h2>
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
              {ticket.category} · {t('guest.track.submitted')} {new Date(ticket.created_at).toLocaleDateString()}
            </p>

            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-gray-100 pt-4 text-sm dark:border-white/10">
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
                  {t('guest.track.status')}
                </dt>
                <dd className="mt-0.5 text-gray-800 dark:text-gray-200">
                  {t(`status.${ticket.status === 'open' && ticket.is_assigned ? 'assigned' : ticket.status}`)}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
                  {t('guest.track.priority')}
                </dt>
                <dd className="mt-0.5 text-gray-800 dark:text-gray-200">{ticket.priority_display}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
                  {t('guest.track.lastUpdated')}
                </dt>
                <dd className="mt-0.5 text-gray-800 dark:text-gray-200">
                  {new Date(ticket.updated_at).toLocaleString()}
                </dd>
              </div>
            </dl>

            <p className="mt-4 whitespace-pre-wrap border-t border-gray-100 pt-4 text-sm text-gray-700 dark:border-white/10 dark:text-gray-300">
              {ticket.description}
            </p>
          </Card>

          <Card>
            <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-gray-100">{t('guest.track.conversation')}</h3>
            {ticket.comments?.length ? (
              <ul className="flex flex-col gap-3">
                {ticket.comments.map((c) => (
                  <li
                    key={c.id}
                    className="flex gap-3 rounded-xl border border-gray-200/70 bg-gray-50/50 p-3 dark:border-white/10 dark:bg-white/5"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">
                      {initials(c.author_name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center justify-between gap-2 text-xs text-gray-400 dark:text-gray-500">
                        <span className="font-medium text-gray-700 dark:text-gray-300">{c.author_name}</span>
                        <span>{new Date(c.created_at).toLocaleString()}</span>
                      </div>
                      <p className="whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200">{c.body}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-xl border border-dashed border-gray-200 py-6 text-center text-sm text-gray-400 dark:border-white/10 dark:text-gray-500">
                {t('guest.track.noReplies')}
              </p>
            )}

            <form onSubmit={handleReply} className="mt-4 flex flex-col gap-2 border-t border-gray-100 pt-4 dark:border-white/10">
              <Textarea
                placeholder={t('guest.track.replyPlaceholder')}
                rows={3}
                value={reply}
                onChange={(e) => setReply(e.target.value)}
              />
              <Button type="submit" loading={replying} disabled={!reply.trim()} className="self-start">
                {t('guest.track.sendReply')}
              </Button>
            </form>
          </Card>
        </div>
      )}
    </GuestShell>
  )
}
