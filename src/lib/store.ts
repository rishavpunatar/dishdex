import { create } from 'zustand'
import { blobToB64, fromB64Url, toB64Url } from './b64'
import { db, prefs, type SyncMeta } from './local'
import {
  applyRecipeOp,
  newOpId,
  newPhotoPath,
  newRecipeId,
  normalizeRecipe,
  opTouches,
  recipeIdFromPath,
  recipePath,
  type Op,
  type RecipeOp,
} from './ops'
import { isAuthError, isConflict, jsonToB64, makeRemote, RemoteError, type Remote } from './remote'
import { clearStashedInvite, readStashedInvite, stashInvite } from './handoff'
import { isIOS, isStandalone } from './device'
import type { Connection, Person, PersonId, Profiles, Recipe } from './types'
import type { Tier } from './tiers'

export type Phase = 'boot' | 'welcome' | 'setup' | 'whoami' | 'ready'
export type SyncState = 'idle' | 'syncing' | 'synced' | 'offline' | 'error' | 'auth'

export interface Toast {
  id: number
  text: string
}

interface AppState {
  phase: Phase
  conn: Connection | null
  me: PersonId | null
  profiles: Profiles | null
  recipes: Record<string, Recipe>
  sync: { state: SyncState; pending: number; message?: string; at?: number }
  seen: Record<string, string>
  toasts: Toast[]
  joining: boolean
  /** An invite we found but couldn't use yet (e.g. offline on first launch). */
  pendingInvite: string | null
  /** Highest milestone medal collected on this phone. */
  collected: number
  /** A medal someone asked to collect from the medal sheet. */
  celebrate: Tier | null
}

export const useApp = create<AppState>(() => ({
  phase: 'boot',
  conn: null,
  me: null,
  profiles: null,
  recipes: {},
  sync: { state: 'idle', pending: 0 },
  seen: {},
  toasts: [],
  joining: false,
  pendingInvite: null,
  collected: prefs.collected(),
  celebrate: null,
}))

const S = () => useApp.getState()
const setS = useApp.setState

let remote: Remote | null = null
let meta: SyncMeta = { head: null, shas: {} }
let outbox: Op[] = []

export const getRemote = () => remote

/* ---------------------------------------------------------------- toasts */

