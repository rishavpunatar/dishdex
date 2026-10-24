import { AnimatePresence, motion, useMotionValue, useTransform } from 'motion/react'
import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { canPromptInstall, copyText, isIOS, isStandalone, onInstallChange, promptInstall, tap } from '../lib/device'
import { prefs } from '../lib/local'
import { usePhoto } from '../lib/photos'
import { go } from '../lib/router'
import { isNew, makeInvite, markAllSeen, syncNow, toast, useApp } from '../lib/store'
import { DISH_TYPES, type Person, type Recipe } from '../lib/types'
import { Avatar, cssVar, dexNo, DishArt, fmtMinutes, KnownDots, Logo, spring, SyncStatus, TypeBadge, useDexNumbers, usePeople } from './bits'
import { ReconnectSheet } from './Connection'
import { Icon, IosShareGlyph } from './Icon'

type Who = 'all' | 'both' | string
type Sort = 'no' | 'az' | 'new'
const SORT_LABEL: Record<Sort, string> = { no: 'Dex order', az: 'A–Z', new: 'Recently updated' }

export function Dex({ inert }: { inert: boolean }) {
  const recipes = useApp((s) => s.recipes)
  const seen = useApp((s) => s.seen)
  const { people, me, partner } = usePeople()
  const nums = useDexNumbers()
  const [q, setQ] = useState('')
  const [who, setWho] = useState<Who>('all')
  const [type, setType] = useState<string | null>(null)
  const [sort, setSort] = useState<Sort>('no')
  const [view, setViewState] = useState(prefs.view())
  const [stuck, setStuck] = useState(false)
  const [fabHidden, setFabHidden] = useState(false)
  const [reconnectOpen, setReconnectOpen] = useState(false)
  const syncState = useApp((s) => s.sync.state)
  const scroller = useRef<HTMLDivElement>(null)
  const toolbar = useRef<HTMLDivElement>(null)
  const lastY = useRef(0)

  const all = useMemo(() => Object.values(recipes), [recipes])
  const learnCount = (pid: string) => all.filter((r) => r.learning[pid]).length
  const presentTypes = DISH_TYPES.filter((t) => all.some((r) => r.types.includes(t.id)))

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const out = all.filter((r) => {
      if (who === 'both' && !people.every((p) => r.knownBy.includes(p.id))) return false
      if (who !== 'all' && who !== 'both' && !r.knownBy.includes(who)) return false
      if (type && !r.types.includes(type)) return false
      if (needle) {
        const hay = `${r.title}\n${r.ingredients.join('\n')}\n${r.types.join(' ')}`.toLowerCase()
        if (!hay.includes(needle)) return false
      }
      return true
    })
    if (sort === 'az') out.sort((a, b) => a.title.localeCompare(b.title))
    else if (sort === 'new') out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    else out.sort((a, b) => (nums.get(a.id) ?? 0) - (nums.get(b.id) ?? 0))
    return out
  }, [all, q, who, type, sort, nums, people, me])

  const setView = (v: 'grid' | 'list') => {
    tap()
    setViewState(v)
    prefs.setView(v)
  }

  const onScroll = () => {
    const el = scroller.current!
    const y = el.scrollTop
    const t = toolbar.current
    if (t) setStuck(y > t.offsetTop - 4)
    if (y > lastY.current + 8 && y > 240) setFabHidden(true)
    else if (y < lastY.current - 8 || y < 120) setFabHidden(false)
    lastY.current = y
  }

  // Pull to refresh, driven by a motion value so the grid never re-renders mid-gesture.
  const pull = useMotionValue(0)
  const pullStart = useRef<number | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const ptrY = useTransform(pull, (v) => v - 44)
  const ptrRotate = useTransform(pull, [0, 80], [0, 300])
  const ptrOpacity = useTransform(pull, [10, 50], [0, 1])

  const onTouchStart = (e: React.TouchEvent) => {
    pullStart.current = scroller.current!.scrollTop <= 0 ? e.touches[0].clientY : null
  }
  const onTouchMove = (e: React.TouchEvent) => {
    if (pullStart.current === null) return
    const dy = e.touches[0].clientY - pullStart.current
    pull.set(dy > 0 ? Math.min(120, dy * 0.5) : 0)
  }
  const onTouchEnd = () => {
    if (pullStart.current === null) return
    pullStart.current = null
    if (pull.get() > 66 && !refreshing) {
      tap(12)
      setRefreshing(true)
      const before = useApp.getState().recipes
      syncNow().finally(() =>
        setTimeout(() => {
          setRefreshing(false)
          const st = useApp.getState()
          if (st.sync.state === 'synced') toast(st.recipes === before ? 'Up to date' : 'Updated')
        }, 350),
      )
    }
    pull.set(0)
  }


  return (
    <div
      className="screen"
      ref={scroller}
      onScroll={onScroll}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      inert={inert}
      aria-hidden={inert || undefined}
    >
      <motion.div className="ptr" style={refreshing ? { y: 14, opacity: 1 } : { y: ptrY, opacity: ptrOpacity }}>
        <div className="ptr-spinner">
          <motion.span style={refreshing ? undefined : { rotate: ptrRotate }} className={refreshing ? 'spin' : undefined} >
            <Icon name="sync" size={18} stroke={2.4} />
          </motion.span>
        </div>
      </motion.div>

      <div className="wrap">
        <header className="dex-head">
          <div className="dex-topline">
            <h1 className="wordmark display" style={{ margin: 0 }}>
              <Logo />
              Dishdex
            </h1>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <SyncStatus
                onClick={() => {
                  if (syncState === 'auth') setReconnectOpen(true)
                  else if (syncState === 'error') go('/settings')
                  else void syncNow()
                }}
              />
              <button className="icon-btn soft" onClick={() => go('/settings')} aria-label="Settings">
                <Icon name="sliders" size={19} />
              </button>
            </div>
          </div>

          <div className="duo">
            {[...people].sort((a, b) => Number(b.id === me) - Number(a.id === me)).map((p) => (
              <DuoCard key={p.id} person={p} isMe={p.id === me} known={all.filter((r) => r.knownBy.includes(p.id)).length} total={all.length} learning={learnCount(p.id)} />
            ))}
          </div>
          {syncState === 'auth' && <AuthBanner onFix={() => setReconnectOpen(true)} />}
          <ForYou all={all} />
          <InstallBanner />
        </header>

        <div className={`toolbar${stuck ? ' stuck' : ''}`} ref={toolbar}>
          <div className="search">
            <label className="search-field">
              <Icon name="search" size={18} />
              <span className="sr-only">Search dishes</span>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search dishes" enterKeyHint="search" />
              {q && (
                <button onClick={() => setQ('')} aria-label="Clear search" style={{ display: 'grid', color: 'var(--ink-3)' }}>
                  <Icon name="close" size={16} />
                </button>
              )}
            </label>
            <div className="seg" role="group" aria-label="Layout">
              {(['grid', 'list'] as const).map((v) => (
                <button key={v} aria-pressed={view === v} onClick={() => setView(v)} aria-label={v === 'grid' ? 'Card view' : 'List view'}>
                  {view === v && <motion.span layoutId="seg-pill" className="seg-pill" transition={spring} />}
                  <span>
                    <Icon name={v} size={18} />
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div className="chips" role="group" aria-label="Filters">
            <Chip on={who === 'all'} onClick={() => setWho('all')} label="All" n={all.length} />
            {people.map((p) => (
              <Chip key={p.id} on={who === p.id} onClick={() => setWho(who === p.id ? 'all' : p.id)} label={p.name} n={all.filter((r) => r.knownBy.includes(p.id)).length} emoji={p.emoji} />
            ))}
            {people.length > 1 && <Chip on={who === 'both'} onClick={() => setWho(who === 'both' ? 'all' : 'both')} label="Both" n={all.filter((r) => people.every((p) => r.knownBy.includes(p.id))).length} />}
            {presentTypes.length > 0 && <span className="chip-sep" />}
            {presentTypes.map((t) => (
              <Chip key={t.id} on={type === t.id} onClick={() => setType(type === t.id ? null : t.id)} label={t.label} emoji={t.emoji} />
            ))}
          </div>
        </div>

        {all.length > 0 && (
          <div className="dex-meta">
            <span>
              {list.length === all.length ? `${all.length} ${all.length === 1 ? 'dish' : 'dishes'}` : `${list.length} of ${all.length}`}
            </span>
            <button className="sort-btn" onClick={() => { tap(); setSort(sort === 'no' ? 'az' : sort === 'az' ? 'new' : 'no') }}>
              <Icon name="sort" size={14} />
              {SORT_LABEL[sort]}
            </button>
          </div>
        )}

        {all.length === 0 ? (
          <EmptyDex partnerName={partner?.name} />
        ) : list.length === 0 ? (
          <div className="empty">
            <div style={{ fontSize: 44 }}>🔍</div>
            <h2 className="display">Nothing matches</h2>
            <p>Try a different search, or clear the filters.</p>
            <button className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => { setQ(''); setWho('all'); setType(null) }}>
              Clear filters
            </button>
          </div>
        ) : view === 'grid' ? (
          <div className="grid">
            <AnimatePresence mode="popLayout" initial={false}>
              {list.map((r, i) => (
                <RecipeCard key={r.id} r={r} no={nums.get(r.id) ?? 0} index={i} fresh={isNew(r, me, seen)} />
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <div className="rows">
            {list.map((r) => (
              <RecipeRow key={r.id} r={r} no={nums.get(r.id) ?? 0} fresh={isNew(r, me, seen)} />
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {!fabHidden && !inert && all.length > 0 && (
          <motion.button
            className="fab"
            style={{ x: '-50%' }}
            initial={{ y: 90, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 90, opacity: 0 }}
            whileTap={{ scale: 0.95 }}
            transition={spring}
            onClick={() => { tap(); go('/new') }}
          >
            <Icon name="plus" size={22} stroke={2.6} />
            Log a dish
          </motion.button>
        )}
      </AnimatePresence>
      <ReconnectSheet open={reconnectOpen} onClose={() => setReconnectOpen(false)} />
    </div>
  )
}

function AuthBanner({ onFix }: { onFix: () => void }) {
  return (
    <div className="banner banner-bad">
      <div className="banner-ic">
        <Icon name="key" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <b>Sync paused</b>
        <span className="muted">GitHub stopped accepting this phone’s key. Your dishes are safe.</span>
      </div>
      <button className="btn btn-primary btn-sm" onClick={onFix}>
        Fix
      </button>
    </div>
  )
}

/** What changed since you last looked: dishes sent to you, and the other person's new or edited dishes. */
function ForYou({ all }: { all: Recipe[] }) {
  const seen = useApp((s) => s.seen)
  const { me, byId } = usePeople()
  if (!me) return null
  const learn = all.filter((r) => r.learning[me]).sort((a, b) => b.learning[me].at.localeCompare(a.learning[me].at))
  const fresh = all.filter((r) => isNew(r, me, seen) && !r.learning[me]).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const items = [
    ...learn.map((r) => ({ r, line: `📚 ${byId(r.learning[me].from)?.name ?? 'Someone'} wants you to learn this` })),
    ...fresh.map((r) => ({ r, line: seen[r.id] ? `✏️ Updated by ${byId(r.updatedBy)?.name ?? 'someone'}` : `✨ New from ${byId(r.updatedBy)?.name ?? 'someone'}` })),
  ].slice(0, 10)
  return (
    <AnimatePresence initial={false}>
      {items.length > 0 && (
        <motion.section className="foryou" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={spring}>
          <div className="foryou-head">
            <span className="eyebrow">For you</span>
            {fresh.length > 0 && (
              <button className="link" style={{ fontSize: 13 }} onClick={() => { tap(); markAllSeen() }}>
                Mark seen
              </button>
            )}
          </div>
          <div className="foryou-row">
            {items.map(({ r, line }) => (
              <motion.button key={r.id} layout className="fy-card" whileTap={{ scale: 0.97 }} onClick={() => { tap(); go(`/r/${r.id}/fresh`) }}>
                <span className="fy-thumb">
                  <CardImage r={r} />
                </span>
                <span className="fy-text">
                  <span className="fy-title">{r.title}</span>
                  <span className="fy-sub">{line}</span>
                </span>
              </motion.button>
            ))}
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  )
}

function Chip({ on, onClick, label, n, emoji }: { on: boolean; onClick: () => void; label: string; n?: number; emoji?: string }) {
  return (
    <button className="chip" aria-pressed={on} onClick={() => { tap(); onClick() }}>
      {emoji && <span aria-hidden="true">{emoji}</span>}
      {label}
      {n !== undefined && <span className="n">{n}</span>}
    </button>
  )
}

function DuoCard({ person, isMe, known, total, learning }: { person: Person; isMe: boolean; known: number; total: number; learning: number }) {
  return (
    <motion.button className="duo-card" style={cssVar({ '--c': person.color })} whileTap={{ scale: 0.97 }} onClick={() => { tap(); go(`/p/${person.id}`) }}>
      <div className="duo-row">
        <Avatar person={person} size={30} />
        <span className="duo-name">
          {person.name}
          {isMe && <span className="faint" style={{ fontWeight: 500, fontSize: 13 }}> · you</span>}
        </span>
      </div>
      <div className="duo-count">
        <span>
          <b>{known}</b> / {total}
        </span>
        {learning > 0 && <span className="badge-count">📚 {learning}</span>}
      </div>
      <div className="meter" style={cssVar({ '--c': person.color })}>
        <motion.i initial={{ scaleX: 0 }} animate={{ scaleX: total ? known / total : 0 }} transition={{ ...spring, delay: 0.15 }} />
      </div>
    </motion.button>
  )
}

export function CardImage({ r }: { r: Recipe }) {
  const full = usePhoto(!r.thumb ? r.photo?.path : undefined)
  const src = r.thumb ?? full
  return src ? <img src={src} alt="" draggable={false} /> : <DishArt recipe={r} />
}

function RecipeCard({ r, no, index, fresh }: { r: Recipe; no: number; index: number; fresh: boolean }) {
  const t = r.types[0] ? DISH_TYPES.find((x) => x.id === r.types[0]) : undefined
  return (
    <motion.button
      className="card"
      layout
      initial={{ opacity: 0, y: 18, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1, transition: { ...spring, delay: Math.min(index, 10) * 0.035 } }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.18 } }}
      transition={spring}
      whileTap={{ scale: 0.97 }}
      onClick={() => { tap(); go(`/r/${r.id}`) }}
      aria-label={`${dexNo(no)} ${r.title}`}
    >
      <motion.div className="card-media" layoutId={`media-${r.id}`} style={{ borderRadius: 22 }} transition={spring}>
        <CardImage r={r} />
      </motion.div>
      <div className="card-shade" />
      <div className="card-top">
        <span className="dexno">
          {dexNo(no)}
          {fresh && <span className="new-dot" title="New from your partner" />}
        </span>
        <KnownDots ids={r.knownBy} size={24} ringColor="rgba(0,0,0,.18)" />
      </div>
      <div className="card-body">
        <div className="card-title">{r.title}</div>
        <div className="card-meta">
          <span>{t ? `${t.emoji} ${t.label}` : `Serves ${r.servings}`}</span>
          {r.minutes ? <span>{fmtMinutes(r.minutes)}</span> : t ? <span>Serves {r.servings}</span> : null}
        </div>
      </div>
    </motion.button>
  )
}

export function RecipeRow({ r, no, fresh, onOpen }: { r: Recipe; no: number; fresh?: boolean; onOpen?: () => void }) {
  return (
    <button className="row" onClick={() => { tap(); onOpen ? onOpen() : go(`/r/${r.id}`) }}>
      <span className="row-no">{dexNo(no)}</span>
      <div className="row-thumb" style={{ position: 'relative' }}>
        <CardImage r={r} />
      </div>
      <div className="row-main">
        <div className="row-title">
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.title}</span>
          {fresh && <span className="new-dot" />}
        </div>
        <div className="row-sub">
          {r.types.map((t) => (
            <TypeBadge key={t} id={t} />
          ))}
          {!r.types.length && <span className="faint" style={{ fontSize: 13 }}>Serves {r.servings}</span>}
        </div>
      </div>
      <KnownDots ids={r.knownBy} size={26} />
    </button>
  )
}

function EmptyDex({ partnerName }: { partnerName?: string }) {
  return (
    <div className="empty">
      <motion.div initial={{ scale: 0.8, opacity: 0, rotate: -8 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} transition={{ ...spring, delay: 0.1 }}>
        <Logo size={88} />
      </motion.div>
      <h2 className="display">Your dex is empty</h2>
      <p>
        Log the first dish one of you can cook. {partnerName ? `It’ll show up on ${partnerName}’s phone too.` : ''}
      </p>
      <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={() => go('/new')}>
        <Icon name="plus" size={20} stroke={2.6} /> Log the first dish
      </button>
    </div>
  )
}

function InstallBanner() {
  const [dismissed, setDismissed] = useState(prefs.installDismissed())
  const [, force] = useReducer((x: number) => x + 1, 0)
  useEffect(() => {
    const off = onInstallChange(force)
    return () => void off()
  }, [])
  if (dismissed || isStandalone()) return null
  const ios = isIOS()
  const can = canPromptInstall()
  if (!ios && !can) return null
  return (
    <div className="banner">
      <div className="banner-ic">
        <Icon name="phone" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <b>Put Dishdex on your home screen</b>
        {ios ? (
          <span className="muted">
            Tap <IosShareGlyph /> then “Add to Home Screen”. It opens already signed in.{' '}
            <button
              className="link"
              onClick={async () => {
                const me = useApp.getState().me
                if (me && (await copyText(makeInvite(me)))) toast('Invite copied — paste it if the app asks')
              }}
            >
              Copy invite
            </button>
          </span>
        ) : (
          <span className="muted">It installs like a normal app.</span>
        )}
      </div>
      {can && (
        <button className="btn btn-primary btn-sm" onClick={() => void promptInstall()}>
          Install
        </button>
      )}
      <button className="icon-btn" aria-label="Dismiss" onClick={() => { prefs.setInstallDismissed(); setDismissed(true) }}>
        <Icon name="close" size={16} />
      </button>
    </div>
  )
}
