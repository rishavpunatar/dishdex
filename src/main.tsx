import '@fontsource-variable/fraunces/opsz.css'
import '@fontsource-variable/fraunces/opsz-italic.css'
import '@fontsource-variable/inter'
import './styles.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'

// iOS keeps fixed elements behind the keyboard; lift bottom sheets by the keyboard's height.
const vv = window.visualViewport
if (vv) {
  const update = () => {
    const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
    document.documentElement.style.setProperty('--kb', `${kb > 80 ? kb : 0}px`)
  }
  vv.addEventListener('resize', update)
  vv.addEventListener('scroll', update)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if (import.meta.env.PROD) {
  void Promise.all([import('virtual:pwa-register'), import('./lib/router')]).then(([{ registerSW }, router]) => {
    const editing = () => router.currentStack().some((p) => p.startsWith('/new') || p.startsWith('/edit'))
    // A new version has taken over: reload into it straight away, unless a dish is mid-edit.
    const reloadWhenIdle = () => {
      const go = () => {
        try {
          sessionStorage.setItem('dishdex:updated', '1')
        } catch {
          /* private mode */
        }
        location.reload()
      }
      if (!editing()) return go()
      const off = router.subscribe(() => {
        if (!editing()) {
          off()
          go()
        }
      })
    }
    registerSW({
      immediate: true,
      onNeedReload: reloadWhenIdle,
      onRegisteredSW(_url, reg) {
        if (!reg) return
        // Phones resume apps from the background rather than relaunching them,
        // so look for a new version every time the app comes back on screen.
        const check = () => {
          if (navigator.onLine) reg.update().catch(() => {})
        }
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') check()
        })
        setInterval(() => {
          if (document.visibilityState === 'visible') check()
        }, 30 * 60_000)
      },
    })
  })
  void navigator.storage?.persist?.()
}

if (import.meta.env.DEV) {
  // ?demo=N[&collected=M] spins up a seeded demo dex — for screenshots and quick checks.
  const qs = new URLSearchParams(location.search)
  const n = Number(qs.get('demo'))
  if (n) {
    setTimeout(async () => {
      const st = await import('./lib/store')
      const { prefs } = await import('./lib/local')
      if (qs.has('collected')) {
        prefs.setCollected(Number(qs.get('collected')))
        st.useApp.setState({ collected: Number(qs.get('collected')) })
      }
      if (!st.useApp.getState().conn) {
        await st.connect('demo/local', 'demo')
        await (await import('./lib/demo')).seedDemo(Math.max(0, n - 6))
      }
    }, 300)
  }
  ;(window as any).dishdexSeed = (extra = 0) => import('./lib/demo').then((m) => m.seedDemo(extra))
}
