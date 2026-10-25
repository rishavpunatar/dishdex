import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { tap } from '../lib/device'
import { importLink, importPhotos, importText, type ImportKind } from '../lib/importer'
import { go } from '../lib/router'
import { useApp } from '../lib/store'
import { Sheet, softSpring } from './bits'
import { Icon, type IconName } from './Icon'

type Mode = 'menu' | ImportKind | 'working'

const OPTIONS: { mode: Mode | 'write'; icon: IconName; title: string; sub: string }[] = [
  { mode: 'write', icon: 'edit', title: 'Write it in', sub: 'Start from a blank dish' },
  { mode: 'url', icon: 'link', title: 'From a link', sub: 'Any recipe website' },
  { mode: 'text', icon: 'copy', title: 'Paste a recipe', sub: 'From notes, messages, anywhere' },
  { mode: 'photo', icon: 'camera', title: 'Cookbook page', sub: 'Snap the page, we’ll read it' },
]

const EXPECT: Record<ImportKind, string> = {
  url: 'Usually under a minute.',
  text: 'Usually a minute or two.',
  photo: 'Cookbook pages take about 2–4 minutes.',
}

/** "Log a dish": write one in, or import from a link, pasted text or a cookbook photo. */
export function AddDishSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [mode, setMode] = useState<Mode>('menu')
  const [url, setUrl] = useState('')
  const [text, setText] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [job, setJob] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const item = useApp((s) => s.imports.find((i) => i.id === job))

  useEffect(() => {
    if (!open) return
    setMode('menu')
    setUrl('')
    setText('')
    setFiles([])
    setErr('')
    setBusy(false)
    setJob(null)
  }, [open])

  // Result arrived while the sheet is still open: go straight to review.
  useEffect(() => {
    if (open && item?.status === 'ready') {
      onClose()
      go(`/import/${item.id}`)
    }
  }, [open, item?.status])

  const run = async (fn: () => Promise<{ id: string; status: string }>) => {
    setBusy(true)
    setErr('')
    try {
      const it = await fn()
      tap(16)
      setJob(it.id)
      if (it.status === 'ready') {
        onClose()
        go(`/import/${it.id}`)
      } else setMode('working')
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const paste = async (set: (v: string) => void) => {
    try {
      set(await navigator.clipboard.readText())
    } catch {
      setErr('Couldn’t read the clipboard. Long-press the box and paste instead.')
    }
  }

  const back = (
    <button className="icon-btn soft" onClick={() => { setErr(''); setMode('menu') }} aria-label="Back" style={{ marginLeft: -6 }}>
      <Icon name="back" size={20} stroke={2.4} />
    </button>
  )

  return (
    <Sheet open={open} onClose={onClose} label="Log a dish">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={mode} initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -18 }} transition={softSpring}>
          {mode === 'menu' && (
            <>
              <h3>Log a dish</h3>
              <div className="add-menu">
                {OPTIONS.map((o) => (
                  <button
                    key={o.mode}
                    className="add-opt"
                    onClick={() => {
                      tap()
                      if (o.mode === 'write') {
                        onClose()
                        go('/new')
                      } else setMode(o.mode)
                    }}
                  >
                    <span className="add-ic">
                      <Icon name={o.icon} size={20} />
                    </span>
                    <span className="add-txt">
                      <b>{o.title}</b>
                      <span>{o.sub}</span>
                    </span>
                    <Icon name="chevron" size={18} className="faint" />
                  </button>
                ))}
              </div>
              <p className="faint" style={{ fontSize: 13, marginTop: 14 }}>
                Imports are read by open-source models running in your private recipes repo on GitHub, and nothing goes to an outside AI. You always review before saving.
              </p>
            </>
          )}

          {mode === 'url' && (
            <>
              <div className="add-head">
                {back}
                <h3>From a link</h3>
              </div>
              <p>Paste a link to any recipe page.</p>
              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                <input className="input" type="url" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" autoCapitalize="off" autoCorrect="off" spellCheck={false} onKeyDown={(e) => e.key === 'Enter' && url.trim() && void run(() => importLink(url))} />
                <button className="btn btn-ghost" style={{ height: 52, flex: 'none' }} onClick={() => void paste(setUrl)}>
                  Paste
                </button>
              </div>
              {err && <div className="err">{err}</div>}
              <div className="sheet-actions">
                <button className="btn btn-primary btn-block" disabled={!url.trim() || busy} onClick={() => void run(() => importLink(url))}>
                  {busy ? 'Sending…' : 'Import'}
                </button>
              </div>
            </>
          )}

          {mode === 'text' && (
            <>
              <div className="add-head">
                {back}
                <h3>Paste a recipe</h3>
              </div>
              <p>Paste the whole thing: title, ingredients and method.</p>
              <textarea className="text-area" style={{ marginTop: 14, minHeight: 170 }} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste the recipe here" />
              <button className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => void paste(setText)}>
                <Icon name="copy" size={16} /> Paste from clipboard
              </button>
              {err && <div className="err">{err}</div>}
              <div className="sheet-actions">
                <button className="btn btn-primary btn-block" disabled={text.trim().length < 20 || busy} onClick={() => void run(() => importText(text))}>
                  {busy ? 'Reading…' : 'Import'}
                </button>
              </div>
            </>
          )}

          {mode === 'photo' && (
            <>
              <div className="add-head">
                {back}
                <h3>Cookbook page</h3>
              </div>
              <p>Shoot the page straight on, in good light. Add a second page if the recipe runs over.</p>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(e) => {
                  const picked = Array.from(e.target.files ?? [])
                  setFiles((f) => [...f, ...picked].slice(0, 4))
                  e.target.value = ''
                }}
              />
              <PageThumbs files={files} onRemove={(i) => setFiles(files.filter((_, j) => j !== i))} onAdd={() => fileRef.current?.click()} />
              {err && <div className="err">{err}</div>}
              <div className="sheet-actions">
                <button className="btn btn-primary btn-block" disabled={!files.length || busy} onClick={() => void run(() => importPhotos(files))}>
                  {busy ? 'Uploading…' : files.length > 1 ? `Import ${files.length} pages` : 'Import'}
                </button>
              </div>
            </>
          )}

          {mode === 'working' && item && (
            <div className="working">
              {item.status === 'error' ? (
                <>
                  <span className="working-ic bad">
                    <Icon name="close" size={22} stroke={2.4} />
                  </span>
                  <h3>Couldn’t import that</h3>
                  <p>{item.error}</p>
                  <div className="sheet-actions">
                    <button className="btn btn-primary btn-block" onClick={() => { setMode(item.kind === 'url' ? 'text' : item.kind); setJob(null) }}>
                      {item.kind === 'url' ? 'Paste the text instead' : 'Try again'}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <span className="working-ic">
                    <span className="working-ring" />
                    <Icon name={item.kind === 'photo' ? 'camera' : item.kind === 'url' ? 'link' : 'copy'} size={22} />
                  </span>
                  <h3>Reading your recipe…</h3>
                  <p>{EXPECT[item.kind]} It’ll be waiting at the top of the dex if you’d rather not wait.</p>
                  <Elapsed since={item.at} />
                  <div className="sheet-actions">
                    <button className="btn btn-ghost btn-block" onClick={onClose}>
                      Keep browsing
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </Sheet>
  )
}

function PageThumbs({ files, onRemove, onAdd }: { files: File[]; onRemove: (i: number) => void; onAdd: () => void }) {
  const urls = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files])
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls])
  return (
    <div className="page-thumbs">
      {urls.map((u, i) => (
        <div key={u} className="page-thumb">
          <img src={u} alt={`Page ${i + 1}`} />
          <button aria-label={`Remove page ${i + 1}`} onClick={() => onRemove(i)}>
            <Icon name="close" size={14} stroke={2.6} />
          </button>
        </div>
      ))}
      {files.length < 4 && (
        <button className="page-add" onClick={onAdd}>
          <Icon name="camera" size={22} />
          <span>{files.length ? 'Add page' : 'Take or choose a photo'}</span>
        </button>
      )}
    </div>
  )
}

export function Elapsed({ since, prefix = '' }: { since: number; prefix?: string }) {
  const [, force] = useState(0)
  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [])
  const s = Math.max(0, Math.floor((Date.now() - since) / 1000))
  return (
    <span className="elapsed">
      {prefix}
      {Math.floor(s / 60)}:{String(s % 60).padStart(2, '0')}
    </span>
  )
}
