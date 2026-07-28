import { Link } from 'react-router-dom'
import Logo from '../ui/Logo'
import ThemeToggle from '../ui/ThemeToggle'
import LanguageToggle from '../ui/LanguageToggle'
import Footer from './Footer'

// `footer` is this page's own closing note (links, hints); the site Footer below it is the
// same copyright bar the signed-in app uses.
export default function GuestShell({ title, subtitle, children, footer, maxWidth = 'max-w-xl' }) {
  return (
    <div className="flex min-h-screen flex-col bg-gray-50 dark:bg-gray-950">
      <header className="flex items-center justify-between px-6 py-4">
        <Link to="/login" aria-label="Home">
          <Logo />
        </Link>
        <div className="flex items-center gap-1">
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </header>
      <main className={`mx-auto w-full flex-1 ${maxWidth} px-4 pb-16 pt-4`}>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>}
        <div className="mt-6">{children}</div>
        {footer && (
          <div className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">{footer}</div>
        )}
      </main>
      <Footer />
    </div>
  )
}
