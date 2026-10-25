import { AnimatePresence, motion, useAnimate } from 'motion/react'
import { useEffect, useId, useMemo, useState } from 'react'
import { tap } from '../lib/device'
import { prefs } from '../lib/local'
import { go, home, useStack } from '../lib/router'
import { useApp } from '../lib/store'
import { MILESTONES, nextTier, tierFor, TOP, type Tier } from '../lib/tiers'
import { Avatar, cssVar, dexNo, Sheet, spring, useDexNumbers, usePeople } from './bits'
import { Icon } from './Icon'

/** A struck-metal medal: scalloped rim, bevelled face, the milestone number in the middle. */
export function Medal({ tier, size = 56, locked }: { tier: Tier; size?: number; locked?: boolean }) {
  const id = useId().replace(/:/g, '')
  const [l, m, d] = tier.colors
  const rim = useMemo(
    () =>
      Array.from({ length: 64 }, (_, i) => {
        const a = (i / 64) * Math.PI * 2 - Math.PI / 2
        const r = i % 2 ? 46.5 : 49.5
        return `${(50 + r * Math.cos(a)).toFixed(2)},${(50 + r * Math.sin(a)).toFixed(2)}`
      }).join(' '),
    [],
  )
  if (locked)
    return (
      <svg viewBox="0 0 100 100" width={size} height={size} aria-label={`${tier.name} medal, locked`} role="img">
        <circle cx="50" cy="50" r="45" fill="currentColor" fillOpacity=".06" stroke="currentColor" strokeOpacity=".28" strokeWidth="1.5" strokeDasharray="2.5 3.5" />
        <text x="50" y="58" textAnchor="middle" fontFamily="'Fraunces Variable', Georgia, serif" fontWeight="500" fontSize="26" fill="currentColor" fillOpacity=".45">
          {tier.at}
        </text>
      </svg>
    )
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-label={`${tier.name} medal`} role="img" style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id={`a${id}`} x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0" stopColor={l} />
          <stop offset="0.5" stopColor={m} />
          <stop offset="1" stopColor={d} />
        </linearGradient>
        <linearGradient id={`b${id}`} x1="0.85" y1="0" x2="0.15" y2="1">
          <stop offset="0" stopColor={l} />
          <stop offset="0.55" stopColor={m} />
          <stop offset="1" stopColor={d} />
        </linearGradient>
        <radialGradient id={`g${id}`} cx="0.32" cy="0.22" r="0.65">
          <stop offset="0" stopColor="#fff" stopOpacity=".75" />
          <stop offset="0.5" stopColor="#fff" stopOpacity=".08" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <polygon points={rim} fill={`url(#a${id})`} />
      <circle cx="50" cy="50" r="41" fill={`url(#b${id})`} />
      <circle cx="50" cy="50" r="35" fill={`url(#a${id})`} stroke={d} strokeOpacity=".4" strokeWidth=".8" />
      <circle cx="50" cy="50" r="31.5" fill="none" stroke={l} strokeOpacity=".6" strokeWidth=".6" />
      {tier.key === 'diamond' && (
        <path d="M50 22l5 6h-10zM28 46l4-5 2 7zM72 46l-4-5-2 7z" fill="#fff" fillOpacity=".55" />
      )}
      <text x="50" y="58" textAnchor="middle" fontFamily="'Fraunces Variable', Georgia, serif" fontWeight="600" fontSize="25" fill={tier.ink}>
        {tier.at}
      </text>
      <text x="50" y="69.5" textAnchor="middle" fontFamily="'Inter Variable', system-ui, sans-serif" fontWeight="700" fontSize="5.4" letterSpacing="1.3" fill={tier.ink} fillOpacity=".7">
        DISHES
      </text>
      <circle cx="50" cy="50" r="41" fill={`url(#g${id})`} />
    </svg>
  )
}

const tierStyle = (t: Tier) => cssVar({ '--l': t.colors[0], '--m': t.colors[1], '--d': t.colors[2], '--ink-t': t.ink })

