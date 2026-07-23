import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import Footer from './Footer'

const isDesktop = () => typeof window !== 'undefined' && window.innerWidth >= 1024

export default function AppShell() {
  // On desktop, honor the remembered preference. On mobile, always start closed
  // so the drawer doesn't cover the screen on load.
  const [sidebarOpen, setSidebarOpen] = useState(
    () => isDesktop() && localStorage.getItem('sidebar_open') !== 'false'
  )

  function toggleSidebar() {
    setSidebarOpen((open) => {
      const next = !open
      if (isDesktop()) localStorage.setItem('sidebar_open', String(next))
      return next
    })
  }

  // Close the drawer after navigating on mobile (no-op on desktop).
  function handleNavigate() {
    if (!isDesktop()) setSidebarOpen(false)
  }

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950">
      <Sidebar open={sidebarOpen} onNavigate={handleNavigate} />

      {/* Mobile backdrop — only visible below lg while the drawer is open */}
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-gray-900/50 backdrop-blur-sm lg:hidden"
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onToggleSidebar={toggleSidebar} />
        <main className="flex flex-1 flex-col p-4 sm:p-6">
          <Outlet />
        </main>
        <Footer />
      </div>
    </div>
  )
}
