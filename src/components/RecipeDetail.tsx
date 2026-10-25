import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { relTime, tap } from '../lib/device'
import { usePhoto } from '../lib/photos'
import { scaleLine } from '../lib/quantity'
import { back, go } from '../lib/router'
import { shareRecipe } from '../lib/share'
import { markSeen, setKnown, setRecipePhoto, toast, useApp } from '../lib/store'
import { processPhoto } from '../lib/image'
import type { Recipe } from '../lib/types'
import { Avatar, CuisineBadge, cssVar, dexNo, DishArt, fmtMinutes, spring, Stepper, TempTag, TypeBadge, useDexNumbers, usePeople } from './bits'
import { Icon } from './Icon'

export function RecipeDetail({ id, shared }: { id: string; shared: boolean }) {
  const r = useApp((s) => s.recipes[id])
  const nums = useDexNumbers()
  const { people } = usePeople()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    if (r) markSeen(id)
  }, [id, r?.updatedAt])

  if (!r) {
    return (
      <div className="screen" style={{ display: 'grid', placeItems: 'center' }}>
        <div className="empty">
          <div style={{ fontSize: 44 }}>🫥</div>
          <h2 className="display">This dish is gone</h2>
          <p>It was removed from your dex, maybe on the other phone.</p>
          <button className="btn btn-ghost" style={{ marginTop: 10 }} onClick={back}>
            Back to the dex
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <motion.div className="detail-bg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.22 } }} />
      <div className="detail-scroll" onScroll={(e) => setScrolled(e.currentTarget.scrollTop > e.currentTarget.clientWidth * 0.9)}>
        <div className="hero-wrap">
          <Hero r={r} shared={shared} />
        </div>
        <motion.div
          className="sheet-panel"
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1, transition: { ...spring, delay: 0.04 } }}
          exit={{ y: 80, opacity: 0, transition: { duration: 0.2 } }}
        >
          <Body r={r} no={nums.get(r.id) ?? 0} />
        </motion.div>
      </div>

      <motion.div className="detail-bar" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.12 } }}>
        <AnimatePresence>{scrolled && <motion.div className="detail-bar-bg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />}</AnimatePresence>
        <button className="icon-btn glass" onClick={back} aria-label="Back">
          <Icon name="back" size={22} stroke={2.4} />
        </button>
        <div className="detail-bar-title" style={{ opacity: scrolled ? 1 : 0, transition: 'opacity .2s' }}>
          {r.title}
        </div>
        <button className="icon-btn glass" onClick={() => void shareRecipe(r, people)} aria-label="Share recipe">
          <Icon name="share" size={19} />
        </button>
        <button className="icon-btn glass" onClick={() => go(`/edit/${r.id}`)} aria-label="Edit recipe">
          <Icon name="edit" size={19} />
        </button>
      </motion.div>
    </>
  )
}

function Hero({ r, shared }: { r: Recipe; shared: boolean }) {
  const full = usePhoto(r.photo?.path)
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const file = useRef<HTMLInputElement>(null)
  const pick = async (f?: File) => {
    if (!f) return
    setBusy(true)
    try {
      await setRecipePhoto(r.id, await processPhoto(f))
      toast('Photo added 📸')
    } catch (e) {
      toast((e as Error).message)
    } finally {
      setBusy(false)
      if (file.current) file.current.value = ''
    }
  }
  return (
    <>
    {!r.photo && (
      <>
        <input ref={file} type="file" accept="image/*" hidden onChange={(e) => void pick(e.target.files?.[0])} />
        <motion.button
          className="hero-add btn btn-sm"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0, transition: { delay: 0.25 } }}
          exit={{ opacity: 0 }}
          onClick={() => { tap(); file.current?.click() }}
          disabled={busy}
        >
          <Icon name="camera" size={18} /> {busy ? 'Adding…' : 'Add a photo'}
        </motion.button>
      </>
    )}
    <motion.div className="hero" layoutId={shared ? `media-${r.id}` : undefined} style={{ borderRadius: 0 }} transition={spring}>
      {r.thumb ? <img src={r.thumb} alt="" /> : !r.photo && <DishArt recipe={r} />}
      {full && (
        <motion.img
          className="hero-full"
          src={full}
          alt={`Photo of ${r.title}`}
          onLoad={() => setLoaded(true)}
          initial={{ opacity: 0 }}
          animate={{ opacity: loaded ? 1 : 0 }}
          transition={{ duration: 0.35 }}
        />
      )}
    </motion.div>
    </>
  )
}

