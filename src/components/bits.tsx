import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useId, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { tap } from '../lib/device'
import { useApp } from '../lib/store'
import { cuisineById, typeById, type Person, type PersonId, type Recipe } from '../lib/types'
import { Icon } from './Icon'

export const cssVar = (vars: Record<string, string | number>) => vars as CSSProperties

export const spring = { type: 'spring', stiffness: 420, damping: 38, mass: 0.9 } as const
export const softSpring = { type: 'spring', stiffness: 260, damping: 30 } as const

/** Monogram: a chef's knife for the stem of the D, a plate rim for its bowl. */
export function Logo({ size = 34 }: { size?: number }) {
  const id = useId().replace(/:/g, '')
  return (
    <svg className="wordmark-mark" width={size} height={size} viewBox="0 0 512 512" aria-hidden="true">
      <defs>
        <radialGradient id={`bg${id}`} cx="28%" cy="16%" r="100%">
          <stop offset="0" stopColor="#2F5646" />
          <stop offset="0.55" stopColor="#1B3329" />
          <stop offset="1" stopColor="#0E1C16" />
        </radialGradient>
        <linearGradient id={`br${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F7E6BC" />
          <stop offset="0.35" stopColor="#D8B571" />
          <stop offset="0.68" stopColor="#A57C3C" />
          <stop offset="1" stopColor="#E6C687" />
        </linearGradient>
        <linearGradient id={`bl${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#F9ECCB" />
          <stop offset="1" stopColor="#C9A260" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="118" fill={`url(#bg${id})`} />
      <g transform="translate(12 1)">
        <path d="M195 133A122 122 0 0 1 195 377" fill="none" stroke={`url(#br${id})`} strokeWidth="18" strokeLinecap="round" />
        <path d="M195 165A90 90 0 0 1 195 345" fill="none" stroke="#D8B571" strokeOpacity=".32" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M195 100L195 288L163 288L163 176C163 140 176 114 195 100Z" fill={`url(#bl${id})`} />
        <rect x="161" y="286" width="37" height="12" rx="4" fill="#A57C3C" />
        <rect x="166" y="298" width="29" height="108" rx="14.5" fill={`url(#br${id})`} />
        <circle cx="180.5" cy="328" r="4.6" fill="#1B3329" />
        <circle cx="180.5" cy="376" r="4.6" fill="#1B3329" />
      </g>
    </svg>
  )
}

/** Everyone is a serif initial on their colour — no photos, no emoji. */
function Monogram({ person, size }: { person: Person; size: number }) {
  return <span style={{ fontSize: size * 0.5, marginTop: -size * 0.04 }}>{person.name.trim().slice(0, 1).toUpperCase() || '·'}</span>
}

export function Avatar({ person, size = 32, ring }: { person?: Person; size?: number; ring?: boolean }) {
  if (!person) return null
  return (
    <span className="avatar" style={cssVar({ '--c': person.color, width: size, height: size, ...(ring ? { '--ring': 'var(--bg)' } : {}) })} title={person.name}>
      <Monogram person={person} size={size} />
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
    <span className="dots">
      {ids.map((id) => {
        const p = byId(id)
        return p ? (
          <span key={id} className="avatar" style={cssVar({ '--c': p.color, width: size, height: size, boxShadow: `0 0 0 1.5px ${ringColor ?? 'var(--bg)'}` })} title={`${p.name} can cook this`}>
            <Monogram person={p} size={size} />
          </span>
        ) : null
      })}
    </span>
  )
}

export function TypeBadge({ id }: { id: string }) {
  const t = typeById(id)
  if (!t) return null
  return (
    <span className="tbadge" style={cssVar({ '--c': t.color })}>
      {t.label}
    </span>
  )
}

export function CuisineBadge({ id }: { id?: string }) {
  const c = cuisineById(id)
  if (!c) return null
  return (
    <span className="tbadge cuisine" style={cssVar({ '--c': c.color })}>
      {c.label}
    </span>
  )
}

export function TempTag({ temp, bare }: { temp?: 'hot' | 'cold'; bare?: boolean }) {
  if (!temp) return null
  const icon = <Icon name={temp === 'hot' ? 'flame' : 'snow'} size={bare ? 12 : 13} stroke={2.2} />
  if (bare)
    return (
      <span aria-label={temp === 'hot' ? 'Served hot' : 'Served cold'} title={temp === 'hot' ? 'Served hot' : 'Served cold'} style={{ display: 'inline-flex' }}>
        {icon}
      </span>
    )
  return (
    <span className="temp" data-t={temp}>
      {icon}
      {temp === 'hot' ? 'Hot' : 'Cold'}
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

export const dexNo = (n: number) => `Nº ${String(n).padStart(3, '0')}`

/** Pokédex-style numbering: order of first logging, identical on both phones. */
export function useDexNumbers() {
  const recipes = useApp((s) => s.recipes)
  return useMemo(() => {
    const sorted = Object.values(recipes).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
    return new Map(sorted.map((r, i) => [r.id, i + 1]))
  }, [recipes])
}