/** The top of the dex: total dishes, the tier you're on, and the medal shelf. */
export function DexCard({ onOpenMedal }: { onOpenMedal: (t: Tier) => void }) {
  const recipes = useApp((s) => s.recipes)
  const collected = useApp((s) => s.collected)
  const { people, me } = usePeople()
  const all = Object.values(recipes)
  const total = all.length
  const tier = tierFor(total)
  const next = nextTier(total)

  return (
    <section className="dexcard" aria-label="Dex progress">
      <div className="dexcard-top">
        <span className="eyebrow">Our dex</span>
        <motion.span key={tier.key} className="tier-pill" style={tierStyle(tier)} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={spring}>
          <i />
          {tier.name}
        </motion.span>
      </div>
      <div className="dexcard-count">
        <motion.span key={total} className="big" initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={spring}>
          {total}
        </motion.span>
        <span className="unit">{total === 1 ? 'dish' : 'dishes'}</span>
      </div>
      <div className="dexcard-sub">
        <b>{tier.title}</b>
        {' · '}
        {next ? `${next.at - total} more to ${next.name}` : 'every medal collected'}
      </div>
      <div className="track" role="progressbar" aria-valuemin={0} aria-valuemax={TOP} aria-valuenow={Math.min(total, TOP)}>
        <motion.i initial={{ scaleX: 0 }} animate={{ scaleX: Math.min(1, total / TOP) }} transition={{ ...spring, delay: 0.1 }} style={{ width: '100%' }} />
        {MILESTONES.slice(0, -1).map((m) => (
          <span key={m.at} className="tick" data-on={total >= m.at} style={{ left: `${(m.at / TOP) * 100}%` }} />
        ))}
      </div>
      <div className="medals">
        {MILESTONES.map((m) => {
          const state = m.at <= collected ? 'collected' : total >= m.at ? 'ready' : 'locked'
          return (
            <button key={m.at} className="medal-slot" data-state={state} data-medal={m.at} onClick={() => { tap(); onOpenMedal(m) }} aria-label={`${m.name}: ${state}`}>
              {state === 'collected' ? (
                <Medal tier={m} size={46} />
              ) : state === 'ready' ? (
                <span className="ready-orb" style={{ width: 46, height: 46, fontSize: 18 }}>
                  {m.at}
                </span>
              ) : (
                <Medal tier={m} size={46} locked />
              )}
              <small>{m.name}</small>
            </button>
          )
        })}
      </div>
      <div className="dexcard-people">
        {[...people]
          .sort((a, b) => Number(b.id === me) - Number(a.id === me))
          .map((p) => (
            <button key={p.id} onClick={() => { tap(); go(`/p/${p.id}`) }}>
              <Avatar person={p} size={28} />
              <span className="nm">{p.name}</span>
              <b>{all.filter((r) => r.knownBy.includes(p.id)).length}</b>
            </button>
          ))}
      </div>
    </section>
  )
}

/** Tap a medal: what it is, and when you got it or how far off it is. */
export function MedalSheet({ tier, onClose, onCollect }: { tier: Tier | null; onClose: () => void; onCollect: (t: Tier) => void }) {
  const recipes = useApp((s) => s.recipes)
  const collected = useApp((s) => s.collected)
  const nums = useDexNumbers()
  const total = Object.keys(recipes).length
  const nth = tier ? Object.values(recipes).find((r) => nums.get(r.id) === tier.at) : undefined
  const state = !tier ? 'locked' : tier.at <= collected ? 'collected' : total >= tier.at ? 'ready' : 'locked'
  return (
    <Sheet open={!!tier} onClose={onClose} label="Medal">
      {tier && (
        <>
          <div className="medal-hero">
            <Medal tier={tier} size={132} locked={state === 'locked'} />
          </div>
          <h3 style={{ textAlign: 'center' }}>{tier.name}</h3>
          <p style={{ textAlign: 'center' }}>
            {tier.at} dishes · <i>{tier.title}</i>
          </p>
          <div style={{ marginTop: 16 }}>
            {state === 'locked' ? (
              <div className="medal-row">
                <span className="muted">To unlock</span>
                <b>
                  {tier.at - total} more {tier.at - total === 1 ? 'dish' : 'dishes'}
                </b>
              </div>
            ) : (
              nth && (
                <div className="medal-row">
                  <span className="muted">Earned with</span>
                  <b>
                    {dexNo(tier.at)} · {nth.title}
                  </b>
                </div>
              )
            )}
          </div>
          {state === 'ready' && (
            <div className="sheet-actions">
              <button className="btn btn-primary btn-block" onClick={() => onCollect(tier)}>
                <Icon name="medal" size={19} /> Collect medal
              </button>
            </div>
          )}
        </>
      )}
    </Sheet>
  )
}

/**
 * Fires when the dex crosses a milestone this phone hasn't collected yet.
 * The medal spins in, confetti falls, and "Collect" flies it onto the shelf.
 */
export function Celebration() {
  const total = useApp((s) => Object.keys(s.recipes).length)
  const phase = useApp((s) => s.phase)
  const collected = useApp((s) => s.collected)
  const request = useApp((s) => s.celebrate)
  const stack = useStack()
  const [tier, setTier] = useState<Tier | null>(null)
  const editing = stack.some((p) => p.startsWith('/new') || p.startsWith('/edit'))

  useEffect(() => {
    if (request && !tier) {
      setTier(request)
      useApp.setState({ celebrate: null })
    }
  }, [request])

  useEffect(() => {
    if (phase !== 'ready' || tier || editing) return
    const due = MILESTONES.find((m) => total >= m.at && m.at > collected)
    if (!due) return
    const t = setTimeout(() => setTier(due), 700)
    return () => clearTimeout(t)
  }, [total, phase, collected, editing, tier])

  return <AnimatePresence>{tier && <Ceremony key={tier.at} tier={tier} onDone={() => setTier(null)} />}</AnimatePresence>
}

