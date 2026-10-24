export const tap = (ms = 8) => {
  try {
    navigator.vibrate?.(ms)
  } catch {
    /* unsupported */
  }
}

export const isIOS = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as any).standalone === true ||
  (import.meta.env.DEV && new URLSearchParams(location.search).has('standalone'))

/** Chrome's install prompt, captured for a custom "Install" button. */
let deferred: any = null
const subs = new Set<() => void>()
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  deferred = e
  subs.forEach((s) => s())
})
window.addEventListener('appinstalled', () => {
  deferred = null
  subs.forEach((s) => s())
})
export const canPromptInstall = () => !!deferred
export const onInstallChange = (f: () => void) => {
  subs.add(f)
  return () => subs.delete(f)
}
export async function promptInstall() {
  if (!deferred) return false
  deferred.prompt()
  const { outcome } = await deferred.userChoice
  deferred = null
  subs.forEach((s) => s())
  return outcome === 'accepted'
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  }
}

export const relTime = (iso: string) => {
  const d = (Date.now() - new Date(iso).getTime()) / 1000
  if (d < 60) return 'just now'
  if (d < 3600) return `${Math.floor(d / 60)}m ago`
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`
  if (d < 86400 * 7) return `${Math.floor(d / 86400)}d ago`
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}
