import { useEffect, useState } from 'react'
import { db } from './local'
import { getRemote } from './store'

const cache = new Map<string, Promise<string>>()

export function photoBlob(path: string): Promise<Blob> {
  return (async () => {
    const local = await db.getImage(path)
    if (local) return local
    const r = getRemote()
    if (!r) throw new Error('offline')
    const blob = await r.readBinary(path)
    await db.putImage(path, blob)
    return blob
  })()
}

export function photoUrl(path: string): Promise<string> {
  let p = cache.get(path)
  if (!p) {
    p = photoBlob(path).then((b) => URL.createObjectURL(b))
    p.catch(() => cache.delete(path))
    cache.set(path, p)
  }
  return p
}

export function usePhoto(path?: string) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    setUrl(null)
    if (!path) return
    let alive = true
    photoUrl(path)
      .then((u) => alive && setUrl(u))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [path])
  return url
}
