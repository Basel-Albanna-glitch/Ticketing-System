import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import GuestShell from '../components/layout/GuestShell'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Input from '../components/ui/Input'
import Textarea from '../components/ui/Textarea'
import Spinner from '../components/ui/Spinner'
import StatusBadge from '../components/tickets/StatusBadge'
import AttachmentList from '../components/tickets/AttachmentList'
import {
  BadgeIcon,
  CalendarIcon,
  CheckCircleIcon,
  ClockIcon,
  FolderOpenIcon,
  InboxIcon,
  RefreshIcon,
  StarIcon,
  UserIcon,
} from '../components/ui/icons'
import { rateGuestTicket, replyGuestTicket, trackGuestTicket } from '../api/tickets'
import { useI18n } from '../i18n/useI18n'

// The lookup pair lives in sessionStorage so a refresh (or following the emailed link back)
// keeps the guest on their ticket instead of dropping them at an empty form. Session-scoped
// on purpose: it is gone once the tab closes.
const SESSION_KEY = 'guestTrack'

function readSession() {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY)) || {}
  } catch {
    return {}
  }
}

function initials(name = '') {
  return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?'
}

// "3 minutes ago" in the active language. Falls back to the absolute date on bad input.
function timeAgo(iso, lang) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const seconds = Math.round((date.getTime() - Date.now()) / 1000)
  const units = [
    ['second', 60],
    ['minute', 60],
    ['hour', 24],
    ['day', 7],
    ['week', 4.35],
    ['month', 12],
    ['year', Infinity],
  ]
  let value = seconds
  for (const [unit, span] of units) {
    if (Math.abs(value) < span) {
      return new Intl.RelativeTimeFormat(lang, { numeric: 'auto' }).format(Math.round(value), unit)
    }
    value /= span
  }
  return date.toLocaleDateString()
}

// The four public milestones of a ticket. `on_hold` shares the "in progress" slot but is
// called out in amber so a paused ticket never looks like it is being worked on.
const STEPS = [
  { key: 'submitted', labelKey: 'guest.track.step.submitted', icon: InboxIcon },
  { key: 'in_progress', labelKey: 'guest.track.step.inProgress', icon: ClockIcon },
  { key: 'resolved', labelKey: 'guest.track.step.resolved', icon: CheckCircleIcon },
  { key: 'closed', labelKey: 'guest.track.step.closed', icon: BadgeIcon },
]

function stepIndex(status) {
  if (status === 'closed') return 3
  if (status === 'resolved') return 2
  if (status === 'in_progress' || status === 'on_hold') return 1
  return 0
}

