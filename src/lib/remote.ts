import { b64ToBytes, b64ToText, textToB64 } from './b64'
import type { Connection } from './types'

/**
 * The shared "cloud" is a private GitHub repo. Each recipe is its own JSON file
 * (recipes/<id>.json) and each photo its own JPEG (photos/...), so the two phones
 * only ever conflict when they edit the *same* dish at the same moment, and even
 * then the sync engine merges field-by-field.
 */
export interface Remote {
  verify(): Promise<{ branch: string; fullName: string; isPrivate: boolean }>
  /** Commit sha at the branch tip, or null for an empty repo. */
  head(): Promise<string | null>
  /** path -> blob sha for every file at that commit. */
  tree(commit: string): Promise<Map<string, string>>
  readText(path: string, sha: string): Promise<string>
  readBinary(path: string): Promise<Blob>
  get(path: string): Promise<{ sha: string; text: string } | null>
  /** Create or replace a file; returns the new blob sha. */
  put(path: string, base64: string, message: string, sha?: string): Promise<string>
  remove(path: string, sha: string, message: string): Promise<void>
}

export class RemoteError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export const isAuthError = (e: unknown) => e instanceof RemoteError && (e.status === 401 || e.status === 403)
export const isConflict = (e: unknown) => e instanceof RemoteError && (e.status === 409 || e.status === 422)
export const isNetworkError = (e: unknown) => !(e instanceof RemoteError)

const encodePath = (p: string) => p.split('/').map(encodeURIComponent).join('/')

export class GitHubRemote implements Remote {
  private repo: string
  private token: string
  private branch: string

  constructor(conn: Connection) {
    this.repo = conn.repo
    this.token = conn.token
    this.branch = conn.branch || 'main'
  }

  private async req(path: string, init: RequestInit = {}, accept = 'application/vnd.github+json') {
    const headers: Record<string, string> = { Accept: accept, Authorization: `Bearer ${this.token}` }
    if (init.body) headers['Content-Type'] = 'application/json'
    const res = await fetch(`https://api.github.com${path}`, { ...init, headers, cache: 'no-store' })
    if (!res.ok) {
      let msg = res.statusText
      try {
        msg = (await res.json()).message || msg
      } catch {
        /* non-JSON error body */
      }
      throw new RemoteError(msg || `GitHub error ${res.status}`, res.status)
    }
    return res
  }

  async verify() {
    const r = await (await this.req(`/repos/${this.repo}`)).json()
    this.branch = r.default_branch || 'main'
    return { branch: this.branch, fullName: r.full_name as string, isPrivate: !!r.private }
  }

  async head() {
    try {
      const r = await (await this.req(`/repos/${this.repo}/git/ref/heads/${encodeURIComponent(this.branch)}`)).json()
      return r.object.sha as string
    } catch (e) {
      // 409 = "Git Repository is empty", 404 = branch not created yet
      if (e instanceof RemoteError && (e.status === 404 || e.status === 409)) return null
      throw e
    }
  }

  async tree(commit: string) {
    const r = await (await this.req(`/repos/${this.repo}/git/trees/${commit}?recursive=1`)).json()
    const out = new Map<string, string>()
    for (const e of r.tree as { path: string; sha: string; type: string }[]) {
      if (e.type === 'blob') out.set(e.path, e.sha)
    }
    return out
  }

  async readText(_path: string, sha: string) {
    const r = await (await this.req(`/repos/${this.repo}/git/blobs/${sha}`)).json()
    return b64ToText(r.content)
  }

  async readBinary(path: string) {
    const res = await this.req(
      `/repos/${this.repo}/contents/${encodePath(path)}?ref=${encodeURIComponent(this.branch)}`,
      {},
      'application/vnd.github.raw',
    )
    const buf = await res.arrayBuffer()
    return new Blob([buf], { type: path.endsWith('.png') ? 'image/png' : 'image/jpeg' })
  }

