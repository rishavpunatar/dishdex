import type { LearnRequest, PersonId, Profiles, Recipe } from './types'

/**
 * Local changes are queued as ops and replayed against the *latest* remote copy,
 * so two phones editing different parts of the same dish both win.
 * Set-like fields (who knows it, who's learning it) use add/remove rather than
 * overwrite for the same reason.
 */
export type Op = { opId: string; tries?: number } & (
  | { kind: 'photo'; id: string; path: string }
  | {
      kind: 'recipe'
      id: string
      create?: boolean
      set?: Partial<Recipe>
      knownAdd?: PersonId[]
      knownRemove?: PersonId[]
      learnSet?: Record<PersonId, LearnRequest>
      learnRemove?: PersonId[]
    }
  | { kind: 'delete'; id: string; title: string }
  | { kind: 'deletePhoto'; path: string }
  | { kind: 'profiles'; data: Profiles }
)

export type RecipeOp = Extract<Op, { kind: 'recipe' }>

const arr = (x: unknown): unknown[] => (Array.isArray(x) ? x : [])
const str = (x: unknown) => (typeof x === 'string' ? x : '')
const uniq = <T,>(xs: T[]) => [...new Set(xs)]

export function normalizeRecipe(x: any): Recipe {
  const now = new Date().toISOString()
  const servings = Math.round(Number(x?.servings))
  const minutes = Math.round(Number(x?.minutes))
  const knownBy = uniq(arr(x?.knownBy).map(String))
  const learning: Recipe['learning'] = {}
  if (x?.learning && typeof x.learning === 'object') {
    for (const [pid, req] of Object.entries(x.learning as Record<string, any>)) {
      if (!knownBy.includes(pid) && req && typeof req === 'object') {
        learning[pid] = { from: str(req.from), at: str(req.at) || now, ...(req.note ? { note: str(req.note) } : {}) }
      }
    }
  }
  const photo =
    x?.photo && typeof x.photo.path === 'string'
      ? { path: x.photo.path as string, w: Number(x.photo.w) || 0, h: Number(x.photo.h) || 0 }
      : undefined
  return {
    v: 1,
    id: String(x?.id),
    title: str(x?.title).trim() || 'Untitled dish',
    servings: Number.isFinite(servings) && servings > 0 ? Math.min(servings, 99) : 2,
    minutes: Number.isFinite(minutes) && minutes > 0 ? minutes : undefined,
    types: uniq(arr(x?.types).filter((t): t is string => typeof t === 'string')).slice(0, 2),
    ingredients: arr(x?.ingredients).map(str).filter((s) => s.trim()),
    steps: arr(x?.steps).map(str).filter((s) => s.trim()),
    notes: str(x?.notes).trim() || undefined,
    knownBy,
    learning,
    photo,
    thumb: str(x?.thumb).startsWith('data:image/') ? x.thumb : undefined,
    createdAt: str(x?.createdAt) || now,
    createdBy: str(x?.createdBy),
    updatedAt: str(x?.updatedAt) || str(x?.createdAt) || now,
    updatedBy: str(x?.updatedBy) || str(x?.createdBy),
  }
}

/** Returns null when the dish no longer exists and this op can't recreate it. */
export function applyRecipeOp(base: Recipe | null, op: RecipeOp): Recipe | null {
  if (!base && !op.create) return null
  const r: any = { ...(base ?? {}), ...(op.set ?? {}) }
  let known: PersonId[] = arr(r.knownBy).map(String)
  if (op.knownAdd?.length) known = uniq([...known, ...op.knownAdd])
  if (op.knownRemove?.length) known = known.filter((p) => !op.knownRemove!.includes(p))
  r.knownBy = known
  const learning = { ...(r.learning ?? {}) }
  for (const [pid, req] of Object.entries(op.learnSet ?? {})) learning[pid] = req
  for (const pid of op.learnRemove ?? []) delete learning[pid]
  r.learning = learning
  return normalizeRecipe(r)
}

export const recipePath = (id: string) => `recipes/${id}.json`
export const recipeIdFromPath = (path: string) => /^recipes\/([^/]+)\.json$/.exec(path)?.[1] ?? null

export const opTouches = (op: Op, id: string) => 'id' in op && op.id === id

const rand = (n: number) =>
  Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => 'abcdefghijkmnpqrstuvwxyz23456789'[b % 32]).join('')
export const newRecipeId = () => `${Date.now().toString(36)}-${rand(5)}`
export const newOpId = () => rand(10)
export const newPhotoPath = (id: string) => `photos/${id}-${rand(6)}.jpg`
