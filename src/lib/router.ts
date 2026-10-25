import { useSyncExternalStore } from 'react'

export type Route =
  | { name: 'recipe'; id: string; fresh?: boolean }
  | { name: 'new' }
  | { name: 'edit'; id: string }
  | { name: 'profile'; id: string }
  | { name: 'settings' }

export function parseRoute(path: string): Route | null {
  const [a, b, c] = path.replace(/^#?\/?/, '').split('/')
  if (a === 'r' && b) return { name: 'recipe', id: decodeURIComponent(b), fresh: c === 'fresh' }
  if (a === 'new') return { name: 'new' }
  if (a === 'edit' && b) return { name: 'edit', id: decodeURIComponent(b) }
  if (a === 'p' && b) return { name: 'profile', id: decodeURIComponent(b) }
  if (a === 'settings') return { name: 'settings' }
  return null
}

/**
 * Screens stack on top of the dex. The stack lives in history.state so the
 * Android back gesture pops exactly one screen.
 */
let stack: string[] = []
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

function init() {
  const st = history.state?.ddx
  if (Array.isArray(st)) {
    stack = st
    return
  }
  const hash = location.hash.slice(1)
  if (parseRoute(hash)) {
    // Deep link / reload: put a dex entry underneath so "back" stays in the app.
    history.replaceState({ ddx: [] }, '', location.pathname + location.search)
    stack = [hash]
    history.pushState({ ddx: stack }, '', '#' + hash)
  } else {
    stack = []
    history.replaceState({ ddx: [] }, '', location.href)
  }
}
init()

window.addEventListener('popstate', (e) => {
  stack = Array.isArray(e.state?.ddx) ? e.state.ddx : []
  emit()
})

export function go(path: string) {
  stack = [...stack, path]
  history.pushState({ ddx: stack }, '', '#' + path)
  emit()
}

export function replace(path: string) {
  stack = [...stack.slice(0, -1), path]
  history.replaceState({ ddx: stack }, '', '#' + path)
  emit()
}

export function back() {
  if (stack.length) history.back()
}

export function home() {
  if (stack.length) history.go(-stack.length)
}

export function clearUrlHash() {
  history.replaceState({ ddx: stack }, '', location.pathname + location.search + (stack.length ? '#' + stack[stack.length - 1] : ''))
}

export const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => void listeners.delete(l)
}
export const currentStack = () => stack
export const useStack = () => useSyncExternalStore(subscribe, () => stack)
