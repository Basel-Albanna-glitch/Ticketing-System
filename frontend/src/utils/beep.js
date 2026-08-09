// A short two-tone chime for new-ticket alerts, synthesised with the Web Audio API so the
// repo carries no audio binary and the sound stays crisp at any volume.

let ctx = null

function audioContext() {
  const Ctor = window.AudioContext || window.webkitAudioContext
  if (!Ctor) return null
  if (!ctx) ctx = new Ctor()
  return ctx
}

// Browsers start every AudioContext suspended until the page has seen a real gesture. Arm it
// on the first click/keypress so the beep isn't swallowed the one time it actually matters.
export function unlockBeep() {
  const context = audioContext()
  if (context && context.state === 'suspended') context.resume()
}

function tone(context, frequency, startAt, duration) {
  const osc = context.createOscillator()
  const gain = context.createGain()
  osc.type = 'sine'
  osc.frequency.value = frequency
  // Ramp in and out — a square-edged envelope pops audibly.
  gain.gain.setValueAtTime(0, startAt)
  gain.gain.linearRampToValueAtTime(0.18, startAt + 0.012)
  gain.gain.setValueAtTime(0.18, startAt + duration - 0.05)
  gain.gain.linearRampToValueAtTime(0, startAt + duration)
  osc.connect(gain)
  gain.connect(context.destination)
  osc.start(startAt)
  osc.stop(startAt + duration)
}

export function playNewTicketBeep() {
  const context = audioContext()
  if (!context) return
  if (context.state === 'suspended') context.resume()
  const now = context.currentTime
  tone(context, 880, now, 0.14) // A5
  tone(context, 1174.66, now + 0.16, 0.2) // D6
}
