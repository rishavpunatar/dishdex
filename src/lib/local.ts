import { createStore, del, delMany, entries, get, set, setMany, clear, type UseStore } from 'idb-keyval'
import type { Connection, PersonId, Profiles, Recipe } from './types'
import type { Op } from './ops'

/**
 * Everything on the phone lives here. In dev, `?device=x` gives each tab its own
 * storage so two tabs can play the two phones.
 */
export const NS = (() => {
  if (!import.meta.env.DEV || typeof location === 'undefined') return 'main'
  return new URLSearchParams(location.search).get('device') || 'main'
})()

let stores: { recipes: UseStore; images: UseStore; meta: UseStore } | null = null
function s() {
  if (!stores) {
    stores = {
      recipes: createStore(`dishdex-${NS}-recipes`, 'kv'),
      images: createStore(`dishdex-${NS}-images`, 'kv'),
      meta: createStore(`dishdex-${NS}-meta`, 'kv'),
    }
  }
  return stores
}

export interface SyncMeta {
  head: string | null
  /** path -> blob sha we last saw / wrote */
  shas: Record<string, string>
}

export const db = {
  async allRecipes(): Promise<Recipe[]> {
    return (await entries<string, Recipe>(s().recipes)).map(([, r]) => r)
  },
  putRecipe: (r: Recipe) => set(r.id, r, s().recipes),
  putRecipes: (rs: Recipe[]) => setMany(rs.map((r) => [r.id, r]), s().recipes),
  deleteRecipes: (ids: string[]) => delMany(ids, s().recipes),

  getImage: (path: string) => get<Blob>(path, s().images),
  putImage: (path: string, blob: Blob) => set(path, blob, s().images),
  deleteImage: (path: string) => del(path, s().images),

  async meta(): Promise<SyncMeta> {
    return (await get<SyncMeta>('sync', s().meta)) || { head: null, shas: {} }
  },
  setMeta: (m: SyncMeta) => set('sync', m, s().meta),
  outbox: async () => (await get<Op[]>('outbox', s().meta)) || [],
  setOutbox: (ops: Op[]) => set('outbox', ops, s().meta),
  profiles: () => get<Profiles>('profiles', s().meta),
  setProfiles: (p: Profiles) => set('profiles', p, s().meta),

  async wipe() {
    await Promise.all([clear(s().recipes), clear(s().images), clear(s().meta)])
  },
}

const lsKey = (k: string) => `dishdex:${NS}:${k}`
function lsGet<T>(k: string): T | null {
  try {
    const v = localStorage.getItem(lsKey(k))
    return v ? (JSON.parse(v) as T) : null
  } catch {
    return null
  }
}
function lsSet(k: string, v: unknown) {
  try {
    if (v === null || v === undefined) localStorage.removeItem(lsKey(k))
    else localStorage.setItem(lsKey(k), JSON.stringify(v))
  } catch {
    /* storage full or blocked */
  }
}

export const prefs = {
  connection: () => lsGet<Connection>('conn'),
  setConnection: (c: Connection | null) => lsSet('conn', c),
  me: () => lsGet<PersonId>('me'),
  setMe: (id: PersonId | null) => lsSet('me', id),
  seen: () => lsGet<Record<string, string>>('seen') || {},
  setSeen: (m: Record<string, string>) => lsSet('seen', m),
  view: () => lsGet<'grid' | 'list'>('view') || 'grid',
  setView: (v: 'grid' | 'list') => lsSet('view', v),
  /** Highest milestone whose medal this phone has collected. */
  collected: () => lsGet<number>('collected') ?? 0,
  setCollected: (n: number) => lsSet('collected', n),
  installDismissed: () => !!lsGet<boolean>('installDismissed'),
  setInstallDismissed: () => lsSet('installDismissed', true),
  clearAll() {
    for (const k of ['conn', 'me', 'seen', 'collected']) lsSet(k, null)
  },
}