const CONFETTI_GOLD = ['#f3e0b2', '#cfa866', '#9c7438', '#fff8e8']

function Ceremony({ tier, onDone }: { tier: Tier; onDone: () => void }) {
  const [scope, animate] = useAnimate()
  const [leaving, setLeaving] = useState(false)
  const pieces = useMemo(() => {
    const cols = [...tier.colors, ...CONFETTI_GOLD]
    return Array.from({ length: 70 }, (_, i) => ({
      x: `${Math.random() * 100}%`,
      w: `${5 + Math.random() * 6}px`,
      h: `${8 + Math.random() * 10}px`,
      br: i % 3 === 0 ? '50%' : '2px',
      col: cols[i % cols.length],
      dur: `${2.4 + Math.random() * 2}s`,
      delay: `${0.25 + Math.random() * 0.9}s`,
      dx: `${(Math.random() - 0.5) * 160}px`,
      rot: `${(Math.random() - 0.5) * 1080}deg`,
    }))
  }, [tier])

  useEffect(() => {
    try {
      navigator.vibrate?.([24, 60, 24, 60, 140])
    } catch {
      /* no haptics */
    }
  }, [])

  const collect = async () => {
    if (leaving) return
    setLeaving(true)
    tap(30)
    prefs.setCollected(Math.max(prefs.collected(), tier.at)) // saved before any animation can stall
    home()
    window.dispatchEvent(new Event('dishdex:top'))
    await new Promise((r) => setTimeout(r, 380))
    if (!scope.current) return
    const slot = document.querySelector(`[data-medal="${tier.at}"] svg, [data-medal="${tier.at}"] .ready-orb`)
    const medal = scope.current?.querySelector('.celebrate-medal') as HTMLElement | null
    if (slot && medal) {
      const a = medal.getBoundingClientRect()
      const b = slot.getBoundingClientRect()
      animate('.celebrate-bg', { opacity: 0 }, { duration: 0.55 })
      animate('.celebrate-rays, .celebrate-glow, .celebrate-copy, .confetti', { opacity: 0 }, { duration: 0.25 })
      await Promise.race([
        animate(
          medal,
          { x: b.left + b.width / 2 - (a.left + a.width / 2), y: b.top + b.height / 2 - (a.top + a.height / 2), scale: b.width / a.width },
          { duration: 0.75, ease: [0.65, 0, 0.25, 1] },
        ),
        new Promise((r) => setTimeout(r, 1200)),
      ])
    }
    useApp.setState({ collected: Math.max(useApp.getState().collected, tier.at) })
    onDone()
  }

  return (
    <motion.div ref={scope} className="celebrate" style={cssVar({ '--c': tier.colors[1] })} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.2 } }} role="dialog" aria-label={`${tier.name} medal unlocked`}>
      <div className="celebrate-bg" />
      <div className="celebrate-rays" />
      <div className="celebrate-glow" />
      <div className="confetti" aria-hidden="true">
        {pieces.map((p, i) => (
          <i key={i} style={cssVar({ '--x': p.x, '--w': p.w, '--h': p.h, '--br': p.br, '--col': p.col, '--dur': p.dur, '--delay': p.delay, '--dx': p.dx, '--rot': p.rot })} />
        ))}
      </div>
      <div className="celebrate-body">
        <motion.div className="eyebrow celebrate-copy" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.2 } }}>
          Medal unlocked
        </motion.div>
        <motion.div
          className="celebrate-medal"
          initial={{ scale: 0.15, rotateY: -720, opacity: 0 }}
          animate={{ scale: 1, rotateY: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 55, damping: 11, mass: 1.1, opacity: { duration: 0.3 } }}
        >
          <Medal tier={tier} size={190} />
          <span className="shine" />
        </motion.div>
        <div className="celebrate-copy">
          <motion.h2 initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.9, ...spring } }}>
            {tier.at} dishes
          </motion.h2>
          <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0, transition: { delay: 1.05, ...spring } }}>
            You’re now <b>{tier.name}</b> — {tier.title.toLowerCase()}.
          </motion.p>
          <motion.button className="btn" onClick={() => void collect()} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0, transition: { delay: 1.3, ...spring } }} whileTap={{ scale: 0.96 }}>
            Collect medal
          </motion.button>
        </div>
      </div>
    </motion.div>
  )
}
