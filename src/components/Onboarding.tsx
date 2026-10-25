import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { copyText, isIOS, isStandalone, tap } from '../lib/device'
import { DEMO_REPO, makeRemote } from '../lib/remote'
import { chooseMe, connect, createProfiles, describeError, disconnect, joinWithInvite, parseInvite, retryBoot, toast, useApp, type Phase } from '../lib/store'
import type { Person, Profiles } from '../lib/types'
import { Avatar, DishArt, Logo, softSpring, spring, usePeople } from './bits'
import { Icon, IosShareGlyph } from './Icon'
import { PersonEditor } from './Settings'

const DEFAULT_REPO = import.meta.env.VITE_DEFAULT_REPO ?? ''
const TOKEN_URL =
  'https://github.com/settings/personal-access-tokens/new?' +
  new URLSearchParams({
    name: 'Dishdex',
    description: 'Lets the Dishdex app on our phones read and save recipes.',
    expires_in: 'none',
    contents: 'write',
  }).toString()

const fade = {
  initial: { opacity: 0, x: 24 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -24 },
  transition: softSpring,
}

async function readClipboard(): Promise<string> {
  return navigator.clipboard.readText()
}

export function Splash() {
  const sync = useApp((s) => s.sync)
  const joining = useApp((s) => s.joining)
  const failed = !joining && (sync.state === 'offline' || sync.state === 'error' || sync.state === 'auth')
  return (
    <div className="splash">
      <div style={{ textAlign: 'center', padding: 24 }}>
        <motion.div animate={failed ? { scale: 1 } : { scale: [1, 1.06, 1] }} transition={{ duration: 1.6, repeat: failed ? 0 : Infinity }}>
          <Logo size={72} />
        </motion.div>
        {joining && (
          <motion.p className="muted" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ marginTop: 18 }}>
            Setting up your dex…
          </motion.p>
        )}
        {failed && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <p className="muted" style={{ maxWidth: 300, margin: '18px auto 0' }}>
              {sync.message ?? 'Couldn’t reach your dex.'}
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
              <button className="btn btn-primary btn-sm" onClick={() => void retryBoot()}>
                Try again
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => void disconnect()}>
                Start over
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}

type Screen = 'welcome' | 'connect' | 'join' | 'install'

export function Onboarding({ phase, invite }: { phase: Phase; invite: string | null }) {
  const pending = useApp((s) => s.pendingInvite)
  const code = invite ?? pending
  const iosSafari = isIOS() && !isStandalone()
  const [screen, setScreen] = useState<Screen>(code ? (iosSafari && invite ? 'install' : 'join') : 'welcome')
  return (
    <div className="screen">
      <AnimatePresence mode="wait">
        {phase === 'setup' ? (
          <Setup key="setup" />
        ) : phase === 'whoami' ? (
          <WhoAmI key="whoami" />
        ) : screen === 'connect' ? (
          <Connect key="connect" onBack={() => setScreen('welcome')} />
        ) : screen === 'join' ? (
          <Join key="join" initial={code} onBack={() => setScreen('welcome')} />
        ) : screen === 'install' && code ? (
          <InstallGuide key="install" code={code} onUseHere={() => setScreen('join')} />
        ) : (
          <Welcome key="welcome" onStart={() => setScreen('connect')} onJoin={() => setScreen('join')} />
        )}
      </AnimatePresence>
    </div>
  )
}

const FAN = [
  { id: 'a', title: 'Shakshuka', types: ['breakfast'], rot: -13, x: -92, y: 18, n: 3 },
  { id: 'c', title: 'Tiramisu', types: ['dessert'], rot: 13, x: 92, y: 18, n: 12 },
  { id: 'b', title: 'Dal tadka', types: ['curry'], rot: 0, x: 0, y: 0, n: 1 },
]

function Fan() {
  return (
    <div className="fan" aria-hidden="true">
      {FAN.map((c, i) => (
        <motion.div
          key={c.id}
          className="fan-card"
          initial={{ y: 80, opacity: 0, rotate: 0, x: 0 }}
          animate={{ y: [c.y, c.y - 8, c.y], opacity: 1, rotate: c.rot, x: c.x }}
          transition={{
            opacity: { delay: 0.1 + i * 0.08 },
            rotate: { ...spring, delay: 0.1 + i * 0.08 },
            x: { ...spring, delay: 0.1 + i * 0.08 },
            y: { duration: 4 + i, repeat: Infinity, ease: 'easeInOut', delay: i * 0.4 },
          }}
        >
          <DishArt recipe={c} />
          <span className="dexno">Nº {String(c.n).padStart(3, '0')}</span>
        </motion.div>
      ))}
    </div>
  )
}