function ProgressTrail({ status }) {
  const { t } = useI18n()
  const current = stepIndex(status)
  const paused = status === 'on_hold'

  return (
    <ol className="flex items-start" aria-label={t('guest.track.progress')}>
      {STEPS.map((step, index) => {
        const done = index < current
        const active = index === current
        const Icon = step.icon
        // Written out in full: Tailwind only sees class names that appear literally.
        const circle = done
          ? 'border-transparent bg-indigo-500 text-white'
          : active
            ? paused
              ? 'border-amber-500 bg-white text-amber-600 dark:bg-gray-900 dark:text-amber-400'
              : 'border-indigo-500 bg-white text-indigo-600 dark:bg-gray-900 dark:text-indigo-400'
            : 'border-gray-200 bg-white text-gray-300 dark:border-white/10 dark:bg-gray-900 dark:text-gray-600'
        const line = (filled) => (filled ? 'bg-indigo-500' : 'bg-gray-200 dark:bg-white/10')

        return (
          <li
            key={step.key}
            className="flex flex-1 flex-col items-center gap-2"
            aria-current={active ? 'step' : undefined}
          >
            <div className="flex w-full items-center">
              <span className={`h-0.5 flex-1 ${index === 0 ? 'bg-transparent' : line(done || active)}`} />
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${circle}`}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span
                className={`h-0.5 flex-1 ${index === STEPS.length - 1 ? 'bg-transparent' : line(done)}`}
              />
            </div>
            <span
              className={`px-1 text-center text-[11px] font-medium leading-tight ${
                done || active
                  ? 'text-gray-700 dark:text-gray-200'
                  : 'text-gray-400 dark:text-gray-500'
              }`}
            >
              {paused && active ? t('status.on_hold') : t(step.labelKey)}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

// A single labelled cell in the ticket's meta grid.
function MetaCell({ icon: Icon, label, value, title }) {
  return (
    <div className="bg-white p-4 dark:bg-gray-900/70">
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="mt-1 truncate text-sm font-medium text-gray-800 dark:text-gray-200" title={title}>
        {value || '—'}
      </p>
    </div>
  )
}

export default function GuestTrackPage() {
  const { t, lang } = useI18n()
  const [params, setParams] = useSearchParams()
  const stored = useRef(readSession()).current
  const [phone, setPhone] = useState(stored.phone || '')
  const [reference, setReference] = useState(params.get('ref') || stored.reference || '')
  const [ticket, setTicket] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [checkedAt, setCheckedAt] = useState(null)
  const [reply, setReply] = useState('')
  const [replyError, setReplyError] = useState('')
  const [replying, setReplying] = useState(false)
  const [ratingScore, setRatingScore] = useState(0)
  const [ratingHover, setRatingHover] = useState(0)
  const [ratingComment, setRatingComment] = useState('')
  const [ratingSubmitting, setRatingSubmitting] = useState(false)
  const [ratingError, setRatingError] = useState('')

  // One lookup path for the form, the auto-restore on mount, and the refresh button.
  const load = useCallback(
    async ({ ref, tel, silent = false }) => {
      if (!ref || !tel) return
      setError('')
      if (silent) setRefreshing(true)
      else setLoading(true)
      try {
        const data = await trackGuestTicket({ phone: tel, reference: ref })
        setTicket(data)
        setCheckedAt(Date.now())
        sessionStorage.setItem(SESSION_KEY, JSON.stringify({ reference: ref, phone: tel }))
        setParams((prev) => {
          const next = new URLSearchParams(prev)
          next.set('ref', ref)
          return next
        }, { replace: true })
      } catch (err) {
        if (!silent) setTicket(null)
        setError(
          err?.response?.status === 404 ? t('guest.track.notFound') : t('guest.track.error')
        )
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [setParams, t]
  )

  // Restore the ticket the guest was already looking at in this tab.
  useEffect(() => {
    const ref = params.get('ref') || stored.reference
    if (ref && stored.phone) load({ ref, tel: stored.phone })
    // Mount only — later lookups go through the form, refresh, or reply handlers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function lookup(event) {
    event?.preventDefault()
    return load({ ref: reference.trim(), tel: phone.trim() })
  }

  function changeTicket() {
    setTicket(null)
    setError('')
    setCheckedAt(null)
    sessionStorage.removeItem(SESSION_KEY)
  }

  async function handleRate(event) {
    event.preventDefault()
    if (!ratingScore) return
    setRatingSubmitting(true)
    setRatingError('')
    try {
      await rateGuestTicket({ phone, reference, score: ratingScore, comment: ratingComment })
      await load({ ref: reference, tel: phone, silent: true })
    } catch (err) {
      setRatingError(err?.response?.data?.detail || t('rate.error'))
    } finally {
      setRatingSubmitting(false)
    }
  }

  async function handleReply(event) {
    event.preventDefault()
    if (!reply.trim()) return
    setReplying(true)
    setReplyError('')
    try {
      await replyGuestTicket({ phone, reference, body: reply })
      setReply('')
      await load({ ref: reference, tel: phone, silent: true })
    } catch {
      setReplyError(t('guest.track.replyError'))
    } finally {
      setReplying(false)
    }
  }

  const canReply = ticket && ticket.status !== 'closed'

  return (
    <GuestShell
      title={t('guest.track.title')}
      subtitle={t('guest.track.subtitle')}
      maxWidth={ticket ? 'max-w-6xl' : 'max-w-2xl'}
      footer={
        <>
          {t('guest.track.needNew')}{' '}
          <Link to="/guest/new" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
            {t('guest.submitTicket')}
          </Link>
        </>
      }
    >
      {ticket ? (
        // Once a ticket is on screen the lookup form collapses to a single line so the
        // ticket itself gets the page.
        <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-200/70 bg-white px-4 py-2.5 text-sm shadow-soft dark:border-white/10 dark:bg-gray-900/70">
          <span className="min-w-0 truncate text-gray-500 dark:text-gray-400">
            {t('guest.track.tracking')}{' '}
            <span className="font-mono font-semibold text-gray-800 dark:text-gray-200">
              {ticket.reference || `#${ticket.id}`}
            </span>
          </span>
          <button
            type="button"
            onClick={changeTicket}
            className="shrink-0 font-medium text-indigo-600 hover:underline dark:text-indigo-400"
          >
            {t('guest.track.change')}
          </button>
        </div>
      ) : (
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
          {error && (
            <p className="mt-3 text-sm text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          )}
        </Card>
      )}

      {loading && !ticket && (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      )}

      {ticket && (
        // Details on one side, the conversation alongside it on wide screens; stacked below lg.
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
          <div className="flex flex-col gap-6">
            <div className="overflow-hidden rounded-2xl border border-gray-200/70 bg-white shadow-soft dark:border-white/10 dark:bg-gray-900/70">
              {/* Header: reference + subject, status on the end */}
              <div className="flex items-start justify-between gap-3 p-5">
                <div className="min-w-0">
                  <span className="rounded-md bg-indigo-50 px-2 py-0.5 font-mono text-xs font-semibold text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
                    {ticket.reference || `#${ticket.id}`}
                  </span>
                  <h2 className="mt-2 text-xl font-semibold leading-snug text-gray-900 dark:text-gray-100">
                    {ticket.subject}
                  </h2>
                </div>
                <StatusBadge status={ticket.status} assigned={ticket.is_assigned} />
              </div>

              {/* Where the ticket stands right now — the reason this page exists. */}
              <div className="border-t border-gray-100 px-5 py-5 dark:border-white/10">
                <ProgressTrail status={ticket.status} />

                {/* On hold is the one state the trail can't explain on its own — say why. */}
                {ticket.status === 'on_hold' && ticket.hold_reason && (
                  <div className="mt-4 flex items-start gap-2 rounded-xl border border-purple-200 bg-purple-50 px-3 py-2 text-sm text-purple-800 dark:border-purple-900/50 dark:bg-purple-900/20 dark:text-purple-200">
                    <ClockIcon className="mt-0.5 h-4 w-4 shrink-0" />
                    <span className="whitespace-pre-wrap">
                      <span className="font-medium">{t('tickets.onHold')}</span> {ticket.hold_reason}
                    </span>
                  </div>
                )}

                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3 text-xs text-gray-500 dark:border-white/10 dark:text-gray-400">
                  <span className="inline-flex items-center gap-1.5">
                    <UserIcon className="h-3.5 w-3.5" />
                    {ticket.assigned_agent_name
                      ? `${t('guest.track.handledBy')} ${ticket.assigned_agent_name}`
                      : t('guest.track.awaitingAgent')}
                  </span>
                  <button
                    type="button"
                    onClick={() => load({ ref: reference, tel: phone, silent: true })}
                    disabled={refreshing}
                    className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 font-medium text-gray-600 transition-colors hover:bg-gray-100 disabled:opacity-60 dark:text-gray-300 dark:hover:bg-white/10"
                  >
                    <RefreshIcon className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                    {checkedAt ? `${t('guest.track.checked')} ${timeAgo(checkedAt, lang)}` : t('guest.track.refresh')}
                  </button>
                </div>
              </div>

              {/* Meta grid — separated cells via a subtle gap */}
              <div className="grid grid-cols-2 gap-px border-y border-gray-100 bg-gray-100 dark:border-white/10 dark:bg-white/10 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
                <MetaCell icon={FolderOpenIcon} label={t('field.category')} value={ticket.category} />
                <MetaCell icon={BadgeIcon} label={t('guest.track.priority')} value={ticket.priority_display} />
                <MetaCell
                  icon={CalendarIcon}
                  label={t('guest.track.submitted')}
                  value={new Date(ticket.created_at).toLocaleDateString()}
                  title={new Date(ticket.created_at).toLocaleString()}
                />
                <MetaCell
                  icon={ClockIcon}
                  label={t('guest.track.lastUpdated')}
                  value={timeAgo(ticket.updated_at, lang)}
                  title={new Date(ticket.updated_at).toLocaleString()}
                />
              </div>

              {/* Description */}
              <div className="p-5">
                <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
                  {t('field.description')}
                </p>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                  {ticket.description}
                </p>
                {ticket.attachments?.length > 0 && (
                  <div className="mt-4">
                    <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
                      {t('guest.track.attachments')}
                    </p>
                    <AttachmentList attachments={ticket.attachments} />
                  </div>
                )}
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                {error}
              </p>
            )}

            {ticket.status === 'closed' && (
              <Card>
                <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {t('guest.track.rateTitle')}
                </h3>
                {ticket.rating_submitted_at ? (
                  <div className="flex flex-col items-center gap-2 py-2">
                    <div className="flex gap-1 text-amber-400">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <StarIcon key={n} filled={n <= ticket.rating} className="h-7 w-7" />
                      ))}
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{t('rate.thanks')}</p>
                  </div>
                ) : (
                  <form onSubmit={handleRate} className="flex flex-col items-center gap-4 py-2">
                    <p className="text-sm text-gray-600 dark:text-gray-300">{t('rate.prompt')}</p>
                    <div className="flex gap-1.5" role="radiogroup" onMouseLeave={() => setRatingHover(0)}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          type="button"
                          role="radio"
                          aria-checked={ratingScore === n}
                          onClick={() => setRatingScore(n)}
                          onMouseEnter={() => setRatingHover(n)}
                          aria-label={`${n} / 5`}
                          className={`rounded-lg transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                            (ratingHover || ratingScore) >= n
                              ? 'text-amber-400'
                              : 'text-gray-300 dark:text-gray-600'
                          }`}
                        >
                          <StarIcon filled={(ratingHover || ratingScore) >= n} className="h-9 w-9" />
                        </button>
                      ))}
                    </div>
                    <Textarea
                      className="w-full"
                      rows={3}
                      placeholder={t('rate.commentPlaceholder')}
                      value={ratingComment}
                      onChange={(e) => setRatingComment(e.target.value)}
                    />
                    {ratingError && (
                      <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                        {ratingError}
                      </p>
                    )}
                    <Button type="submit" loading={ratingSubmitting} disabled={!ratingScore}>
                      {t('rate.submit')}
                    </Button>
                  </form>
                )}
              </Card>
            )}
          </div>

          <Card className="flex flex-col lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)]">
            <h3 className="mb-4 shrink-0 text-sm font-semibold text-gray-900 dark:text-gray-100">
              {t('guest.track.conversation')}
            </h3>
            {ticket.comments?.length ? (
              <ul className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
                {ticket.comments.map((c) => {
                  const staff = c.is_staff
                  return (
                    <li
                      key={c.id}
                      className={`flex max-w-[85%] flex-col gap-1 ${staff ? 'self-start' : 'self-end'}`}
                    >
                      <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
                        {staff && (
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-semibold text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">
                            {initials(c.author_name)}
                          </span>
                        )}
                        <span className="font-medium text-gray-700 dark:text-gray-300">
                          {staff ? c.author_name : t('guest.track.you')}
                        </span>
                        <span title={new Date(c.created_at).toLocaleString()}>
                          {timeAgo(c.created_at, lang)}
                        </span>
                      </div>
                      <div
                        className={`rounded-2xl px-3.5 py-2.5 ${
                          staff
                            ? 'rounded-ss-sm border border-gray-200/70 bg-gray-50 dark:border-white/10 dark:bg-white/5'
                            : 'rounded-se-sm bg-indigo-50 dark:bg-indigo-500/10'
                        }`}
                      >
                        <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800 dark:text-gray-200">
                          {c.body}
                        </p>
                        {c.attachments?.length > 0 && (
                          <div className="mt-2">
                            <AttachmentList attachments={c.attachments} />
                          </div>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="shrink-0 rounded-xl border border-dashed border-gray-200 py-6 text-center text-sm text-gray-400 dark:border-white/10 dark:text-gray-500">
                {t('guest.track.noReplies')}
              </p>
            )}

            {canReply ? (
              <form
                onSubmit={handleReply}
                className="mt-4 flex shrink-0 flex-col gap-2 border-t border-gray-100 pt-4 dark:border-white/10"
              >
                <Textarea
                  placeholder={t('guest.track.replyPlaceholder')}
                  rows={3}
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                />
                {replyError && (
                  <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                    {replyError}
                  </p>
                )}
                <Button type="submit" loading={replying} disabled={!reply.trim()} className="self-start">
                  {t('guest.track.sendReply')}
                </Button>
              </form>
            ) : (
              <p className="mt-4 shrink-0 border-t border-gray-100 pt-4 text-sm text-gray-500 dark:border-white/10 dark:text-gray-400">
                {t('guest.track.closedNotice')}{' '}
                <Link to="/guest/new" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                  {t('guest.submitTicket')}
                </Link>
              </p>
            )}
          </Card>
        </div>
      )}
    </GuestShell>
  )
}
