import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { tap } from '../lib/device'
import { DEMO_REPO } from '../lib/remote'
import { chooseMe, connect, createProfiles, describeError, disconnect, joinWithInvite, parseInvite, retryBoot, useApp, type Phase } from '../lib/store'
import type { Person } from '../lib/types'
import { Avatar, DishArt, Logo, softSpring, spring, usePeople } from './bits'
import { Icon } from './Icon'
import { PersonEditor } from './Settings'

const DEFAULT_REPO = import.meta.env.VITE_DEFAULT_REPO ?? ''
const TOKEN_URL =
  'https://github.com/settings/personal-access-tokens/new?' +
  new URLSearchParams({
    name: 'Dishdex',
    description: 'Lets the Dishdex app on our phones read and save recipes.',
    expires_in: '365',
    contents: 'write',
  }).toString()

const fade = {
  initial: { opacity: 0, x: 24 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -24 },
  transition: softSpring,
}

export function Splash() {
  const sync = useApp((s) => s.sync)
  const failed = sync.state === 'offline' || sync.state === 'error' || sync.state === 'auth'
  return (
    <div className="splash">
      <div style={{ textAlign: 'center', padding: 24 }}>
        <motion.div animate={failed ? { scale: 1 } : { scale: [1, 1.06, 1] }} transition={{ duration: 1.6, repeat: failed ? 0 : Infinity }}>
          <Logo size={72} />
        </motion.div>
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

export function Onboarding({ phase, invite }: { phase: Phase; invite: string | null }) {
  const [screen, setScreen] = useState<'welcome' | 'connect' | 'join'>(invite ? 'join' : 'welcome')
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
          <Join key="join" initial={invite} onBack={() => setScreen('welcome')} />
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

function Welcome({ onStart, onJoin }: { onStart: () => void; onJoin: () => void }) {
  return (
    <motion.div className="ob" {...fade}>
      <div className="ob-hero">
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
              <span className="dexno">#{String(c.n).padStart(3, '0')}</span>
            </motion.div>
          ))}
        </div>
        <motion.h1 className="display" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.25 }}>
          Dishdex
        </motion.h1>
        <motion.p className="ob-lede" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.32 }}>
          Every dish the two of you can cook, in one shared dex. Snap it, jot the rough recipe, tag who knows it.
        </motion.p>
      </div>
      <motion.div className="ob-actions" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.4 }}>
        <button className="btn btn-primary btn-block" onClick={() => { tap(); onStart() }}>
          Start our Dishdex
        </button>
        <button className="btn btn-ghost btn-block" onClick={() => { tap(); onJoin() }}>
          I have an invite
        </button>
        {import.meta.env.DEV && <DemoButton />}
      </motion.div>
    </motion.div>
  )
}

function DemoButton() {
  return (
    <button
      className="btn btn-ghost btn-block btn-sm"
      onClick={async () => {
        await connect(DEMO_REPO, 'demo')
      }}
    >
      Dev: use local demo repo
    </button>
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
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const go = async () => {
    setBusy(true)
    setErr('')
    try {
      await connect(repo, token)
    } catch (e) {
      setErr(describeError(e))
      setBusy(false)
    }
  }
  return (
    <motion.div className="ob" {...fade}>
      <BackBtn onClick={onBack} />
      <h2 className="display">Connect your kitchen</h2>
      <p className="ob-lede" style={{ fontSize: 16 }}>
        Your recipes live in a private GitHub repo that you own, and both phones sync through it. You only do this once.
      </p>

      <div className="step-card">
        <span className="num">1</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h4>Your recipe repo</h4>
          <p>A private repo, e.g. you/dishdex-data.</p>
          <input className="input" style={{ marginTop: 10 }} value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="owner/repo" autoCapitalize="off" autoCorrect="off" spellCheck={false} />
        </div>
      </div>

      <div className="step-card">
        <span className="num">2</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h4>An access key for it</h4>
          <a className="btn btn-soft btn-sm" style={{ marginTop: 6 }} href={TOKEN_URL} target="_blank" rel="noreferrer">
            <Icon name="key" size={16} /> Create a key on GitHub
          </a>
          <ol>
            <li>Under <b>Repository access</b>, pick <b>Only select repositories</b> and choose your recipe repo.</li>
            <li>Under <b>Permissions → Contents</b>, choose <b>Read and write</b>.</li>
            <li>Generate the token, copy it, and paste it here.</li>
          </ol>
          <input className="input" style={{ marginTop: 10 }} type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} placeholder="github_pat_…" />
        </div>
      </div>

      {err && <div className="err">{err}</div>}
      <div style={{ flex: 1, minHeight: 20 }} />
      <button className="btn btn-primary btn-block" style={{ marginTop: 20 }} disabled={!repo.trim() || !token.trim() || busy} onClick={() => void go()}>
        {busy ? 'Connecting…' : 'Connect'}
      </button>
      <div className="privacy-note">
        <Icon name="lock" size={16} style={{ flex: 'none', marginTop: 2 }} />
        <span>The key stays on this phone and only talks to GitHub. No Dishdex server, no tracking.</span>
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
      const t = await navigator.clipboard.readText()
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
        Paste the invite message or link you were sent. It connects this phone to the same dex.
      </p>
      <textarea className="text-area" style={{ marginTop: 18, minHeight: 120 }} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste the invite here" autoCapitalize="off" autoCorrect="off" spellCheck={false} />
      <button className="btn btn-ghost btn-sm" style={{ marginTop: 10, alignSelf: 'flex-start' }} onClick={() => void paste()}>
        <Icon name="copy" size={16} /> Paste from clipboard
      </button>
      {err && <div className="err">{err}</div>}
      <div style={{ flex: 1, minHeight: 20 }} />
      <button className="btn btn-primary btn-block" disabled={!inv || busy} onClick={() => void join()}>
        {busy ? 'Joining…' : 'Join the dex'}
      </button>
    </motion.div>
  )
}

function Setup() {
  const [a, setA] = useState<Person>({ id: 'p1', name: '', emoji: '🧑‍🍳', color: '#E4482F' })
  const [b, setB] = useState<Person>({ id: 'p2', name: '', emoji: '🦊', color: '#7357F6' })
  const [busy, setBusy] = useState(false)
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
          tap(16)
          await createProfiles([{ ...a, name: a.name.trim() }, { ...b, name: b.name.trim() }], a.id)
        }}
      >
        Create our dex
      </button>
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