function Body({ r, no }: { r: Recipe; no: number }) {
  const { people, me, byId } = usePeople()
  const [serv, setServ] = useState(r.servings)
  const [got, setGot] = useState<Set<number>>(() => new Set())
  const [done, setDone] = useState<Set<number>>(() => new Set())
  const [cook, setCook] = useState(false)
  const [burst, setBurst] = useState(0)
  const lock = useRef<{ release: () => Promise<void> } | null>(null)

  useEffect(() => setServ(r.servings), [r.servings])

  useEffect(() => {
    if (!cook) return
    let cancelled = false
    ;(navigator as any).wakeLock
      ?.request('screen')
      .then((l: any) => {
        if (cancelled) l.release()
        else lock.current = l
      })
      .catch(() => {
        setCook(false)
        toast('This phone won’t let the screen stay on')
      })
    return () => {
      cancelled = true
      void lock.current?.release()
      lock.current = null
    }
  }, [cook])

  const factor = serv / r.servings
  const toggle = (set: Set<number>, i: number) => {
    const n = new Set(set)
    if (n.has(i)) n.delete(i)
    else n.add(i)
    return n
  }
  const creator = byId(r.createdBy)
  const editor = byId(r.updatedBy)
  const hasWakeLock = 'wakeLock' in navigator

  return (
    <>
      <div className="detail-tags">
        <span className="faint" style={{ fontSize: 11, fontWeight: 650, letterSpacing: '0.12em', marginRight: 6 }}>
          {dexNo(no)}
        </span>
        <TempTag temp={r.temp} />
        <CuisineBadge id={r.cuisine} />
        {r.types.map((t) => (
          <TypeBadge key={t} id={t} />
        ))}
      </div>
      <h1 className="detail-title display">{r.title}</h1>

      <div className="section">
        <div className="section-head">
          <h3>Who can cook it</h3>
        </div>
        <div className="know-row" style={{ position: 'relative' }}>
          {people.map((p) => {
            const on = r.knownBy.includes(p.id)
            return (
              <button
                key={p.id}
                className="know-chip"
                aria-pressed={on}
                style={cssVar({ '--c': p.color })}
                onClick={() => {
                  tap(on ? 8 : 16)
                  if (!on && p.id === me) setBurst((b) => b + 1)
                  void setKnown(r.id, p.id, !on)
                }}
              >
                <Avatar person={p} size={34} />
                {p.name}
                <span className="know-tick">
                  <Icon name={on ? 'check' : 'plus'} size={13} stroke={3} />
                </span>
              </button>
            )
          })}
          <Burst k={burst} />
        </div>
      </div>

      <div className="stats">
        <div className="stat">
          <div className="stat-label">Servings</div>
          <div className="stat-value">
            <Stepper value={serv} onChange={setServ} />
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">Time</div>
          <div className="stat-value">{fmtMinutes(r.minutes)}</div>
        </div>
      </div>

      <div className="section">
        <div className="section-head">
          <h3>Ingredients</h3>
          {factor !== 1 && (
            <button className="link" style={{ fontSize: 14 }} onClick={() => setServ(r.servings)}>
              Scaled for {serv} · reset
            </button>
          )}
        </div>
        {r.ingredients.length === 0 && <p className="faint">No ingredients logged yet.</p>}
        {r.ingredients.map((line, i) => {
          const { qty, rest } = scaleLine(line, factor)
          return (
            <button key={i} className="ing" role="checkbox" aria-checked={got.has(i)} onClick={() => { tap(); setGot(toggle(got, i)) }}>
              <span className="check">
                <Icon name="check" size={13} stroke={3.2} />
              </span>
              <span className="ing-text">
                {qty && <b>{qty} </b>}
                {rest}
              </span>
            </button>
          )
        })}
      </div>

      <div className="section">
        <div className="section-head">
          <h3>How to make it</h3>
        </div>
        {r.steps.length === 0 && <p className="faint">No steps written down yet — it lives in someone’s head.</p>}
        {r.steps.map((s, i) => (
          <button key={i} className="step" role="checkbox" aria-checked={done.has(i)} onClick={() => { tap(); setDone(toggle(done, i)) }}>
            <span className="step-n">{i + 1}</span>
            <span className="step-text">{s}</span>
          </button>
        ))}
      </div>

      {r.notes && (
        <div className="section">
          <div className="section-head">
            <h3>Notes</h3>
          </div>
          <div className="notes">{r.notes}</div>
        </div>
      )}

      <div className="action-row">
        <button className="btn btn-ghost" onClick={() => { tap(); void shareRecipe(r, people) }}>
          <Icon name="share" size={19} /> Share
        </button>
        {hasWakeLock && (
          <button className={`btn ${cook ? 'btn-soft' : 'btn-ghost'}`} aria-pressed={cook} onClick={() => { tap(); setCook(!cook) }}>
            <Icon name="flame" size={19} /> {cook ? 'Screen stays on' : 'Cook mode'}
          </button>
        )}
      </div>

      <div className="foot-meta">
        Logged by {creator?.name ?? 'someone'} · {new Date(r.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
        {r.updatedAt !== r.createdAt && (
          <>
            <br />
            Updated {relTime(r.updatedAt)}
            {editor ? ` by ${editor.name}` : ''}
          </>
        )}
      </div>
    </>
  )
}

const BURST = ['🎉', '✨', '🍽️', '⭐', '🔥', '💛']

/** Small celebratory pop when someone "catches" a dish. */
function Burst({ k }: { k: number }) {
  if (!k) return null
  return (
    <span key={k} aria-hidden="true" style={{ position: 'absolute', left: 40, top: 20, pointerEvents: 'none' }}>
      {Array.from({ length: 14 }, (_, i) => {
        const a = (i / 14) * Math.PI * 2
        const d = 60 + (i % 3) * 22
        return (
          <motion.span
            key={i}
            style={{ position: 'absolute', fontSize: 18 }}
            initial={{ x: 0, y: 0, scale: 0.4, opacity: 1 }}
            animate={{ x: Math.cos(a) * d, y: Math.sin(a) * d - 20, scale: 1, opacity: 0, rotate: (i % 2 ? 1 : -1) * 90 }}
            transition={{ duration: 0.9, ease: [0.2, 0.7, 0.3, 1] }}
          >
            {BURST[i % BURST.length]}
          </motion.span>
        )
      })}
    </span>
  )
}
