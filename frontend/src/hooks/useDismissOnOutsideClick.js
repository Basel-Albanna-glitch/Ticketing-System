import { useEffect } from 'react'

// Is this press on a scrollbar gutter rather than on content?
//
// Grabbing a scrollbar fires mousedown on the element that scrolls — the modal body, a
// scrolling panel, or <html> for the window's own bar. That element sits outside any
// open popover, so a naive outside-click check reads "clicked elsewhere" and shuts the
// menu the moment you reach for its scrollbar.
//
// A scrollbar lives in the padding box but outside the *client* box, which is what makes
// it detectable: measure the press against the client box and anything landing beyond it
// is on the furniture, not the content.
function isScrollbarPress(event) {
  const el = event.target
  if (!(el instanceof Element)) return false

  const root = document.documentElement
  if (el === root || el === document.body) {
    // The document's own bars are not inside its rect, so they need the viewport as the
    // reference instead. In RTL the vertical bar sits on the left, hence the direction
    // check rather than assuming the right edge.
    const barWidth = window.innerWidth - root.clientWidth
    const barHeight = window.innerHeight - root.clientHeight
    const rtl = getComputedStyle(root).direction === 'rtl'
    const onVertical =
      barWidth > 0 && (rtl ? event.clientX < barWidth : event.clientX >= root.clientWidth)
    const onHorizontal = barHeight > 0 && event.clientY >= root.clientHeight
    return onVertical || onHorizontal
  }

  // clientLeft/clientTop cover the border and, in RTL, a left-hand scrollbar — so this
  // holds whichever side the bar is on.
  const rect = el.getBoundingClientRect()
  const x = event.clientX - rect.left - el.clientLeft
  const y = event.clientY - rect.top - el.clientTop
  return x < 0 || x >= el.clientWidth || y < 0 || y >= el.clientHeight
}

/**
 * Call `onDismiss` when a press lands outside `ref`, ignoring scrollbar grabs.
 *
 * `active` skips the listener entirely while the thing is already closed, so a page of
 * dropdowns is not a page of document-level handlers.
 */
export default function useDismissOnOutsideClick(ref, onDismiss, active = true) {
  useEffect(() => {
    if (!active) return undefined
    function onPointerDown(event) {
      if (isScrollbarPress(event)) return
      if (ref.current && !ref.current.contains(event.target)) onDismiss()
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [ref, onDismiss, active])
}
