import { textToB64 } from './b64'
import { isIOS, isStandalone } from './device'
import { getRemote, useApp } from './store'

/**
 * Private, technical-only diagnostics, written to diagnostics/<person>-<device>.json
 * in the recipes repo so problems on a phone we can't test directly (iPhone) are
 * visible. Records: app version, device/OS, JS errors, and taps that didn't
 * register (with what was under the finger). No recipe content.
 */
interface DiagEvent {
  at: string
  type: string
  [k: string]: unknown
}

const MAX = 80
const events: DiagEvent[] = []
let dirty = false
let timer: ReturnType<typeof setTimeout> | undefined
let lastFlush = 0

const deviceKey = (() => {
  try {
    let k = localStorage.getItem('dishdex:device-key')
    if (!k) {
      k = Math.random().toString(36).slice(2, 8)
      localStorage.setItem('dishdex:device-key', k)
    }
    return k
  } catch {
    return 'nostore'
  }
})()

function describe(el: Element | null): string | null {
  if (!el) return null
  const cs = getComputedStyle(el)
  const cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/).slice(0, 3).join('.') : ''
  const label = (el.getAttribute('aria-label') || '').slice(0, 30)
  return `${el.tagName.toLowerCase()}${cls ? '.' + cls : ''}${label ? ` "${label}"` : ''} [pe:${cs.pointerEvents} op:${cs.opacity} vis:${cs.visibility} pos:${cs.position} z:${cs.zIndex}]`
}

const OVERLAYS = '.layer, .scrim, .sheet-wrap, .celebrate, .splash, .toasts'

function overlays() {
  return Array.from(document.querySelectorAll(OVERLAYS)).map((el) => describe(el))
}

export function record(type: string, data: Record<string, unknown> = {}) {
  events.push({ at: new Date().toISOString(), type, ...data })
  if (events.length > MAX) events.splice(0, events.length - MAX)
  dirty = true
  schedule()
}

function schedule() {
  clearTimeout(timer)
  const wait = Math.max(8000, 60_000 - (Date.now() - lastFlush))
  timer = setTimeout(() => void flush(), wait)
}

async function flush() {
  const { me, phase } = useApp.getState()
  const r = getRemote()
  if (!dirty || !r || phase !== 'ready' || !navigator.onLine) return schedule()
  dirty = false
  lastFlush = Date.now()
  const path = `diagnostics/${me ?? 'unknown'}-${deviceKey}.json`
  const body = {
    v: 1,
    version: __BUILD__,
    device: { ua: navigator.userAgent, ios: isIOS(), standalone: isStandalone(), viewport: `${innerWidth}x${innerHeight}`, dpr: devicePixelRatio },
    updatedAt: new Date().toISOString(),
    events,
  }
  try {
    const cur = await r.get(path)
    await r.put(path, textToB64(JSON.stringify(body, null, 2) + '\n'), `Diagnostics (${deviceKey})`, cur?.sha)
  } catch {
    dirty = true
  }
}

let started = false
export function startDiagnostics() {
  if (started) return
  started = true
  if (import.meta.env.DEV) (window as any).dishdexDiag = { flush: () => ((lastFlush = 0), flush()), events }
  // Report each new version once per phone (so we can see who's up to date) without a commit per launch.
  let seenVersion: string | null = null
  try {
    seenVersion = localStorage.getItem('dishdex:diag-version')
    localStorage.setItem('dishdex:diag-version', __BUILD__)
  } catch {
    /* no storage */
  }
  if (seenVersion !== __BUILD__) record('launch', { version: __BUILD__, standalone: isStandalone(), viewport: `${innerWidth}x${innerHeight}` })

  window.addEventListener('error', (e) => record('error', { message: String(e.message).slice(0, 300), source: `${e.filename}:${e.lineno}` }))
  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason
    record('rejection', { message: String(r?.message ?? r).slice(0, 300), stack: String(r?.stack ?? '').split('\n').slice(0, 3).join(' | ') })
  })

  // A tap (no drag) that doesn't produce a click within 600ms: note what was under the finger.
  let down: { x: number; y: number; at: number } | null = null
  document.addEventListener('pointerdown', (e) => (down = { x: e.clientX, y: e.clientY, at: Date.now() }), { capture: true, passive: true })
  document.addEventListener(
    'pointerup',
    (e) => {
      const d = down
      down = null
      if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 10 || Date.now() - d.at > 800) return
      let clicked = false
      const onClick = () => (clicked = true)
      document.addEventListener('click', onClick, { capture: true, once: true })
      setTimeout(() => {
        document.removeEventListener('click', onClick, true)
        if (clicked) return
        const stack = document.elementsFromPoint(d.x, d.y)
        const top = stack[0] ?? null
        const aimedAt = stack.find((el) => el.closest('button, a, input, textarea, select, [role="button"]'))
        if (!aimedAt) return // tapped empty space; not interesting
        record(top && aimedAt !== top && !top.closest('button, a, input, textarea, select, [role="button"]') ? 'covered-tap' : 'no-click-tap', {
          x: Math.round(d.x),
          y: Math.round(d.y),
          top: describe(top),
          aimedAt: describe(aimedAt.closest('button, a, input, textarea, select, [role="button"]')),
          stack: stack.slice(0, 6).map(describe),
          overlays: overlays(),
          route: location.hash,
          active: describe(document.activeElement),
        })
      }, 600)
    },
    { capture: true, passive: true },
  )

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && dirty) void flush()
  })
}
