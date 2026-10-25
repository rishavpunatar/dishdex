import { AnimatePresence, motion, useDragControls } from 'motion/react'
import { useEffect, type ReactNode } from 'react'
import { Toasts } from './components/bits'
import { Dex } from './components/Dex'
import { Celebration } from './components/Medals'
import { Editor } from './components/Editor'
import { Onboarding, Splash } from './components/Onboarding'
import { Profile } from './components/Profile'
import { RecipeDetail } from './components/RecipeDetail'
import { Settings } from './components/Settings'
import { prefs } from './lib/local'
import { back, clearUrlHash, parseRoute, useStack, type Route } from './lib/router'
import { boot, toast, useApp } from './lib/store'
import { stashInvite } from './lib/handoff'
import { isIOS, isStandalone } from './lib/device'

const initialInvite = (() => {
  const m = /[#&]join=([^&]+)/.exec(location.hash)
  return m ? decodeURIComponent(m[1]) : null
})()

export function App() {
  const phase = useApp((s) => s.phase)
  const stack = useStack()

  useEffect(() => {
    if (initialInvite) {
      clearUrlHash()
      // Leave the invite where the Home Screen app will find it after "Add to Home Screen".
      if (isIOS() && !isStandalone()) void stashInvite(initialInvite)
    }
    void boot().then(() => {
      if (initialInvite && useApp.getState().phase === 'ready') toast('This phone is already connected')
      try {
        if (sessionStorage.getItem('dishdex:updated')) {
          sessionStorage.removeItem('dishdex:updated')
          toast('Dishdex is up to date ✨')
        }
      } catch {
        /* private mode */
      }
    })
  }, [])

  if (phase === 'boot') return <Splash />
  if (phase !== 'ready')
    return (
      <>
        <Onboarding phase={phase} invite={initialInvite} />
        <Toasts />
      </>
    )

  return (
    <>
      <Dex inert={stack.length > 0} />
      <AnimatePresence>
        {stack.map((path, i) => {
          const route = parseRoute(path)
          return route ? <Layer key={`${i}:${path}`} route={route} index={i} covered={i < stack.length - 1} /> : null
        })}
      </AnimatePresence>
      <Celebration />
      <Toasts />
    </>
  )
}

function Layer({ route, index, covered }: { route: Route; index: number; covered: boolean }) {
  const z = 100 + index * 10
  if (route.name === 'new' || route.name === 'edit') {
    return (
      <div className="layer" style={{ zIndex: z }} inert={covered}>
        <Editor id={route.name === 'edit' ? route.id : undefined} />
      </div>
    )
  }
  if (route.name === 'recipe') {
    // Straight off the card grid, the photo flies from its card into the hero.
    const shared = index === 0 && !route.fresh && prefs.view() === 'grid'
    return (
      <SwipeBack z={z} push={!shared} covered={covered}>
        <RecipeDetail id={route.id} shared={shared} />
      </SwipeBack>
    )
  }
  return (
    <SwipeBack z={z} push covered={covered}>
      {route.name === 'profile' ? <Profile id={route.id} /> : <Settings />}
    </SwipeBack>
  )
}

/** Screen that slides in from the right and can be swiped back from the left edge (iOS has no back button). */
function SwipeBack({ children, z, push, covered }: { children: ReactNode; z: number; push: boolean; covered: boolean }) {
  const controls = useDragControls()
  const anim = push
    ? { initial: { x: '100%' }, animate: { x: 0 }, exit: { x: '100%' } }
    : { initial: { x: 0 }, animate: { x: 0 }, exit: { x: 0 } }
  return (
    <motion.div
      className="layer"
      style={{ zIndex: z, boxShadow: push ? '-12px 0 40px rgba(0,0,0,.14)' : undefined }}
      {...anim}
      transition={{ type: 'spring', stiffness: 380, damping: 40 }}
      drag="x"
      dragListener={false}
      dragControls={controls}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={{ left: 0, right: 1 }}
      dragMomentum={false}
      onDragEnd={(_, info) => {
        if (info.offset.x > 110 || info.velocity.x > 600) back()
      }}
      inert={covered}
    >
      <div className="layer-edge" onPointerDown={(e) => controls.start(e)} />
      {children}
    </motion.div>
  )
}
