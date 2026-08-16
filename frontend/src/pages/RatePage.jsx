import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import GuestShell from '../components/layout/GuestShell'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Spinner from '../components/ui/Spinner'
import Textarea from '../components/ui/Textarea'
import EmptyState from '../components/ui/EmptyState'
import { CheckCircleIcon, StarIcon } from '../components/ui/icons'
import { fetchRatingTicket, submitRating } from '../api/tickets'
import { useI18n } from '../i18n/useI18n'

export default function RatePage() {
  const { t } = useI18n()
  const { id } = useParams()
  const [params] = useSearchParams()
  const token = params.get('token') || ''

  const [state, setState] = useState('loading') // loading | invalid | form | done
  const [ticket, setTicket] = useState(null)
  const [score, setScore] = useState(0)
  const [hover, setHover] = useState(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) {
      setState('invalid')
      return
    }
    fetchRatingTicket({ id, token })
      .then((data) => {
        setTicket(data)
        setState(data.rated ? 'done' : 'form')
      })
      .catch(() => setState('invalid'))
  }, [id, token])

  async function submit(event) {
    event.preventDefault()
    if (!score) return
    setSubmitting(true)
    setError('')
    try {
      await submitRating({ id, token, score, comment })
      setState('done')
    } catch (err) {
      setError(err?.response?.data?.detail || t('rate.error'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <GuestShell title={t('rate.title')} subtitle={t('rate.subtitle')}>
      <Card>
        {state === 'loading' && (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        )}

        {state === 'invalid' && <EmptyState title={t('rate.invalid')} />}

        {state === 'done' && (
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
              <CheckCircleIcon className="h-7 w-7" />
            </span>
            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t('rate.thanks')}</p>
            {ticket?.rating != null && (
              <div className="flex gap-1 text-amber-400">
                {[1, 2, 3, 4, 5].map((n) => (
                  <StarIcon key={n} filled={n <= ticket.rating} className="h-7 w-7" />
                ))}
              </div>
            )}
          </div>
        )}

        {state === 'form' && (
          <form onSubmit={submit} className="flex flex-col items-center gap-5 py-2">
            {ticket && (
              <p className="text-center text-sm text-gray-600 dark:text-gray-300">
                <span className="font-mono text-xs text-gray-400 dark:text-gray-400">
                  {ticket.reference}
                </span>
                <span className="mt-1 block font-medium text-gray-900 dark:text-gray-100">
                  {ticket.subject}
                </span>
              </p>
            )}
            <p className="text-sm text-gray-600 dark:text-gray-300">{t('rate.prompt')}</p>
            <div className="flex gap-1.5" onMouseLeave={() => setHover(0)}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setScore(n)}
                  onMouseEnter={() => setHover(n)}
                  aria-label={`${n} / 5`}
                  className={`transition-transform hover:scale-110 ${
                    (hover || score) >= n ? 'text-amber-400' : 'text-gray-300 dark:text-gray-500'
                  }`}
                >
                  <StarIcon filled={(hover || score) >= n} className="h-10 w-10" />
                </button>
              ))}
            </div>
            <div className="w-full">
              <Textarea
                className="w-full"
                rows={3}
                placeholder={t('rate.commentPlaceholder')}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            <Button type="submit" loading={submitting} disabled={!score}>
              {t('rate.submit')}
            </Button>
          </form>
        )}
      </Card>
    </GuestShell>
  )
}
