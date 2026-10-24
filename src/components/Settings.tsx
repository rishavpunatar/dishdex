import { useState } from 'react'
import { relTime, tap } from '../lib/device'
import { back } from '../lib/router'
import { chooseMe, disconnect, exportBackup, syncNow, toast, updatePerson, useApp } from '../lib/store'
import { InviteSheet, ReconnectSheet } from './Connection'
import { PERSON_COLORS, PERSON_EMOJI, type Person } from '../lib/types'
import { Avatar, cssVar, Sheet, usePeople } from './bits'
import { Icon, type IconName } from './Icon'

export function Settings() {
  const conn = useApp((s) => s.conn)
  const sync = useApp((s) => s.sync)
  const { people, me, meP } = usePeople()
  const [editing, setEditing] = useState<Person | null>(null)
  const [sheet, setSheet] = useState<null | 'invite' | 'whoami' | 'key' | 'disconnect'>(null)

  const statusText =
    sync.state === 'auth'
      ? 'Access key rejected — update it below'
      : sync.state === 'offline'
        ? `Offline${sync.pending ? ` · ${sync.pending} change${sync.pending === 1 ? '' : 's'} waiting` : ''}`
        : sync.state === 'error'
          ? sync.message ?? 'Something went wrong'
          : sync.at
            ? `Synced ${relTime(new Date(sync.at).toISOString())}`
            : 'Not synced yet'

  return (
    <div className="screen">
      <div className="set-head">
        <button className="icon-btn soft" onClick={back} aria-label="Back">
          <Icon name="back" size={22} stroke={2.4} />
        </button>
      </div>
      <div className="set-body">
        <h1 className="set-title display">Settings</h1>

        <div className="eyebrow group-label">This phone</div>
        <div className="group">
          <Item icon="users" title={`Belongs to ${meP?.name ?? '…'}`} sub="Whose dishes count as “mine”" onClick={() => setSheet('whoami')} />
        </div>

        <div className="eyebrow group-label">People</div>
        <div className="group">
          {people.map((p) => (
            <button key={p.id} className="item" onClick={() => setEditing(p)}>
              <Avatar person={p} size={32} />
              <div className="item-main">
                {p.name}
                {p.id === me && <span className="faint"> · you</span>}
              </div>
              <Icon name="chevron" size={18} className="faint" />
            </button>
          ))}
          <Item icon="phone" title="Add a phone" sub="Scan a code — no setup needed" onClick={() => setSheet('invite')} accent />
        </div>

        <div className="eyebrow group-label">Sync</div>
        <div className="group">
          <Item icon="sync" title="Sync now" sub={statusText} onClick={() => { tap(); void syncNow() }} />
          <Item icon="lock" title={conn?.repo ?? ''} sub="Your private recipe repo" href={conn ? `https://github.com/${conn.repo}` : undefined} />
          <Item icon="key" title="Reconnect" sub="Paste a fresh invite or access key" onClick={() => setSheet('key')} />
        </div>

        <div className="eyebrow group-label">Your data</div>
        <div className="group">
          <Item icon="download" title="Export a backup" sub="Everything, as one file" onClick={exportBackup} />
          <Item icon="logout" title="Disconnect this phone" sub="Your dishes stay safe in GitHub" onClick={() => setSheet('disconnect')} danger />
        </div>

        <p className="faint" style={{ fontSize: 13, margin: '22px 4px 0', lineHeight: 1.5 }}>
          Recipes and photos go straight from your phones to your own private GitHub repo. There’s no Dishdex server, no analytics and no third-party scripts. Fonts are bundled with the app.
        </p>
      </div>

      <PersonSheet person={editing} onClose={() => setEditing(null)} />
      <InviteSheet open={sheet === 'invite'} onClose={() => setSheet(null)} />
      <ReconnectSheet open={sheet === 'key'} onClose={() => setSheet(null)} />

      <Sheet open={sheet === 'whoami'} onClose={() => setSheet(null)} label="Whose phone is this">
        <h3>Whose phone is this?</h3>
        <div className="whoami" style={{ marginTop: 16 }}>
          {people.map((p) => (
            <button key={p.id} onClick={() => { tap(); chooseMe(p.id); setSheet(null) }} style={p.id === me ? { boxShadow: `inset 0 0 0 2px ${p.color}` } : undefined}>
              <Avatar person={p} size={48} />
              {p.name}
            </button>
          ))}
        </div>
      </Sheet>

      <Sheet open={sheet === 'disconnect'} onClose={() => setSheet(null)} label="Disconnect">
        <h3>Disconnect this phone?</h3>
        <p>Your recipes stay safe in GitHub and on the other phone. You can reconnect any time with an invite.</p>
        <div className="sheet-actions">
          <button className="btn btn-primary btn-block" onClick={() => { setSheet(null); void disconnect() }}>
            Disconnect
          </button>
          <button className="btn btn-ghost btn-block" onClick={() => setSheet(null)}>
            Cancel
          </button>
        </div>
      </Sheet>
    </div>
  )
}

