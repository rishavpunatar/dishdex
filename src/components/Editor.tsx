import { motion } from 'motion/react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { tap } from '../lib/device'
import { processPhoto } from '../lib/image'
import { usePhoto } from '../lib/photos'
import { back, home, replace } from '../lib/router'
import { deleteRecipe, saveRecipe, toast, useApp, type DraftPhoto } from '../lib/store'
import { finishImport } from '../lib/importer'
import { CUISINES, DISH_TYPES } from '../lib/types'
import { Avatar, cssVar, fmtMinutes, Sheet, Stepper, usePeople } from './bits'
import { Icon } from './Icon'

export function Editor({ id, importId }: { id?: string; importId?: string }) {
  const original = useApp((s) => (id ? s.recipes[id] : undefined)) ?? null
  // An import fills the form in; nothing is saved until Save.
  const imported = useApp((s) => (importId ? s.imports.find((i) => i.id === importId) : undefined))
  const seed = original ? undefined : imported?.recipe
  const { people, me } = usePeople()
  const [title, setTitle] = useState(original?.title ?? seed?.title ?? '')
  const [servings, setServings] = useState(original?.servings ?? (seed?.servings || 2))
  const [minutes, setMinutes] = useState<number | undefined>(original?.minutes ?? (seed?.minutes || undefined))
  const [temp, setTemp] = useState<'hot' | 'cold' | undefined>(original?.temp ?? (seed?.temp || undefined))
  const [cuisine, setCuisine] = useState<string | undefined>(original?.cuisine ?? (seed?.cuisine || undefined))
  const [types, setTypes] = useState<string[]>(original?.types ?? seed?.types?.slice(0, 2) ?? [])
  const [ingredients, setIngredients] = useState<string[]>(original?.ingredients.length ? original.ingredients : seed?.ingredients.length ? seed.ingredients : [''])
  const [steps, setSteps] = useState<string[]>(original?.steps.length ? original.steps : seed?.steps.length ? seed.steps : [''])
  const [notes, setNotes] = useState(original?.notes ?? seed?.notes ?? '')
  const [knownBy, setKnownBy] = useState<string[]>(original?.knownBy ?? (me ? [me] : []))
  const [photo, setPhoto] = useState<'keep' | 'remove' | DraftPhoto>('keep')
  const [busy, setBusy] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [confirm, setConfirm] = useState<null | 'discard' | 'delete'>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const titleRef = useRef<HTMLTextAreaElement>(null)

  const existingFull = usePhoto(photo === 'keep' ? original?.photo?.path : undefined)
  const newUrl = useMemo(() => (typeof photo === 'object' ? URL.createObjectURL(photo.blob) : null), [photo])
  useEffect(() => () => void (newUrl && URL.revokeObjectURL(newUrl)), [newUrl])
  const preview = newUrl ?? (photo === 'keep' ? existingFull ?? original?.thumb ?? null : null)

  useLayoutEffect(() => autosize(titleRef.current), [title])
  useEffect(() => {
    if (!original) setTimeout(() => titleRef.current?.focus({ preventScroll: true }), 420)
  }, [])

  const dirty =
    photo !== 'keep' ||
    title !== (original?.title ?? '') ||
    servings !== (original?.servings ?? 2) ||
    minutes !== original?.minutes ||
    temp !== original?.temp ||
    cuisine !== original?.cuisine ||
    types.join() !== (original?.types ?? []).join() ||
    ingredients.filter(Boolean).join('\n') !== (original?.ingredients ?? []).join('\n') ||
    steps.filter(Boolean).join('\n') !== (original?.steps ?? []).join('\n') ||
    notes !== (original?.notes ?? '') ||
    [...knownBy].sort().join() !== [...(original?.knownBy ?? (me ? [me] : []))].sort().join()

  const canSave = title.trim().length > 0 && !busy && !processing

  const pick = async (file?: File) => {
    if (!file) return
    setProcessing(true)
    try {
      setPhoto(await processPhoto(file))
    } catch (e) {
      toast((e as Error).message)
    } finally {
      setProcessing(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const save = async () => {
    if (!canSave) return
    tap(16)
    setBusy(true)
    try {
      const newId = await saveRecipe(
        { title, servings, minutes, temp, cuisine, types, ingredients, steps, notes, knownBy, photo },
        original,
      )
      if (original) {
        toast('Saved')
        back()
      } else {
        if (importId) void finishImport(importId)
        toast('Logged to the dex ✨')
        replace(`/r/${newId}/fresh`)
      }
    } catch (e) {
      toast((e as Error).message)
      setBusy(false)
    }
  }

  const cancel = () => (dirty ? setConfirm('discard') : back())

  return (
    <>
      <motion.div
        className="screen"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 380, damping: 40 }}
        style={{ boxShadow: '0 -10px 40px rgba(0,0,0,.15)' }}
      >
        <div className="ed-bar">
          <button className="btn btn-ghost btn-sm" onClick={cancel}>
            Cancel
          </button>
          <h2>{original ? 'Edit dish' : seed ? 'Review import' : 'New dish'}</h2>
          <button className="btn btn-primary btn-sm" disabled={!canSave} onClick={() => void save()}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>

        <div className="ed-body">
          {seed && (
            <div className="import-note">
              <Icon name="sparkle" size={16} />
              <span>
                {imported?.kind === 'photo'
                  ? 'Read from your cookbook photo. Check the quantities, then add a photo of your own when you cook it.'
                  : imported?.kind === 'url'
                    ? `Imported from ${imported.label}. Give it a once-over, then save.`
                    : 'Filled in from your pasted text. Give it a once-over, then save.'}
              </span>
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => void pick(e.target.files?.[0])} />
          <div className={`photo-tile${preview ? '' : ' empty-tile'}`}>
            <button type="button" className="photo-hit" onClick={() => fileRef.current?.click()} aria-label={preview ? 'Change photo' : 'Add a photo'}>
              {preview ? (
                <img src={preview} alt="" />
              ) : (
                <span className="photo-cta">
                  <span className="ic">
                    <Icon name="camera" size={28} />
                  </span>
                  {processing ? 'Preparing photo…' : 'Add a photo of the finished dish'}
                  <span className="faint" style={{ fontWeight: 500, fontSize: 13.5 }}>
                    Take one now or pick from your library
                  </span>
                </span>
              )}
            </button>
            {preview && (
              <div className="photo-actions">
                <button type="button" className="icon-btn glass" aria-label="Change photo" onClick={() => fileRef.current?.click()}>
                  <Icon name="camera" size={18} />
                </button>
                <button type="button" className="icon-btn glass" aria-label="Remove photo" onClick={() => { tap(); setPhoto(original?.photo ? 'remove' : 'keep') }}>
                  <Icon name="trash" size={18} />
                </button>
              </div>
            )}
            {processing && preview && <span className="photo-busy">Preparing photo…</span>}
          </div>

          <textarea
            ref={titleRef}
            className="title-input"
            rows={1}
            value={title}
            onChange={(e) => setTitle(e.target.value.replace(/\n/g, ''))}
            placeholder="Dish name"
            aria-label="Dish name"
            enterKeyHint="next"
            maxLength={80}
          />

          <span className="field-label">Who can cook it</span>
          <div className="who-grid">
            {people.map((p) => {
              const on = knownBy.includes(p.id)
              return (
                <button key={p.id} type="button" className="who-btn" aria-pressed={on} style={cssVar({ '--c': p.color })} onClick={() => { tap(); setKnownBy(on ? knownBy.filter((x) => x !== p.id) : [...knownBy, p.id]) }}>
                  <Avatar person={p} size={34} />
                  <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
                  <span className="know-tick">
                    <Icon name="check" size={13} stroke={3} />
                  </span>
                </button>
              )
            })}
          </div>

          <div className="pair" style={{ marginTop: 12 }}>
            <div className="num-card">
              <div>
                <div className="stat-label">Serves</div>
              </div>
              <Stepper value={servings} onChange={setServings} />
            </div>
            <div className="num-card">
              <div>
                <div className="stat-label">Time</div>
              </div>
              <Stepper value={minutes ?? 0} min={0} max={600} step={minutes && minutes >= 60 ? 15 : 5} onChange={(n) => setMinutes(n || undefined)} format={(n) => fmtMinutes(n || undefined)} />
            </div>
          </div>

          <span className="field-label">Served</span>
          <div className="temp-seg" role="group" aria-label="Served hot or cold">
            {(['hot', 'cold'] as const).map((t) => (
              <button key={t} type="button" className="temp-btn" data-t={t} aria-pressed={temp === t} onClick={() => { tap(); setTemp(temp === t ? undefined : t) }}>
                <Icon name={t === 'hot' ? 'flame' : 'snow'} size={19} stroke={2.1} />
                {t === 'hot' ? 'Hot' : 'Cold'}
              </button>
            ))}
          </div>

          <span className="field-label">Ingredients</span>
          <ListEditor items={ingredients} onChange={setIngredients} placeholder="e.g. 200g basmati rice" addLabel="Add ingredient" />
          <div className="hint">Start lines with amounts (“2 cups…”) and they’ll scale with servings. Pasting a list splits it into lines.</div>

          <span className="field-label">The rough how-to</span>
          <ListEditor items={steps} onChange={setSteps} placeholder="What happens next…" addLabel="Add step" numbered />

          <span className="field-label">Cuisine</span>
          <div className="type-grid">
            {CUISINES.map((c) => (
              <button key={c.id} type="button" className="type-chip" aria-pressed={cuisine === c.id} style={cssVar({ '--c': c.color })} onClick={() => { tap(); setCuisine(cuisine === c.id ? undefined : c.id) }}>
                {c.label}
              </button>
            ))}
          </div>

          <span className="field-label">Type <span className="faint" style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 500 }}>· up to two</span></span>
          <div className="type-grid">
            {DISH_TYPES.map((t) => {
              const on = types.includes(t.id)
              return (
                <button
                  key={t.id}
                  type="button"
                  className="type-chip"
                  aria-pressed={on}
                  style={cssVar({ '--c': t.color })}
                  onClick={() => {
                    tap()
                    setTypes(on ? types.filter((x) => x !== t.id) : [...types, t.id].slice(-2))
                  }}
                >
                  {t.label}
                </button>
              )
            })}
          </div>

          <span className="field-label">Notes</span>
          <textarea className="text-area" value={notes} onChange={(e) => { setNotes(e.target.value); autosize(e.currentTarget) }} placeholder="Tips, swaps, where it’s from…" />

          {original && (
            <button type="button" className="btn btn-ghost btn-block danger" style={{ marginTop: 32 }} onClick={() => setConfirm('delete')}>
              <Icon name="trash" size={18} /> Remove from dex
            </button>
          )}
        </div>
      </motion.div>

      <Sheet open={confirm === 'discard'} onClose={() => setConfirm(null)} label="Discard changes">
        <h3>{seed ? 'Leave this import?' : 'Discard changes?'}</h3>
        <p>{seed ? 'Keep it for later and it stays at the top of the dex, ready to review.' : 'What you’ve typed won’t be saved.'}</p>
        <div className="sheet-actions">
          {seed && importId && (
            <button className="btn btn-primary btn-block" onClick={() => { setConfirm(null); back() }}>
              Keep for later
            </button>
          )}
          <button
            className={`btn btn-block ${seed ? 'btn-ghost danger' : 'btn-primary'}`}
            onClick={() => {
              setConfirm(null)
              if (importId) void finishImport(importId)
              back()
            }}
          >
            {seed ? 'Discard import' : 'Discard'}
          </button>
          <button className="btn btn-ghost btn-block" onClick={() => setConfirm(null)}>
            Keep editing
          </button>
        </div>
      </Sheet>

      <Sheet open={confirm === 'delete'} onClose={() => setConfirm(null)} label="Remove dish">
        <h3>Remove “{original?.title}”?</h3>
        <p>It disappears from both phones. (It stays in the repo’s history if you ever need it back.)</p>
        <div className="sheet-actions">
          <button
            className="btn btn-primary btn-block"
            onClick={() => {
              setConfirm(null)
              if (original) void deleteRecipe(original.id)
              toast('Removed')
              home()
            }}
          >
            Remove
          </button>
          <button className="btn btn-ghost btn-block" onClick={() => setConfirm(null)}>
            Keep it
          </button>
        </div>
      </Sheet>
    </>
  )
}

