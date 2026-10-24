import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { tap } from '../lib/device'
import { useApp } from '../lib/store'
import { typeById, type Person, type PersonId, type Recipe } from '../lib/types'
import { Icon } from './Icon'

export const cssVar = (vars: Record<string, string | number>) => vars as CSSProperties

export const spring = { type: 'spring', stiffness: 420, damping: 38, mass: 0.9 } as const
export const softSpring = { type: 'spring', stiffness: 260, damping: 30 } as const

export function Logo({ size = 34 }: { size?: number }) {
  return (
    <svg className="wordmark-mark" width={size} height={size} viewBox="0 0 512 512" aria-hidden="true">
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FF7656" />
          <stop offset="1" stopColor="#D8381F" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="128" fill="url(#lg)" />
      <circle cx="256" cy="148" r="24" fill="#fff" />
      <path d="M104 334a152 152 0 0 1 304 0z" fill="#fff" />
      <rect x="80" y="350" width="352" height="34" rx="17" fill="#fff" />
      <path d="M170 300a92 92 0 0 1 52-74" stroke="#E4482F" strokeOpacity=".35" strokeWidth="18" strokeLinecap="round" fill="none" />
    </svg>
  )
}

export function Avatar({ person, size = 32, ring }: { person?: Person; size?: number; ring?: boolean }) {
  if (!person) return null
  return (
    <span
      className="avatar"
      style={cssVar({ '--c': person.color, width: size, height: size, fontSize: size * 0.5, ...(ring ? { '--ring': 'var(--bg)' } : {}) })}
      title={person.name}
    >
      {person.emoji ? <span className="emo" style={{ fontSize: size * 0.56 }}>{person.emoji}</span> : person.name.slice(0, 1).toUpperCase()}
    </span>
  )
}

export function usePeople() {
  const profiles = useApp((s) => s.profiles)
  const me = useApp((s) => s.me)
  const people = profiles?.people ?? []
  const byId = (id: PersonId) => people.find((p) => p.id === id)
  const meP = me ? byId(me) : undefined
  const others = people.filter((p) => p.id !== me)
  return { people, me, meP, partner: others[0], byId }
}

export function KnownDots({ ids, size = 22, ringColor }: { ids: PersonId[]; size?: number; ringColor?: string }) {
  const { byId } = usePeople()
  return (
    <span className="dots" style={ringColor ? cssVar({ '--ring': ringColor }) : undefined}>
      {ids.map((id) => {
        const p = byId(id)
        return p ? (
          <span key={id} className="avatar" style={cssVar({ '--c': p.color, width: size, height: size, fontSize: size * 0.5, boxShadow: `0 0 0 1.5px ${ringColor ?? 'var(--bg)'}` })} title={`${p.name} knows this`}>
            {p.emoji ? <span className="emo" style={{ fontSize: size * 0.56 }}>{p.emoji}</span> : p.name.slice(0, 1).toUpperCase()}
          </span>
        ) : null
      })}
    </span>
  )
}

export function TypeBadge({ id, onPhoto }: { id: string; onPhoto?: boolean }) {
  const t = typeById(id)
  if (!t) return null
  return (
    <span className={`tbadge${onPhoto ? ' on-photo' : ''}`} style={cssVar({ '--c': t.color })}>
      <span aria-hidden="true">{t.emoji}</span>
      {t.label}
    </span>
  )
}

function hashHue(s: string) {
  let h = 0
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return h % 360
}

export function artColor(r: Pick<Recipe, 'types' | 'title' | 'id'>) {
  const t = r.types[0] ? typeById(r.types[0]) : undefined
  return t?.color ?? `hsl(${hashHue(r.id + r.title)} 55% 52%)`
}