function Welcome({ onStart, onJoin }: { onStart: () => void; onJoin: () => void }) {
  // Opened from the Home Screen with nothing set up: almost always the second person, holding an invite.
  const inviteFirst = isStandalone()
  return (
    <motion.div className="ob" {...fade}>
      <div className="ob-hero">
        <Fan />
        <motion.h1 className="display wordmark" style={{ fontSize: 'inherit' }} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.25 }}>
          <span>
            Dish<em>dex</em>
          </span>
        </motion.h1>
        <motion.p className="ob-lede" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.32 }}>
          Every dish the two of you can cook, in one shared dex. Snap it, jot the rough recipe, tag who knows it — and collect a medal every ten.
        </motion.p>
      </div>
      <motion.div className="ob-actions" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.4 }}>
        {inviteFirst ? (
          <>
            <button className="btn btn-primary btn-block" onClick={() => { tap(); onJoin() }}>
              Join with an invite
            </button>
            <button className="btn btn-ghost btn-block" onClick={() => { tap(); onStart() }}>
              Start a new Dishdex
            </button>
          </>
        ) : (
          <>
            <button className="btn btn-primary btn-block" onClick={() => { tap(); onStart() }}>
              Start our Dishdex
            </button>
            <button className="btn btn-ghost btn-block" onClick={() => { tap(); onJoin() }}>
              I have an invite
            </button>
          </>
        )}
        {import.meta.env.DEV && (
          <button className="btn btn-ghost btn-block btn-sm" onClick={() => void connect(DEMO_REPO, 'demo')}>
            Dev: use local demo repo
          </button>
        )}
      </motion.div>
    </motion.div>
  )
}

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button className="icon-btn soft" onClick={onClick} aria-label="Back" style={{ marginLeft: -4 }}>
      <Icon name="back" size={22} stroke={2.4} />
    </button>
  )
}

function Connect({ onBack }: { onBack: () => void }) {
  const [repo, setRepo] = useState(DEFAULT_REPO)
  const [editRepo, setEditRepo] = useState(!DEFAULT_REPO)
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const repoName = repo.split('/').pop() || 'your recipe repo'

  const go = async (t = token) => {
    if (!repo.trim() || !t.trim()) return
    setBusy(true)
    setErr('')
    try {
      await connect(repo, t)
    } catch (e) {
      setErr(describeError(e))
      setBusy(false)
    }
  }
  const paste = async () => {
    try {
      const t = (await readClipboard()).trim()
      setToken(t)
      if (/^github_pat_/.test(t)) void go(t)
    } catch {
      setErr('Couldn’t read the clipboard. Long-press the box and paste instead.')
    }
  }

  return (
    <motion.div className="ob" {...fade}>
      <BackBtn onClick={onBack} />
      <h2 className="display">Connect your kitchen</h2>
      <p className="ob-lede" style={{ fontSize: 16 }}>
        Your dishes live in a private GitHub repo you own, and both phones sync through it. One-time setup, about a minute.
      </p>

      {editRepo ? (
        <input className="input" style={{ marginTop: 18 }} value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="owner/repo — e.g. you/dishdex-data" autoCapitalize="off" autoCorrect="off" spellCheck={false} aria-label="Recipe repo" />
      ) : (
        <div className="repo-chip">
          <Icon name="lock" size={15} />
          <span>{repo}</span>
          <button className="link" onClick={() => setEditRepo(true)}>
            Change
          </button>
        </div>
      )}

      <div className="step-card">
        <span className="num">1</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h4>Create a key on GitHub</h4>
          <p>
            Name, permissions and “no expiry” are filled in. Just choose <b>Only select repositories → {repoName}</b>, then <b>Generate token</b> and copy it.
          </p>
          <a className="btn btn-soft btn-sm" style={{ marginTop: 10 }} href={TOKEN_URL} target="_blank" rel="noreferrer">
            <Icon name="key" size={16} /> Open GitHub
          </a>
        </div>
      </div>

      <div className="step-card">
        <span className="num">2</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h4>Paste it here</h4>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <input className="input" type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} placeholder="github_pat_…" aria-label="Access key" onKeyDown={(e) => e.key === 'Enter' && void go()} />
            <button className="btn btn-ghost" style={{ height: 52, flex: 'none' }} onClick={() => void paste()}>
              Paste
            </button>
          </div>
        </div>
      </div>

      {err && <div className="err">{err}</div>}
      <div style={{ flex: 1, minHeight: 20 }} />
      <button className="btn btn-primary btn-block" style={{ marginTop: 20 }} disabled={!repo.trim() || !token.trim() || busy} onClick={() => void go()}>
        {busy ? 'Connecting…' : 'Connect'}
      </button>
      <div className="privacy-note">
        <Icon name="sparkle" size={16} style={{ flex: 'none', marginTop: 2 }} />
        <span>Tip: it’s easiest on a computer. Set up there, then use Settings → Add a phone and scan the code.</span>
      </div>
      <div className="privacy-note" style={{ marginTop: 8 }}>
        <Icon name="lock" size={16} style={{ flex: 'none', marginTop: 2 }} />
        <span>The key stays on your devices and only talks to GitHub. No Dishdex server, no tracking.</span>
      </div>
    </motion.div>
  )
}

