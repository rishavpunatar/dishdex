import type { DraftPhoto } from './store'

function loadImg(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('That photo couldn’t be read. Try a JPEG or PNG.'))
    }
    img.src = url
  })
}

function draw(img: HTMLImageElement, maxEdge: number) {
  const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight))
  const w = Math.max(1, Math.round(img.naturalWidth * scale))
  const h = Math.max(1, Math.round(img.naturalHeight * scale))
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, w, h)
  return c
}

const toBlob = (c: HTMLCanvasElement, q: number) =>
  new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Couldn’t compress photo'))), 'image/jpeg', q))

/** Phone photos are 3–12 MB; we keep a ~1600px copy plus a tiny inline thumbnail. */
export async function processPhoto(file: Blob): Promise<DraftPhoto> {
  const img = await loadImg(file)
  const full = draw(img, 1600)
  const blob = await toBlob(full, 0.82)
  const thumb = draw(img, 480).toDataURL('image/jpeg', 0.7)
  return { blob, w: full.width, h: full.height, thumb }
}
