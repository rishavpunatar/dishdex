import { motion } from 'motion/react'
import { useMemo, useState } from 'react'
import { tap } from '../lib/device'
import { back, go } from '../lib/router'
import { useApp } from '../lib/store'
import { Avatar, cssVar, spring, useDexNumbers, usePeople } from './bits'
import { RecipeRow } from './Dex'
import { Icon } from './Icon'

type Tab = 'knows' | 'only'

export function Profile({ id }: { id: string }) {
  const recipes = useApp((s) => s.recipes)
  const { people, me, byId } = usePeople()
  const nums = useDexNumbers()
  const person = byId(id)
  const [tab, setTab] = useState<Tab>('knows')

  const all = useMemo(() => Object.values(recipes).sort((a, b) => (nums.get(a.id) ?? 0) - (nums.get(b.id) ?? 0)), [recipes, nums])
  if (!person) return null

  const knows = all.filter((r) => r.knownBy.includes(id))
  const only = knows.filter((r) => r.knownBy.length === 1)
  const isMe = id === me
  const other = people.find((p) => p.id !== id)
  const list = tab === 'knows' ? knows : only
  const pct = all.length ? knows.length / all.length : 0

  const emptyText: Record<Tab, string> = {
    knows: isMe ? 'Nothing tagged to you yet. Open a dish and tap your name under “Who can cook it”.' : `Nothing tagged to ${person.name} yet.`,
    only: other ? `No dishes only ${isMe ? 'you know' : `${person.name} knows`}. Everything is shared with ${isMe ? other.name : 'you'}.` : 'Nothing here yet.',
  }

  return (
    <div className="screen">
      <div className="top-bar">
        <button className="icon-btn glass" onClick={back} aria-label="Back">
          <Icon name="back" size={22} stroke={2.4} />
        </button>
        {isMe && (
          <button className="icon-btn glass" onClick={() => go('/settings')} aria-label="Edit profile">
            <Icon name="edit" size={18} />
          </button>
        )}
      </div>

      <div className="prof-head" style={cssVar({ '--c': person.color })}>
        <motion.div className="ring" style={cssVar({ '--c': person.color, '--p': pct })} initial={{ scale: 0.85 }} animate={{ scale: 1 }} transition={spring}>
          <div className="ring-inner">
            <Avatar person={person} size={84} />
          </div>
        </motion.div>
        <h1 className="prof-name display">{person.name}</h1>
        <div className="muted">
          Can cook <b style={{ color: 'var(--ink)' }}>{knows.length}</b> of {all.length} {all.length === 1 ? 'dish' : 'dishes'}
          {all.length > 0 && <> · {Math.round(pct * 100)}%</>}
        </div>
      </div>

      <div className="wrap" style={{ paddingBottom: 'calc(var(--bottom) + 40px)' }}>
        <div className="tabs" role="tablist">
          {(
            [
              ['knows', 'Can cook', knows.length],
              ['only', 'Signature', only.length],
            ] as const
          ).map(([k, label, n]) => (
            <button key={k} role="tab" aria-pressed={tab === k} aria-selected={tab === k} onClick={() => { tap(); setTab(k) }}>
              {tab === k && <motion.span layoutId={`tab-${id}`} className="seg-pill" transition={spring} />}
              <span style={{ position: 'relative' }}>
                {label}
                <span className="n">{n}</span>
              </span>
            </button>
          ))}
        </div>
        {tab === 'only' && list.length > 0 && (
          <p className="faint" style={{ fontSize: 13.5, margin: '4px 2px 6px' }}>
            Only {isMe ? 'you' : person.name} can make these{other ? ` — ${isMe ? `teach ${other.name}` : 'ask for a lesson'}` : ''}.
          </p>
        )}
        {list.length === 0 ? (
          <p className="faint" style={{ textAlign: 'center', padding: '36px 20px' }}>
            {emptyText[tab]}
          </p>
        ) : (
          <div>
            {list.map((r) => (
              <RecipeRow key={r.id} r={r} no={nums.get(r.id) ?? 0} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