function autosize(el: HTMLTextAreaElement | null) {
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

const BULLET = /^\s*(?:[-*•·–]|\d+[.)]|step\s*\d+[:.)]?)\s*/i

function ListEditor({ items, onChange, placeholder, addLabel, numbered }: { items: string[]; onChange: (v: string[]) => void; placeholder: string; addLabel: string; numbered?: boolean }) {
  const refs = useRef<(HTMLTextAreaElement | null)[]>([])
  const focusNext = useRef<{ i: number; end?: boolean } | null>(null)

  useLayoutEffect(() => {
    refs.current.forEach(autosize)
    const f = focusNext.current
    if (f) {
      const el = refs.current[f.i]
      if (el) {
        el.focus()
        const pos = f.end ? el.value.length : 0
        el.setSelectionRange(pos, pos)
      }
      focusNext.current = null
    }
  })

  const set = (i: number, v: string) => onChange(items.map((x, j) => (j === i ? v : x)))

  return (
    <div className="list-ed">
      {items.map((v, i) => (
        <div className="list-item" key={i}>
          <span className={`list-marker${numbered ? '' : ' bullet'}`}>{numbered ? i + 1 : ''}</span>
          <textarea
            ref={(el) => {
              refs.current[i] = el
            }}
            rows={1}
            value={v}
            placeholder={i === 0 ? placeholder : numbered ? 'Then…' : 'Another ingredient'}
            enterKeyHint="next"
            onChange={(e) => set(i, e.target.value.replace(/\n/g, ' '))}
            onKeyDown={(e) => {
              const el = e.currentTarget
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                e.preventDefault()
                const at = el.selectionStart ?? v.length
                const next = [...items]
                next.splice(i, 1, v.slice(0, at).trimEnd(), v.slice(at).trimStart())
                focusNext.current = { i: i + 1 }
                onChange(next)
              } else if (e.key === 'Backspace' && el.selectionStart === 0 && el.selectionEnd === 0 && i > 0) {
                e.preventDefault()
                const next = [...items]
                const prev = next[i - 1]
                next.splice(i - 1, 2, prev + (prev && v ? ' ' : '') + v)
                focusNext.current = { i: i - 1, end: true }
                onChange(next)
              }
            }}
            onPaste={(e) => {
              const text = e.clipboardData.getData('text')
              if (!text.includes('\n')) return
              e.preventDefault()
              const lines = text.split(/\r?\n/).map((l) => l.replace(BULLET, '').trim()).filter(Boolean)
              if (!lines.length) return
              const next = v ? [...items.slice(0, i + 1), ...lines, ...items.slice(i + 1)] : [...items.slice(0, i), ...lines, ...items.slice(i + 1)]
              focusNext.current = { i: v ? i + lines.length : i + lines.length - 1, end: true }
              onChange(next)
            }}
          />
          {(items.length > 1 || v) && (
            <button
              type="button"
              className="list-x"
              aria-label="Remove line"
              onClick={() => {
                tap()
                const next = items.filter((_, j) => j !== i)
                onChange(next.length ? next : [''])
              }}
            >
              <Icon name="close" size={16} />
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        className="list-add"
        onClick={() => {
          tap()
          focusNext.current = { i: items.length }
          onChange([...items, ''])
        }}
      >
        <Icon name="plus" size={18} stroke={2.4} /> {addLabel}
      </button>
    </div>
  )
}
