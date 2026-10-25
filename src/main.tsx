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
  void import('virtual:pwa-register').then(({ registerSW }) => {
    // Apply app updates when the app is backgrounded, never mid-edit.
    let ready = false
    const update = registerSW({
      onNeedRefresh() {
        ready = true
      },
    })
    document.addEventListener('visibilitychange', () => {
      if (ready && document.visibilityState === 'hidden') void update(true)
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