function Join({ initial, onBack }: { initial: string | null; onBack: () => void }) {
  const [text, setText] = useState(initial ?? '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const inv = parseInvite(text)

  const join = async (t = text) => {
    const i = parseInvite(t)
    if (!i) return setErr('That doesn’t look like a Dishdex invite.')
    setBusy(true)
    setErr('')
    try {
      await joinWithInvite(i)
    } catch (e) {
      setErr(describeError(e))
      setBusy(false)
    }
  }

  const auto = useRef(false)
  useEffect(() => {
    if (auto.current || !initial || !parseInvite(initial)) return
    auto.current = true
    void join(initial)
  }, [])

  const paste = async () => {
    try {
      const t = await readClipboard()
      setText(t)
      if (parseInvite(t)) void join(t)
      else setErr('Nothing that looks like an invite on the clipboard.')
    } catch {
      setErr('Couldn’t read the clipboard. Long-press the box and paste instead.')
    }
  }

  return (
    <motion.div className="ob" {...fade}>
      <BackBtn onClick={onBack} />
      <h2 className="display">Join with an invite</h2>
      <p className="ob-lede" style={{ fontSize: 16 }}>
        Copy the invite link you were sent, then tap Paste. Or scan the code on the other phone with your camera.
      </p>
      <button className="btn btn-primary btn-block" style={{ marginTop: 22 }} disabled={busy} onClick={() => void paste()}>
        <Icon name="copy" size={18} /> {busy ? 'Joining…' : 'Paste invite'}
      </button>
      <textarea className="text-area" style={{ marginTop: 12, minHeight: 96 }} value={text} onChange={(e) => setText(e.target.value)} placeholder="…or paste it here yourself" autoCapitalize="off" autoCorrect="off" spellCheck={false} />
      {err && <div className="err">{err}</div>}
      <div style={{ flex: 1, minHeight: 20 }} />
      {inv && !busy && (
        <button className="btn btn-primary btn-block" onClick={() => void join()}>
          Join the dex
        </button>
      )}
    </motion.div>
  )
}

/** iPhone Safari, opened from an invite: get it onto the Home Screen first. The invite rides along in a cookie. */
function InstallGuide({ code, onUseHere }: { code: string; onUseHere: () => void }) {
  const inv = parseInvite(code)
  const [people, setPeople] = useState<Person[] | null>(null)
  useEffect(() => {
    if (!inv) return
    makeRemote({ repo: inv.r, token: inv.t, branch: inv.b ?? 'main' })
      .get('profiles.json')
      .then((f) => f && setPeople((JSON.parse(f.text) as Profiles).people))
      .catch(() => {})
  }, [])
  const me = people?.find((p) => p.id === inv?.p)
  const other = people?.find((p) => p.id !== inv?.p)
  return (
    <motion.div className="ob" {...fade}>
      <div className="ob-hero" style={{ justifyContent: 'flex-start', paddingTop: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Logo size={52} />
          {me && <Avatar person={me} size={44} />}
        </div>
        <h2 className="display" style={{ marginTop: 18 }}>
          {me ? `Hi ${me.name} 👋` : 'You’re invited 👋'}
        </h2>
        <p className="ob-lede" style={{ fontSize: 16 }}>
          {other ? `${other.name} shared your Dishdex.` : 'Someone shared their Dishdex with you.'} Put it on your Home Screen and it works like an app, already signed in.
        </p>
        <ol className="install-steps">
          <li>
            <span className="num">1</span>
            <span>
              Tap <span className="kbd"><IosShareGlyph /></span> in Safari’s toolbar <span className="faint">(on newer iPhones it’s under ⋯)</span>
            </span>
          </li>
          <li>
            <span className="num">2</span>
            <span>
              Choose <b>Add to Home Screen</b>, then <b>Add</b>
            </span>
          </li>
          <li>
            <span className="num">3</span>
            <span>Open Dishdex from your Home Screen</span>
          </li>
        </ol>
      </div>
      <motion.div className="install-arrow" aria-hidden="true" animate={{ y: [0, 10, 0] }} transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}>
        <Icon name="back" size={26} stroke={2.6} style={{ transform: 'rotate(-90deg)' }} />
      </motion.div>
      <div className="ob-actions">
        <button className="btn btn-ghost btn-block" onClick={onUseHere}>
          Use it in Safari instead
        </button>
        <p className="faint" style={{ fontSize: 13, textAlign: 'center', margin: '4px 0 0' }}>
          If the app asks for an invite,{' '}
          <button className="link" style={{ fontSize: 13 }} onClick={async () => { if (await copyText(code)) toast('Invite copied — tap Paste invite in the app') }}>
            copy it
          </button>{' '}
          and tap Paste invite.
        </p>
      </div>
    </motion.div>
  )
}

function Setup() {
  const [a, setA] = useState<Person>({ id: 'p1', name: '', emoji: '', color: '#7D2E36' })
  const [b, setB] = useState<Person>({ id: 'p2', name: '', emoji: '', color: '#2E4A6B' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const ok = a.name.trim() && b.name.trim()
  return (
    <motion.div className="ob" {...fade}>
      <h2 className="display">Who’s in this kitchen?</h2>
      <p className="ob-lede" style={{ fontSize: 16 }}>
        Two cooks, one dex. You can change these later.
      </p>
      <div className="person-ed">
        <div className="eyebrow" style={{ marginBottom: 10 }}>
          You
        </div>
        <PersonEditor value={a} onChange={setA} />
      </div>
      <div className="person-ed">
        <div className="eyebrow" style={{ marginBottom: 10 }}>
          Your partner
        </div>
        <PersonEditor value={b} onChange={setB} />
      </div>
      <div style={{ flex: 1, minHeight: 20 }} />
      <button
        className="btn btn-primary btn-block"
        style={{ marginTop: 20 }}
        disabled={!ok || busy}
        onClick={async () => {
          setBusy(true)
          setErr('')
          tap(16)
          try {
            await createProfiles([{ ...a, name: a.name.trim() }, { ...b, name: b.name.trim() }], a.id)
          } catch (e) {
            setErr(describeError(e))
            setBusy(false)
          }
        }}
      >
        {busy ? 'Creating…' : 'Create our dex'}
      </button>
      {err && <div className="err">{err}</div>}
    </motion.div>
  )
}

function WhoAmI() {
  const { people } = usePeople()
  return (
    <motion.div className="ob" {...fade}>
      <div className="ob-hero" style={{ flex: 'none', paddingTop: 40 }}>
        <Logo size={56} />
        <h2 className="display" style={{ marginTop: 18 }}>
          Which one are you?
        </h2>
        <p className="ob-lede" style={{ fontSize: 16 }}>
          So this phone knows whose dishes are “yours”.
        </p>
      </div>
      <div className="whoami">
        {people.map((p) => (
          <motion.button key={p.id} whileTap={{ scale: 0.97 }} onClick={() => { tap(16); chooseMe(p.id) }}>
            <Avatar person={p} size={52} />
            {p.name}
          </motion.button>
        ))}
      </div>
    </motion.div>
  )
}
