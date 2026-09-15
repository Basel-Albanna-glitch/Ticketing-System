import logoUrl from '../assets/logo.jpeg'

// Operating-system notifications (the Windows toast in the corner), raised from the
// notification poll while the app is open in a tab. Browsers allow them only on a secure
// origin — HTTPS, or localhost — and only once the person grants permission. Whether they
// want them is remembered per browser, because the permission itself is per browser too.
const KEY = 'desktop_notifications'

export function desktopNotificationsSupported() {
  return typeof window !== 'undefined' && 'Notification' in window && window.isSecureContext
}

// 'granted', 'denied', 'default' (never asked), or 'unsupported'.
export function desktopPermission() {
  return desktopNotificationsSupported() ? Notification.permission : 'unsupported'
}

export function desktopNotificationsWanted() {
  try {
    return localStorage.getItem(KEY) === 'on'
  } catch {
    return false
  }
}

export function setDesktopNotificationsWanted(on) {
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off')
  } catch {
    // Storage can be unavailable (private windows); the switch just won't be remembered.
  }
}

// On only when the browser can, the person allowed it, and they haven't switched it off here.
export function desktopNotificationsActive() {
  return desktopPermission() === 'granted' && desktopNotificationsWanted()
}

// Asks the browser, which shows its own prompt, and records the outcome. Resolves to the
// resulting permission.
export async function enableDesktopNotifications() {
  if (!desktopNotificationsSupported()) return 'unsupported'
  const permission =
    Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission()
  setDesktopNotificationsWanted(permission === 'granted')
  return permission
}

// Clicking one brings the app's tab to the front before doing whatever `onClick` says.
// `tag` makes a repeat of the same notification replace the first rather than stack.
export function showDesktopNotification(title, { body, tag, onClick } = {}) {
  try {
    const notification = new Notification(title, { body, tag, icon: logoUrl })
    notification.onclick = () => {
      window.focus()
      onClick?.()
      notification.close()
    }
  } catch {
    // Some browsers (Chrome on Android) only raise these from a service worker.
  }
}
