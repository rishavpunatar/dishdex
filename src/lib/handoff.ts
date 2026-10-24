/**
 * iPhone Home Screen apps get their own empty storage, but Safari copies its
 * cookies across when the app is added (iOS 17.2+). Some iOS versions also share
 * CacheStorage. We leave the invite in both so the installed app can sign
 * itself in; pasting the invite remains the fallback.
 */
const COOKIE = 'ddx_handoff'
const CACHE = 'dishdex-handoff'
const KEY = `${import.meta.env.BASE_URL}__handoff`
const PATH = import.meta.env.BASE_URL

export async function stashInvite(code: string) {
  try {
    document.cookie = `${COOKIE}=${encodeURIComponent(code)}; Max-Age=${3 * 86400}; Path=${PATH}; SameSite=Strict; Secure`
  } catch {
    /* cookies blocked */
  }
  try {
    const c = await caches.open(CACHE)
    await c.put(KEY, new Response(code, { headers: { 'x-at': String(Date.now()) } }))
  } catch {
    /* CacheStorage unavailable */
  }
}

export async function readStashedInvite(): Promise<string | null> {
  const m = new RegExp(`(?:^|; )${COOKIE}=([^;]*)`).exec(document.cookie)
  if (m) return decodeURIComponent(m[1])
  try {
    const res = await (await caches.open(CACHE)).match(KEY)
    if (res && Date.now() - Number(res.headers.get('x-at') || 0) < 3 * 86400_000) return await res.text()
  } catch {
    /* CacheStorage unavailable */
  }
  return null
}

export async function clearStashedInvite() {
  try {
    document.cookie = `${COOKIE}=; Max-Age=0; Path=${PATH}; SameSite=Strict; Secure`
  } catch {
    /* ignore */
  }
  try {
    await caches.delete(CACHE)
  } catch {
    /* ignore */
  }
}