function Item({ icon, title, sub, onClick, href, accent, danger }: { icon: IconName; title: string; sub?: string; onClick?: () => void; href?: string; accent?: boolean; danger?: boolean }) {
  const inner = (
    <>
      <span className="item-ic" style={accent ? { background: 'var(--accent-soft)', color: 'var(--accent)' } : danger ? { color: 'var(--accent)' } : undefined}>
        <Icon name={icon} size={17} />
      </span>
      <div className="item-main">
        <div className={danger ? 'danger' : undefined} style={{ fontWeight: accent ? 650 : undefined }}>
          {title}
        </div>
        {sub && <div className="item-sub">{sub}</div>}
      </div>
      {(onClick || href) && <Icon name="chevron" size={18} className="faint" />}
    </>
  )
  if (href)
    return (
      <a className="item" href={href} target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>
        {inner}
      </a>
    )
  return (
    <button className="item" onClick={onClick} disabled={!onClick}>
      {inner}
    </button>
  )
}

export function PersonEditor({ value, onChange }: { value: Person; onChange: (p: Person) => void }) {
  return (
    <>
      <div className="person-ed-top">
        <Avatar person={value} size={52} />
        <input className="input" value={value.name} onChange={(e) => onChange({ ...value, name: e.target.value })} placeholder="Name" maxLength={24} aria-label="Name" />
      </div>
      <div className="emoji-row" role="group" aria-label="Avatar">
        <button type="button" className="emoji-btn" aria-pressed={!value.emoji} onClick={() => onChange({ ...value, emoji: '' })} style={{ fontSize: 16, fontWeight: 700 }}>
          {value.name.slice(0, 1).toUpperCase() || 'A'}
        </button>
        {PERSON_EMOJI.map((e) => (
          <button type="button" key={e} className="emoji-btn" aria-pressed={value.emoji === e} onClick={() => { tap(); onChange({ ...value, emoji: e }) }}>
            {e}
          </button>
        ))}
      </div>
      <div className="swatches" role="group" aria-label="Colour">
        {PERSON_COLORS.map((c) => (
          <button type="button" key={c} className="swatch" aria-label={`Colour ${c}`} aria-pressed={value.color === c} style={cssVar({ '--c': c })} onClick={() => { tap(); onChange({ ...value, color: c }) }} />
        ))}
      </div>
    </>
  )
}

function PersonSheet({ person, onClose }: { person: Person | null; onClose: () => void }) {
  const [draft, setDraft] = useState<Person | null>(null)
  const cur = draft && person && draft.id === person.id ? draft : person
  return (
    <Sheet open={!!person} onClose={() => { setDraft(null); onClose() }} label="Edit person">
      {cur && (
        <>
          <h3>Edit {person?.name}</h3>
          <div style={{ marginTop: 16 }}>
            <PersonEditor value={cur} onChange={setDraft} />
          </div>
          <div className="sheet-actions">
            <button
              className="btn btn-primary btn-block"
              disabled={!cur.name.trim()}
              onClick={() => {
                void updatePerson({ ...cur, name: cur.name.trim() })
                toast('Saved')
                setDraft(null)
                onClose()
              }}
            >
              Save
            </button>
          </div>
        </>
      )}
    </Sheet>
  )
}
