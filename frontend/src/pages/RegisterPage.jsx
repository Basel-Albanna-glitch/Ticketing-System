import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import ThemeToggle from '../components/ui/ThemeToggle'
import Logo from '../components/ui/Logo'
import {
  AtSignIcon,
  BoardIcon,
  EnvelopeIcon,
  LockIcon,
  ReportsIcon,
  TicketIcon,
  UserIcon,
} from '../components/ui/icons'
import { useAuth } from '../auth/useAuth'
import { useI18n } from '../i18n/useI18n'

const FEATURES = [
  { icon: TicketIcon, key: 'login.feature1' },
  { icon: BoardIcon, key: 'login.feature2' },
  { icon: ReportsIcon, key: 'login.feature3' },
]

export default function RegisterPage() {
  const { user, register } = useAuth()
  const { t } = useI18n()
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (user) {
    return <Navigate to="/dashboard" replace />
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    if (password !== confirmPassword) {
      setError(t('register.passwordsNoMatch'))
      return
    }
    setIsSubmitting(true)
    try {
      await register(fullName, username, email, password, confirmPassword)
      navigate('/dashboard')
    } catch (err) {
      const data = err?.response?.data
      const message = data ? Object.values(data).flat().join(' ') : t('register.failed')
      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      {/* Branding panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 p-12 text-white lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
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
          <h2 className="text-3xl font-semibold leading-tight">{t('register.heroTitle')}</h2>
          <ul className="mt-8 flex flex-col gap-4">
            {FEATURES.map(({ icon: FeatureIcon, key }) => (
              <li key={key} className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white/15">
                  <FeatureIcon className="h-4 w-4" />
                </div>
                <span className="text-sm text-indigo-50">{t(key)}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-indigo-200">© {new Date().getFullYear()} Hermes</p>
      </div>

      {/* Form panel */}
      <div className="relative flex items-center justify-center bg-gray-50 px-4 py-12 dark:bg-gray-950">
        <div className="absolute end-4 top-4">
          <ThemeToggle />
        </div>

        <div className="w-full max-w-sm">
          <Logo className="mb-8 lg:hidden" />

          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{t('register.title')}</h1>
          <p className="mt-1 mb-8 text-sm text-gray-500 dark:text-gray-400">
            {t('register.subtitle')}
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label={t('field.fullName')}
              name="fullName"
              icon={UserIcon}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              autoFocus
            />
            <Input
              label={t('field.username')}
              name="username"
              icon={AtSignIcon}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
            <Input
              label={t('register.emailOptional')}
              type="email"
              name="email"
              icon={EnvelopeIcon}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Input
              label={t('field.password')}
              type="password"
              name="password"
              icon={LockIcon}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <Input
              label={t('register.confirmPassword')}
              type="password"
              name="confirmPassword"
              icon={LockIcon}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            <Button type="submit" loading={isSubmitting} className="mt-2 w-full">
              {t('register.createAccount')}
            </Button>
          </form>

          <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">
            {t('register.haveAccount')}{' '}
            <Link to="/login" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
              {t('login.signIn')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