/** Stand-in "silhouette" for a dish with no photo yet. */
export function DishArt({ recipe }: { recipe: Pick<Recipe, 'types' | 'title' | 'id'> }) {
  const letter = recipe.title.trim().slice(0, 1).toUpperCase() || '?'
  return (
    <div className="art" style={cssVar({ '--c': artColor(recipe) })}>
      <span className="art-letter">{letter}</span>
    </div>
  )
}

export function Sheet({ open, onClose, children, label }: { open: boolean; onClose: () => void; children: ReactNode; label: string }) {
  useEffect(() => {
    if (!open) return
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [open, onClose])
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="scrim" key="scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            key="sheet"
            className="sheet"
            role="dialog"
            aria-label={label}
            aria-modal="true"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={spring}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.8 }}
            onDragEnd={(_, i) => {
              if (i.offset.y > 110 || i.velocity.y > 700) onClose()
            }}
          >
            <div className="sheet-handle" />
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

export function Toasts() {
  const toasts = useApp((s) => s.toasts)
  return (
    <div className="toasts" aria-live="polite">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div key={t.id} className="toast" initial={{ opacity: 0, y: 16, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.97 }} transition={spring}>
            {t.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

/**
 * Quiet unless there's something to know: a slow sync, changes waiting,
 * offline, or a key GitHub no longer accepts.
 */
export function SyncStatus({ onClick }: { onClick: () => void }) {
  const sync = useApp((s) => s.sync)
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    if (sync.state !== 'syncing') return setSlow(false)
    const t = setTimeout(() => setSlow(true), 900)
    return () => clearTimeout(t)
  }, [sync.state])

  let view: { label: string; tone: 'busy' | 'warn' | 'bad' } | null = null
  if (sync.state === 'auth') view = { label: 'Reconnect', tone: 'bad' }
  else if (sync.state === 'offline') view = { label: sync.pending ? `Offline · ${sync.pending} to sync` : 'Offline', tone: 'warn' }
  else if (sync.state === 'error') view = { label: 'Sync issue', tone: 'bad' }
  else if (sync.state === 'syncing' && slow) view = { label: 'Syncing', tone: 'busy' }
  else if (sync.pending) view = { label: `${sync.pending} to sync`, tone: 'warn' }

  return (
    <AnimatePresence initial={false}>
      {view && (
        <motion.button
          key="sync"
          className="sync-pill"
          data-tone={view.tone}
          onClick={onClick}
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.85 }}
          transition={spring}
          aria-live="polite"
        >
          {view.tone === 'busy' ? <Icon name="sync" size={13} stroke={2.6} className="spin" /> : <span className="dot" />}
          {view.label}
        </motion.button>
      )}
    </AnimatePresence>
  )
}

export function Stepper({ value, onChange, min = 1, max = 99, step = 1, format }: { value: number; onChange: (n: number) => void; min?: number; max?: number; step?: number; format?: (n: number) => string }) {
  return (
    <span className="stepper">
      <button type="button" aria-label="Fewer" onClick={() => { tap(); onChange(Math.max(min, value - step)) }}>
        <Icon name="minus" size={16} stroke={2.4} />
      </button>
      <motion.span key={value} className="v" initial={{ y: -6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.18 }}>
        {format ? format(value) : value}
      </motion.span>
      <button type="button" aria-label="More" onClick={() => { tap(); onChange(Math.min(max, value + step)) }}>
        <Icon name="plus" size={16} stroke={2.4} />
      </button>
    </span>
  )
}

export const fmtMinutes = (m?: number) => {
  if (!m) return '—'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  const r = m % 60
  return r ? `${h}h ${r}m` : `${h}h`
}

export const dexNo = (n: number) => `#${String(n).padStart(3, '0')}`

/** Pokédex-style numbering: order of first logging, identical on both phones. */
export function useDexNumbers() {
  const recipes = useApp((s) => s.recipes)
  return useMemo(() => {
    const sorted = Object.values(recipes).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
    return new Map(sorted.map((r, i) => [r.id, i + 1]))
  }, [recipes])
}