let toastSeq = 0
export function toast(text: string) {
  const id = ++toastSeq
  setS((s) => ({ toasts: [...s.toasts, { id, text }] }))
  setTimeout(() => setS((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 2600)
}

/* ---------------------------------------------------------------- phases */

function decidePhase() {
  const { conn, profiles, me } = S()
  let phase: Phase
  if (!conn) phase = 'welcome'
  else if (!profiles) phase = 'setup'
  else if (!me || !profiles.people.some((p) => p.id === me)) phase = 'whoami'
  else phase = 'ready'
  setS({ phase })
}

let booted = false
export async function boot() {
  if (booted) return
  booted = true
  const conn = prefs.connection()
  if (!conn) {
    // iPhone: the Home Screen app starts with empty storage, so pick up the
    // invite Safari left behind (cookies are copied when the app is added).
    // (In iPhone Safari itself we leave it for the installed app and show the install guide.)
    const code = isIOS() && !isStandalone() ? null : await readStashedInvite()
    const inv = code ? parseInvite(code) : null
    if (inv) {
      setS({ phase: 'boot', joining: true })
      try {
        await joinWithInvite(inv)
        await clearStashedInvite()
        return
      } catch (e) {
        console.warn('[handoff]', e)
        setS({ pendingInvite: code })
      } finally {
        setS({ joining: false })
      }
    }
    return setS({ phase: 'welcome' })
  }
  remote = makeRemote(conn)
  const [recipes, profiles, m, ob] = await Promise.all([db.allRecipes(), db.profiles(), db.meta(), db.outbox()])
  meta = m
  outbox = ob
  setS({
    conn,
    me: prefs.me(),
    profiles: profiles ?? null,
    recipes: Object.fromEntries(recipes.map((r) => [r.id, r])),
    seen: prefs.seen(),
    sync: { state: 'idle', pending: outbox.length },
  })
  startAutoSync()
  keepHandoffFresh()
  if (profiles) {
    decidePhase()
    void syncNow()
  } else {
    // Haven't fetched the household yet; stay on the splash until we know.
    await syncNow()
    if (S().profiles || S().sync.state === 'synced') decidePhase()
  }
}

/* ---------------------------------------------------------------- connect / invites */

export function parseRepo(input: string): string | null {
  const s = input.trim().replace(/\.git$/, '').replace(/\/+$/, '')
  const m = /(?:github\.com\/)?([\w.-]+)\/([\w.-]+)$/.exec(s)
  return m ? `${m[1]}/${m[2]}` : null
}

export function describeError(e: unknown): string {
  if (e instanceof RemoteError) {
    if (e.status === 401) return 'GitHub didn’t accept that access key. Check it was copied in full.'
    if (e.status === 403)
      return e.rateLimited
        ? 'GitHub is rate-limiting for a moment. Try again in a minute.'
        : 'That key can’t write to the repo. On GitHub, make sure the repo is selected and Contents is set to “Read and write”.'
    if (e.status === 404) return 'Couldn’t find that repo. Check the name, and that the key has access to it.'
    return e.message
  }
  if (e instanceof TypeError) return 'Couldn’t reach GitHub. Check your connection.'
  return e instanceof Error ? e.message : String(e)
}

export async function connect(repoInput: string, token: string, opts: { me?: PersonId } = {}) {
  const repo = parseRepo(repoInput)
  if (!repo) throw new Error('Repo should look like owner/name.')
  const draft: Connection = { repo, token: token.trim(), branch: 'main' }
  const info = await makeRemote(draft).verify()
  const conn: Connection = { ...draft, repo: info.fullName, branch: info.branch }

  connecting = true
  try {
    await db.wipe()
    meta = { head: null, shas: {} }
    outbox = []
    remote = makeRemote(conn)
    setS({ conn, me: opts.me ?? null, recipes: {}, profiles: null, seen: {} })
    await pull()
  } finally {
    connecting = false
  }
  prefs.setConnection(conn)
  if (opts.me) prefs.setMe(opts.me)
  markAllSeen()
  setS({ sync: { state: 'synced', pending: 0, at: Date.now() } })
  startAutoSync()
  decidePhase()
  keepHandoffFresh()
  return info
}

let connecting = false

/** In iPhone Safari, keep a short-lived invite in a cookie so "Add to Home Screen" opens already signed in. */
function keepHandoffFresh() {
  const { me, conn } = S()
  if (conn && me && isIOS() && !isStandalone()) void stashInvite(makeInvite(me))
}

/** Accepts a new invite (from the other phone) or a fresh access key. */
export async function reconnect(text: string) {
  const inv = parseInvite(text)
  if (inv) {
    const cur = S().conn
    if (cur && inv.r.toLowerCase() === cur.repo.toLowerCase()) return updateToken(inv.t)
    return joinWithInvite(inv)
  }
  const t = text.trim()
  if (!/^(github_pat_|ghp_|gho_)[A-Za-z0-9_]+$/.test(t)) throw new Error('Paste an invite link or a GitHub access key.')
  return updateToken(t)
}

/** Swap in a fresh access key without dropping anything waiting to sync. */
export async function updateToken(token: string) {
  const conn = S().conn
  if (!conn) return
  const next = { ...conn, token: token.trim() }
  await makeRemote(next).verify()
  remote = makeRemote(next)
  prefs.setConnection(next)
  setS({ conn: next })
  keepHandoffFresh()
  await syncNow()
}

export interface Invite {
  r: string
  t: string
  b?: string
  p?: PersonId
}

export function makeInvite(forPerson: PersonId) {
  const conn = S().conn!
  const inv: Invite = { r: conn.repo, t: conn.token, b: conn.branch, p: forPerson }
  return `DDX1.${toB64Url(JSON.stringify(inv))}`
}

export const inviteLink = (code: string) => `${location.origin}${import.meta.env.BASE_URL}#join=${code}`

export function parseInvite(text: string): Invite | null {
  const m = /DDX1\.([A-Za-z0-9_-]+)/.exec(text)
  if (!m) return null
  try {
    const o = JSON.parse(fromB64Url(m[1]))
    if (typeof o.r === 'string' && typeof o.t === 'string') return o
  } catch {
    /* not an invite */
  }
  return null
}

export async function joinWithInvite(inv: Invite) {
  return connect(inv.r, inv.t, { me: inv.p })
}

export async function disconnect() {
  await clearStashedInvite()
  await db.wipe()
  prefs.clearAll()
  remote = null
  meta = { head: null, shas: {} }
  outbox = []
  setS({ conn: null, me: null, profiles: null, recipes: {}, seen: {}, collected: 0, sync: { state: 'idle', pending: 0 } })
  decidePhase()
}

/* ---------------------------------------------------------------- profiles */

/**
 * Written straight to GitHub rather than queued: it's the first write a new key
 * makes, so a read-only key is caught here, on the setup screen, not later.
 */
export async function createProfiles(people: Person[], me: PersonId) {
  const data: Profiles = { v: 1, people }
  const r = remote!
  const cur = await r.get('profiles.json')
  meta.shas['profiles.json'] = await r.put('profiles.json', jsonToB64(data), `${people.find((p) => p.id === me)?.name ?? 'Dishdex'}: set up Dishdex`, cur?.sha)
  await Promise.all([db.setProfiles(data), db.setMeta(meta)])
  prefs.setMe(me)
  setS({ profiles: data, me })
  decidePhase()
}

export function chooseMe(id: PersonId) {
  prefs.setMe(id)
  setS({ me: id })
  decidePhase()
}

export async function updatePerson(person: Person) {
  const cur = S().profiles
  if (!cur) return
  const data: Profiles = { ...cur, people: cur.people.map((p) => (p.id === person.id ? person : p)) }
  await db.setProfiles(data)
  setS({ profiles: data })
  await enqueue([{ opId: newOpId(), kind: 'profiles', data }])
}

/* ---------------------------------------------------------------- recipes */

export interface DraftPhoto {
  blob: Blob
  w: number
  h: number
  thumb: string
}

export interface Draft {
  title: string
  servings: number
  minutes?: number
  temp?: 'hot' | 'cold'
  cuisine?: string
  types: string[]
  ingredients: string[]
  steps: string[]
  notes?: string
  knownBy: PersonId[]
  photo: 'keep' | 'remove' | DraftPhoto
}

async function applyLocal(op: RecipeOp, base: Recipe | null) {
  const next = applyRecipeOp(base, op)
  if (!next) return null
  setS((s) => ({ recipes: { ...s.recipes, [next.id]: next } }))
  await db.putRecipe(next)
  return next
}

const stamp = () => ({ updatedAt: new Date().toISOString(), updatedBy: S().me ?? '' })

export async function saveRecipe(draft: Draft, original: Recipe | null): Promise<string> {
  const id = original?.id ?? newRecipeId()
  const ops: Op[] = []
  const after: Op[] = []
  const fields: Partial<Recipe> = {
    title: draft.title.trim(),
    servings: draft.servings,
    minutes: draft.minutes,
    temp: draft.temp,
    cuisine: draft.cuisine,
    types: draft.types,
    ingredients: draft.ingredients.map((s) => s.trim()).filter(Boolean),
    steps: draft.steps.map((s) => s.trim()).filter(Boolean),
    notes: draft.notes?.trim() || undefined,
    ...stamp(),
  }
  if (typeof draft.photo === 'object') {
    const path = newPhotoPath(id)
    await db.putImage(path, draft.photo.blob)
    ops.push({ opId: newOpId(), kind: 'photo', id, path })
    fields.photo = { path, w: draft.photo.w, h: draft.photo.h }
    fields.thumb = draft.photo.thumb
    if (original?.photo) after.push({ opId: newOpId(), kind: 'deletePhoto', path: original.photo.path })
  } else if (draft.photo === 'remove') {
    fields.photo = undefined
    fields.thumb = undefined
    if (original?.photo) after.push({ opId: newOpId(), kind: 'deletePhoto', path: original.photo.path })
  }

  let op: RecipeOp
  if (!original) {
    op = {
      opId: newOpId(),
      kind: 'recipe',
      id,
      create: true,
      set: { v: 1, id, ...fields, knownBy: draft.knownBy, learning: {}, createdAt: fields.updatedAt!, createdBy: S().me ?? '' },
    }
  } else {
    // Only send what changed, so edits made on the other phone meanwhile survive the merge.
    const changed: Partial<Recipe> = {}
    for (const [k, v] of Object.entries(fields) as [keyof Recipe, unknown][]) {
      if (k === 'updatedAt' || k === 'updatedBy' || JSON.stringify(v) !== JSON.stringify(original[k])) (changed as any)[k] = v
    }
    op = {
      opId: newOpId(),
      kind: 'recipe',
      id,
      set: changed,
      knownAdd: draft.knownBy.filter((p) => !original.knownBy.includes(p)),
      knownRemove: original.knownBy.filter((p) => !draft.knownBy.includes(p)),
    }
  }
  await applyLocal(op, original)
  markSeen(id)
  await enqueue([...ops, op, ...after])
  return id
}

/** Drop a photo onto an existing dish without touching anything else. */
export async function setRecipePhoto(id: string, photo: DraftPhoto) {
  const r = S().recipes[id]
  if (!r) return
  const path = newPhotoPath(id)
  await db.putImage(path, photo.blob)
  const op: RecipeOp = { opId: newOpId(), kind: 'recipe', id, set: { photo: { path, w: photo.w, h: photo.h }, thumb: photo.thumb, ...stamp() } }
  await applyLocal(op, r)
  markSeen(id)
  const ops: Op[] = [{ opId: newOpId(), kind: 'photo', id, path }, op]
  if (r.photo) ops.push({ opId: newOpId(), kind: 'deletePhoto', path: r.photo.path })
  await enqueue(ops)
}

async function recipeOp(id: string, patch: Omit<RecipeOp, 'opId' | 'kind' | 'id'>) {
  const base = S().recipes[id]
  if (!base) return
  const op: RecipeOp = { opId: newOpId(), kind: 'recipe', id, ...patch, set: { ...patch.set, ...stamp() } }
  await applyLocal(op, base)
  markSeen(id)
  await enqueue([op])
}

export const setKnown = (id: string, pid: PersonId, knows: boolean) =>
  recipeOp(id, knows ? { knownAdd: [pid] } : { knownRemove: [pid] })


export async function deleteRecipe(id: string) {
  const r = S().recipes[id]
  if (!r) return
  setS((s) => {
    const recipes = { ...s.recipes }
    delete recipes[id]
    return { recipes }
  })
  await db.deleteRecipes([id])
  const ops: Op[] = [{ opId: newOpId(), kind: 'delete', id, title: r.title }]
  if (r.photo) ops.push({ opId: newOpId(), kind: 'deletePhoto', path: r.photo.path })
  await enqueue(ops)
}

/* ---------------------------------------------------------------- seen / new */

export function markSeen(id: string) {
  const r = S().recipes[id]
  if (!r || S().seen[id] === r.updatedAt) return
  const seen = { ...S().seen, [id]: r.updatedAt }
  prefs.setSeen(seen)
  setS({ seen })
}

export function markAllSeen() {
  const seen = Object.fromEntries(Object.values(S().recipes).map((r) => [r.id, r.updatedAt]))
  prefs.setSeen(seen)
  setS({ seen })
}

export const isNew = (r: Recipe, me: PersonId | null, seen: Record<string, string>) =>
  !!me && r.updatedBy !== me && seen[r.id] !== r.updatedAt

/* ---------------------------------------------------------------- sync engine */

async function enqueue(ops: Op[]) {
  outbox.push(...ops)
  await db.setOutbox(outbox)
  setS((s) => ({ sync: { ...s.sync, pending: outbox.length } }))
  scheduleSync(250)
}

const titleOf = (id: string) => S().recipes[id]?.title ?? 'a dish'
const meName = () => S().profiles?.people.find((p) => p.id === S().me)?.name ?? 'Dishdex'

async function execOp(op: Op) {
  const r = remote!
  switch (op.kind) {
    case 'photo': {
      const blob = await db.getImage(op.path)
      if (!blob) return
      try {
        meta.shas[op.path] = await r.put(op.path, await blobToB64(blob), `${meName()}: photo for ${titleOf(op.id)}`)
      } catch (e) {
        // A retry after a dropped response: the upload already landed.
        if (!isConflict(e)) throw e
        const cur = await r.get(op.path)
        if (!cur) throw e
        meta.shas[op.path] = cur.sha
      }
      return
    }
    case 'recipe': {
      const path = recipePath(op.id)
      for (let attempt = 0; ; attempt++) {
        const cur = await r.get(path)
        const base = cur ? normalizeRecipe(JSON.parse(cur.text)) : null
        const next = applyRecipeOp(base, op)
        if (!next) {
          // Deleted on the other phone while we were editing it.
          await dropLocal(op.id)
          return
        }
        const verb = !cur ? 'add' : 'update'
        try {
          meta.shas[path] = await r.put(path, jsonToB64(next), `${meName()}: ${verb} ${next.title}`, cur?.sha)
        } catch (e) {
          if (isConflict(e) && attempt < 3) continue
          throw e
        }
        // Adopt the merged copy unless more local edits to this dish are still queued.
        if (!outbox.slice(1).some((o) => opTouches(o, op.id))) {
          setS((s) => ({ recipes: { ...s.recipes, [next.id]: next } }))
          await db.putRecipe(next)
          if (S().seen[next.id] && next.updatedBy === S().me) markSeen(next.id)
        }
        return
      }
    }
    case 'delete': {
      const path = recipePath(op.id)
      for (let attempt = 0; ; attempt++) {
        const cur = await r.get(path)
        if (!cur) break
        try {
          await r.remove(path, cur.sha, `${meName()}: remove ${op.title}`)
          break
        } catch (e) {
          if (isConflict(e) && attempt < 3) continue
          throw e
        }
      }
      delete meta.shas[path]
      return
    }
    case 'deletePhoto': {
      let sha = meta.shas[op.path]
      if (!sha) sha = (await r.get(op.path))?.sha ?? ''
      if (sha) {
        try {
          await r.remove(op.path, sha, `${meName()}: tidy old photo`)
        } catch (e) {
          if (!isConflict(e)) throw e
        }
      }
      delete meta.shas[op.path]
      void db.deleteImage(op.path)
      return
    }
    case 'profiles': {
      const path = 'profiles.json'
      for (let attempt = 0; ; attempt++) {
        const cur = await r.get(path)
        try {
          meta.shas[path] = await r.put(path, jsonToB64(op.data), `${meName()}: update profiles`, cur?.sha)
          return
        } catch (e) {
          if (isConflict(e) && attempt < 3) continue
          throw e
        }
      }
    }
  }
}

async function dropLocal(id: string) {
  setS((s) => {
    const recipes = { ...s.recipes }
    delete recipes[id]
    return { recipes }
  })
  await db.deleteRecipes([id])
}

async function flush() {
  while (outbox.length) {
    const op = outbox[0]
    try {
      await execOp(op)
    } catch (e) {
      if (e instanceof RemoteError && !isAuthError(e) && e.status < 500 && e.status !== 429) {
        // A change GitHub keeps rejecting shouldn't jam everything behind it.
        op.tries = (op.tries ?? 0) + 1
        if (op.tries < 3) {
          await db.setOutbox(outbox)
          throw e
        }
        toast('One change couldn’t be saved and was skipped')
        meta.head = null // re-check everything against GitHub on the next pull
      } else throw e
    }
    outbox.shift()
    await Promise.all([db.setOutbox(outbox), db.setMeta(meta)])
    setS((s) => ({ sync: { ...s.sync, pending: outbox.length } }))
  }
}

async function pull() {
  const r = remote!
  const head = await r.head()
  if (head === meta.head) return
  if (!head) {
    meta.head = null
    return
  }
  const tree = await r.tree(head)
  const pendingIds = new Set(outbox.flatMap((o) => ('id' in o ? [o.id] : [])))
  const changed: Recipe[] = []
  const fetches: [string, string][] = []
  let profiles: Profiles | null = null

  for (const [path, sha] of tree) {
    if (meta.shas[path] === sha) continue
    if (path === 'profiles.json') fetches.push([path, sha])
    else {
      const id = recipeIdFromPath(path)
      if (id && !pendingIds.has(id)) fetches.push([path, sha])
      else if (path.startsWith('photos/')) meta.shas[path] = sha
    }
  }
  const texts = await r.readMany(fetches)
  for (const [path, sha] of fetches) {
    const text = texts.get(sha)
    if (text === undefined) continue
    try {
      if (path === 'profiles.json') profiles = JSON.parse(text) as Profiles
      else changed.push(normalizeRecipe(JSON.parse(text)))
      meta.shas[path] = sha
    } catch {
      console.warn('[sync] skipping unreadable file', path)
    }
  }

  const removed: string[] = []
  for (const path of Object.keys(meta.shas)) {
    if (tree.has(path)) continue
    const id = recipeIdFromPath(path)
    if (id && pendingIds.has(id)) continue
    if (id) removed.push(id)
    delete meta.shas[path]
  }

  meta.head = head
  if (changed.length) await db.putRecipes(changed)
  if (removed.length) await db.deleteRecipes(removed)
  if (profiles) await db.setProfiles(profiles)
  await db.setMeta(meta)

  if (changed.length || removed.length || profiles) {
    setS((s) => {
      const recipes = { ...s.recipes }
      for (const c of changed) recipes[c.id] = c
      for (const id of removed) delete recipes[id]
      return { recipes, ...(profiles ? { profiles } : {}) }
    })
  }
}

let running: Promise<void> | null = null
let rerun = false

export function syncNow(): Promise<void> {
  if (!remote || connecting) return Promise.resolve()
  if (running) {
    rerun = true
    return running
  }
  running = (async () => {
    do {
      rerun = false
      setS((s) => ({ sync: { ...s.sync, state: 'syncing' } }))
      try {
        await flush()
        await pull()
        setS({ sync: { state: 'synced', pending: outbox.length, at: Date.now() } })
      } catch (e) {
        const state: SyncState = isAuthError(e)
          ? 'auth'
          : e instanceof TypeError || !navigator.onLine || (e instanceof RemoteError && (e.rateLimited || e.status >= 500))
            ? 'offline'
            : 'error'
        setS((s) => ({ sync: { ...s.sync, state, message: describeError(e), pending: outbox.length } }))
        console.warn('[sync]', e)
        rerun = false
      }
    } while (rerun)
  })().finally(() => {
    running = null
  })
  return running
}

let syncTimer: ReturnType<typeof setTimeout> | undefined
function scheduleSync(ms: number) {
  clearTimeout(syncTimer)
  syncTimer = setTimeout(() => void syncNow(), ms)
}

let autoStarted = false
function startAutoSync() {
  if (autoStarted) return
  autoStarted = true
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void syncNow()
  })
  window.addEventListener('online', () => void syncNow())
  setInterval(() => {
    if (document.visibilityState === 'visible') void syncNow()
  }, 10_000)
}

/* ---------------------------------------------------------------- backup */

export function exportBackup() {
  const { recipes, profiles } = S()
  const data = { exportedAt: new Date().toISOString(), profiles, recipes: Object.values(recipes) }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `dishdex-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 5000)
}

export async function retryBoot() {
  await syncNow()
  if (S().profiles || S().sync.state === 'synced') decidePhase()
}