  async get(path: string) {
    try {
      const r = await (
        await this.req(`/repos/${this.repo}/contents/${encodePath(path)}?ref=${encodeURIComponent(this.branch)}`)
      ).json()
      return { sha: r.sha as string, text: b64ToText(r.content) }
    } catch (e) {
      if (e instanceof RemoteError && e.status === 404) return null
      throw e
    }
  }

  async put(path: string, base64: string, message: string, sha?: string) {
    const body = JSON.stringify({ message, content: base64, branch: this.branch, ...(sha ? { sha } : {}) })
    const r = await (await this.req(`/repos/${this.repo}/contents/${encodePath(path)}`, { method: 'PUT', body })).json()
    return r.content.sha as string
  }

  async remove(path: string, sha: string, message: string) {
    try {
      const body = JSON.stringify({ message, sha, branch: this.branch })
      await this.req(`/repos/${this.repo}/contents/${encodePath(path)}`, { method: 'DELETE', body })
    } catch (e) {
      if (e instanceof RemoteError && e.status === 404) return // already gone
      throw e
    }
  }
}

/**
 * Dev-only stand-in for GitHub, kept in localStorage so two browser tabs
 * (?device=a / ?device=b) behave like two phones sharing one repo.
 */
export class MemoryRemote implements Remote {
  private key = 'dishdex-demo-remote'
  private latency: number

  constructor(latency = 120) {
    this.latency = latency
  }

  private load(): { commit: number; files: Record<string, { sha: string; b64: string }> } {
    try {
      return JSON.parse(localStorage.getItem(this.key) || '') || { commit: 0, files: {} }
    } catch {
      return { commit: 0, files: {} }
    }
  }
  private save(s: ReturnType<MemoryRemote['load']>) {
    localStorage.setItem(this.key, JSON.stringify(s))
  }
  private wait() {
    return new Promise((r) => setTimeout(r, this.latency * (0.5 + Math.random())))
  }
  private newSha() {
    return Math.random().toString(16).slice(2) + Date.now().toString(16)
  }

  async verify() {
    await this.wait()
    return { branch: 'main', fullName: 'demo/local', isPrivate: true }
  }
  async head() {
    await this.wait()
    const s = this.load()
    return s.commit ? `c${s.commit}` : null
  }
  async tree() {
    await this.wait()
    const s = this.load()
    return new Map(Object.entries(s.files).map(([p, f]) => [p, f.sha]))
  }
  async readText(path: string) {
    await this.wait()
    const f = this.load().files[path]
    if (!f) throw new RemoteError('Not Found', 404)
    return b64ToText(f.b64)
  }
  async readBinary(path: string) {
    await this.wait()
    const f = this.load().files[path]
    if (!f) throw new RemoteError('Not Found', 404)
    return new Blob([b64ToBytes(f.b64) as BlobPart], { type: 'image/jpeg' })
  }
  async get(path: string) {
    await this.wait()
    const f = this.load().files[path]
    return f ? { sha: f.sha, text: b64ToText(f.b64) } : null
  }
  async put(path: string, base64: string, _message: string, sha?: string) {
    await this.wait()
    const s = this.load()
    const cur = s.files[path]
    if (cur && cur.sha !== sha) throw new RemoteError('sha does not match', 409)
    if (!cur && sha) throw new RemoteError('Not Found', 404)
    const next = this.newSha()
    s.files[path] = { sha: next, b64: base64 }
    s.commit++
    this.save(s)
    return next
  }
  async remove(path: string, sha: string) {
    await this.wait()
    const s = this.load()
    const cur = s.files[path]
    if (!cur) return
    if (cur.sha !== sha) throw new RemoteError('sha does not match', 409)
    delete s.files[path]
    s.commit++
    this.save(s)
  }
}

export const DEMO_REPO = 'demo/local'

export function makeRemote(conn: Connection): Remote {
  if (import.meta.env.DEV && conn.repo === DEMO_REPO) return new MemoryRemote()
  return new GitHubRemote(conn)
}

export const jsonToB64 = (v: unknown) => textToB64(JSON.stringify(v, null, 2) + '\n')
