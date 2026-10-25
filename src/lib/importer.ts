import { blobToB64, textToB64 } from './b64'
import { processForOcr } from './image'
import { prefs } from './local'
import { newOpId, newRecipeId } from './ops'
import { parseRecipeText, type ImportedRecipe } from './parse'
import { enqueueDeletes, getRemote, toast, useApp } from './store'

/**
 * Recipe import. Links, cookbook photos and hard-to-read text go to the
 * importer workflow in the private recipes repo (open-source OCR + LLM on a
 * GitHub runner); tidy pasted text is parsed right here on the phone.
 *
 *   app  -> imports/<id>/page-N.jpg, imports/<id>/request.json
 *   repo -> imports/<id>/result.json   (polled here)
 */
export type ImportKind = 'url' | 'text' | 'photo'

export interface PendingImport {
  id: string
  kind: ImportKind
  label: string
  at: number
  status: 'working' | 'ready' | 'error'
  /** Parsed on the phone: nothing to clean up in the repo. */
  local?: boolean
  pages?: number
  recipe?: ImportedRecipe
  error?: string
}

const TIMEOUT = 20 * 60_000
const dir = (id: string) => `imports/${id}`

function save(imports: PendingImport[]) {
  prefs.setImports(imports)
  useApp.setState({ imports })
}

const update = (id: string, patch: Partial<PendingImport>) =>
  save(useApp.getState().imports.map((i) => (i.id === id ? { ...i, ...patch } : i)))

function remoteOrThrow() {
  const r = getRemote()
  if (!r) throw new Error('Not connected yet.')
  if (!navigator.onLine) throw new Error('You’re offline — imports need a connection.')
  return r
}

async function send(kind: ImportKind, label: string, body: Record<string, unknown>, pages: Blob[] = []) {
  const r = remoteOrThrow()
  const id = `${newRecipeId()}`
  const names: string[] = []
  for (const [i, page] of pages.entries()) {
    const name = `page-${i + 1}.jpg`
    await r.put(`${dir(id)}/${name}`, await blobToB64(page), `Import: page ${i + 1}`)
    names.push(name)
  }
  // The request goes last: it's what starts the importer.
  const request = { v: 1, kind, ...body, ...(names.length ? { pages: names } : {}), by: useApp.getState().me, at: new Date().toISOString() }
  await r.put(`${dir(id)}/request.json`, textToB64(JSON.stringify(request, null, 2) + '\n'), `Import: ${kind}`)
  const item: PendingImport = { id, kind, label, at: Date.now(), status: 'working', pages: names.length || undefined }
  save([item, ...useApp.getState().imports])
  startPolling()
  return item
}

export async function importLink(url: string) {
  const u = url.trim()
  if (!/^https?:\/\/\S+\.\S+/.test(u)) throw new Error('That doesn’t look like a web link.')
  let host = u
  try {
    host = new URL(u).hostname.replace(/^www\./, '')
  } catch {
    /* keep raw */
  }
  return send('url', host, { url: u })
}

/** Pasted text: parse here if it's tidy enough, otherwise let the model read it. */
export async function importText(text: string): Promise<PendingImport> {
  const parsed = parseRecipeText(text)
  if (parsed) {
    const item: PendingImport = { id: `local-${newOpId()}`, kind: 'text', label: parsed.title, at: Date.now(), status: 'ready', local: true, recipe: parsed }
    save([item, ...useApp.getState().imports])
    return item
  }
  if (text.trim().length < 40) throw new Error('Paste the whole recipe — ingredients and method.')
  return send('text', 'Pasted recipe', { text: text.slice(0, 14000) })
}

export async function importPhotos(files: File[]) {
  if (!files.length) throw new Error('Add a photo first.')
  const pages = await Promise.all(files.slice(0, 4).map(processForOcr))
  return send('photo', files.length > 1 ? `${files.length} cookbook pages` : 'Cookbook page', {}, pages)
}

/** Remove an import and tidy its files out of the repo (queued, so it works offline too). */
export async function finishImport(id: string) {
  const item = useApp.getState().imports.find((i) => i.id === id)
  save(useApp.getState().imports.filter((i) => i.id !== id))
  if (!item || item.local) return
  const paths = [`${dir(id)}/request.json`, `${dir(id)}/result.json`]
  for (let i = 1; i <= (item.pages ?? 0); i++) paths.push(`${dir(id)}/page-${i}.jpg`)
  await enqueueDeletes(paths)
}

let timer: ReturnType<typeof setInterval> | undefined
let busy = false

async function poll() {
  if (busy || document.visibilityState !== 'visible') return
  const working = useApp.getState().imports.filter((i) => i.status === 'working')
  if (!working.length) {
    clearInterval(timer)
    timer = undefined
    return
  }
  const r = getRemote()
  if (!r) return
  busy = true
  try {
    for (const item of working) {
      try {
        const f = await r.get(`${dir(item.id)}/result.json`)
        if (!f) {
          if (Date.now() - item.at > TIMEOUT) update(item.id, { status: 'error', error: 'The importer didn’t answer. Check Actions is enabled on the recipes repo, then try again.' })
          continue
        }
        const res = JSON.parse(f.text)
        if (res.status === 'done' && res.recipe) {
          update(item.id, { status: 'ready', recipe: res.recipe, label: res.recipe.title || item.label })
          toast(`Ready to review: ${res.recipe.title || 'your recipe'}`)
        } else {
          update(item.id, { status: 'error', error: res.error || 'Couldn’t import that.' })
        }
      } catch {
        /* offline or mid-write; try next tick */
      }
    }
  } finally {
    busy = false
  }
}

export function startPolling() {
  if (timer) return
  timer = setInterval(() => void poll(), 4000)
  void poll()
}

export function resumeImports() {
  const imports = prefs.imports()
  useApp.setState({ imports })
  if (imports.some((i) => i.status === 'working')) startPolling()
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && useApp.getState().imports.some((i) => i.status === 'working')) startPolling()
  })
}

export const importById = (id: string) => useApp.getState().imports.find((i) => i.id === id)
