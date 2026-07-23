import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import ThemeToggle from '../components/ui/ThemeToggle'
import LanguageToggle from '../components/ui/LanguageToggle'
import Logo from '../components/ui/Logo'
import { BoardIcon, LockIcon, ReportsIcon, TicketIcon, UserIcon } from '../components/ui/icons'
import { useAuth } from '../auth/useAuth'
import { useI18n } from '../i18n/useI18n'

const FEATURES = [
  { icon: TicketIcon, key: 'login.feature1' },
  { icon: BoardIcon, key: 'login.feature2' },
  { icon: ReportsIcon, key: 'login.feature3' },
]

export default function LoginPage() {
  const { user, login } = useAuth()
  const { t } = useI18n()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (user) {
    return <Navigate to="/dashboard" replace />
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)
    try {
      await login(username, password)
      navigate('/dashboard')
    } catch {
      setError(t('login.invalid'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      {/* Branding panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 p-12 text-white lg:flex">
        {/* soft glows for depth */}
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-indigo-400/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-violet-500/30 blur-3xl" />
        {/* dot grid */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.15]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 20%, white 1px, transparent 1px), radial-gradient(circle at 60% 70%, white 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />

        <div className="relative">
          <Logo variant="light" />
        </div>

        <div className="relative">
          <h2 className="text-4xl font-semibold leading-tight tracking-tight">
            {t('login.heroTitle')}
          </h2>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-indigo-100/80">
            {t('login.heroSubtitle')}
          </p>
          <ul className="mt-8 flex flex-col gap-3">
            {FEATURES.map(({ icon: FeatureIcon, key }) => (
              <li
                key={key}
                className="flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3 ring-1 ring-inset ring-white/15 backdrop-blur-sm"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15">
                  <FeatureIcon className="h-4 w-4" />
                </div>
                <span className="text-sm text-indigo-50">{t(key)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative flex items-center gap-3 text-xs text-indigo-200/80">
          <span>© {new Date().getFullYear()} Hermes</span>
          <span className="h-1 w-1 rounded-full bg-indigo-300/50" />
          <span>{t('login.footerTagline')}</span>
        </div>
      </div>

      {/* Form panel */}
      <div className="relative flex items-center justify-center overflow-hidden bg-gray-50 px-4 py-12 dark:bg-gray-950">
        <div className="pointer-events-none absolute -top-24 right-0 h-72 w-72 rounded-full bg-indigo-500/10 blur-3xl dark:bg-indigo-500/15" />
        <div className="absolute end-4 top-4 flex items-center gap-1">
          <LanguageToggle />
          <ThemeToggle />
        </div>

        <div className="relative w-full max-w-sm">
          <Logo className="mb-8 lg:hidden" />

          <div className="rounded-2xl border border-gray-200/70 bg-white p-8 shadow-soft-lg dark:border-white/10 dark:bg-gray-900/70">
            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm ring-1 ring-inset ring-white/20">
              <LockIcon className="h-6 w-6" />
            </div>

            <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
              {t('login.welcome')}
            </h1>
            <p className="mb-6 mt-1 text-sm text-gray-500 dark:text-gray-400">
              {t('login.subtitle')}
            </p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <Input
                label={t('login.username')}
                name="username"
                icon={UserIcon}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
              />
              <Input
                label={t('login.password')}
                type="password"
                name="password"
                icon={LockIcon}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
              <Button type="submit" loading={isSubmitting} className="mt-2 w-full">
                {t('login.signIn')}
              </Button>
            </form>
          </div>

          <div className="mt-6 text-center text-sm">
            <p className="text-gray-500 dark:text-gray-400">{t('login.noAccount')}</p>
            <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1">
              <Link to="/guest/new" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                {t('login.guestSubmit')}
              </Link>
              <span className="text-gray-300 dark:text-gray-600">·</span>
              <Link to="/guest/track" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                {t('login.guestTrack')}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
