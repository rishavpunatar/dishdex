import { useEffect, useMemo, useState } from 'react'
import { encode } from 'uqr'
import { copyText, tap } from '../lib/device'
import { describeError, inviteLink, makeInvite, reconnect, toast } from '../lib/store'
import { Avatar, cssVar, Sheet, usePeople } from './bits'
import { Icon } from './Icon'

export function QR({ text, size = 208 }: { text: string; size?: number }) {
  const { d, n } = useMemo(() => {
    const qr = encode(text, { ecc: 'L', border: 2 })
    let path = ''
    qr.data.forEach((row, y) =>
      row.forEach((on, x) => {
        if (on) path += `M${x} ${y}h1v1h-1z`
      }),
    )
    return { d: path, n: qr.size }
  }, [text])
  return (
    <svg className="qr" viewBox={`0 0 ${n} ${n}`} width={size} height={size} shapeRendering="crispEdges" role="img" aria-label="QR code for the invite link">
      <rect width={n} height={n} fill="#fff" />
      <path d={d} fill="#1d1814" />
    </svg>
  )
}

/** Get another phone onto the same dex: scan the code, or send the link. */
export function InviteSheet({ open, onClose, initialFor }: { open: boolean; onClose: () => void; initialFor?: string }) {
  const { people, me, partner } = usePeople()
  const [forId, setForId] = useState(initialFor ?? partner?.id ?? me ?? '')
  useEffect(() => {
    if (open) setForId(initialFor ?? partner?.id ?? me ?? '')
  }, [open])
  const person = people.find((p) => p.id === forId)
  const link = open && forId ? inviteLink(makeInvite(forId)) : ''
  const isMe = forId === me

  const share = async () => {
    const text = isMe
      ? `Open this on your phone to add it to our Dishdex:\n${link}`
      : `Join our Dishdex 🍽️\nOpen this on your phone, then add it to your Home Screen:\n${link}`
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Dishdex invite', text })
      } catch {
        /* cancelled */
      }
    } else if (await copyText(text)) toast('Invite copied')
  }

  return (
    <Sheet open={open} onClose={onClose} label="Add a phone">
      <h3>Add a phone</h3>
      <div className="who-grid" style={{ marginTop: 14 }}>
        {people.map((p) => (
          <button key={p.id} className="who-btn" aria-pressed={forId === p.id} style={cssVar({ '--c': p.color })} onClick={() => { tap(); setForId(p.id) }}>
            <Avatar person={p} size={30} />
            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.id === me ? 'Me' : p.name}</span>
            <span className="know-tick">
              <Icon name="check" size={13} stroke={3} />
            </span>
          </button>
        ))}
      </div>
      {link && (
        <div className="qr-wrap">
          <QR text={link} />
          <p>
            {isMe ? 'Point your other phone’s camera at this.' : `Point ${person?.name ?? 'their'}’s phone camera at this`}, or send the link. It opens already set up as {person?.name}.
          </p>
        </div>
      )}
      <div className="sheet-actions" style={{ flexDirection: 'row' }}>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => void share()}>
          <Icon name="share" size={19} /> Send link
        </button>
        <button className="btn btn-ghost" onClick={async () => { if (await copyText(link)) toast('Link copied') }} aria-label="Copy link">
          <Icon name="copy" size={19} />
        </button>
      </div>
      <div className="privacy-note">
        <Icon name="lock" size={16} style={{ flex: 'none', marginTop: 2 }} />
        <span>The link carries the key to your recipe repo. Only share it with {isMe ? 'yourself' : person?.name}.</span>
      </div>
    </Sheet>
  )
}

/** For when GitHub stops accepting the key: paste a fresh invite or key, nothing queued is lost. */
export function ReconnectSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { partner } = usePeople()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  useEffect(() => {
    if (open) {
      setText('')
      setErr('')
    }
  }, [open])
  const go = async (value = text) => {
    setBusy(true)
    setErr('')
    try {
      await reconnect(value)
      toast('Reconnected')
      onClose()
    } catch (e) {
      setErr(describeError(e))
    } finally {
      setBusy(false)
    }
  }
  const paste = async () => {
    try {
      const t = await navigator.clipboard.readText()
      setText(t)
      if (t.trim()) void go(t)
    } catch {
      setErr('Couldn’t read the clipboard. Long-press the box and paste instead.')
    }
  }
  return (
    <Sheet open={open} onClose={onClose} label="Reconnect">
      <h3>Reconnect</h3>
      <p>
        GitHub stopped accepting this phone’s key. Paste a fresh invite{partner ? ` (from ${partner.name}’s Settings → Add a phone)` : ''} or a new access key. Anything waiting to sync is kept.
      </p>
      <textarea className="text-area" style={{ marginTop: 14, minHeight: 84 }} value={text} onChange={(e) => setText(e.target.value)} placeholder="Invite link or github_pat_…" autoCapitalize="off" autoCorrect="off" spellCheck={false} />
      {err && <div className="err">{err}</div>}
      <div className="sheet-actions" style={{ flexDirection: 'row' }}>
        <button className="btn btn-ghost" onClick={() => void paste()}>
          <Icon name="copy" size={18} /> Paste
        </button>
        <button className="btn btn-primary" style={{ flex: 1 }} disabled={!text.trim() || busy} onClick={() => void go()}>
          {busy ? 'Checking…' : 'Reconnect'}
        </button>
      </div>
    </Sheet>
  )
}
