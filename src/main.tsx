import '@fontsource-variable/bricolage-grotesque'
import '@fontsource-variable/inter'
import '@fontsource-variable/jetbrains-mono'
import './styles.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'

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
  ;(window as any).dishdexSeed = () => import('./lib/demo').then((m) => m.seedDemo())
}
