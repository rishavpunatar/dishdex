export function bytesToB64(bytes: Uint8Array): string {
  let s = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    s += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(s)
}

export function b64ToBytes(b64: string): Uint8Array {
  const s = atob(b64.replace(/\s/g, ''))
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i)
  return out
}

export const textToB64 = (text: string) => bytesToB64(new TextEncoder().encode(text))
export const b64ToText = (b64: string) => new TextDecoder().decode(b64ToBytes(b64))
export const blobToB64 = async (blob: Blob) => bytesToB64(new Uint8Array(await blob.arrayBuffer()))

export const toB64Url = (s: string) => textToB64(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
export const fromB64Url = (s: string) => {
  const b = s.replace(/-/g, '+').replace(/_/g, '/')
  return b64ToText(b + '='.repeat((4 - (b.length % 4)) % 4))
}
