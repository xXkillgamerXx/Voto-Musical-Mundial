const loadImage = (file: File) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('No se pudo leer la imagen.'))
    }
    img.src = url
  })

const canvasToBlob = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality)
  })

/** Resize + compress cover/photo uploads to roughly 150–180 KB. */
export const compressImageFile = async (
  file: File,
  options?: { maxEdge?: number; targetBytes?: number; minQuality?: number },
): Promise<File> => {
  if (!file.type.startsWith('image/') || file.type.includes('gif') || file.type.includes('svg')) {
    return file
  }
  if (file.size <= (options?.targetBytes || 170_000)) return file

  const maxEdge = options?.maxEdge || 1600
  const targetBytes = options?.targetBytes || 170_000
  const minQuality = options?.minQuality || 0.52
  const img = await loadImage(file)
  const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height))
  const width = Math.max(1, Math.round((img.naturalWidth || img.width) * scale))
  const height = Math.max(1, Math.round((img.naturalHeight || img.height) * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return file
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(img, 0, 0, width, height)

  let type = 'image/jpeg'
  const probe = await canvasToBlob(canvas, 'image/webp', 0.8)
  if (probe && probe.type === 'image/webp') type = 'image/webp'
  const ext = type === 'image/webp' ? 'webp' : 'jpg'
  let quality = 0.82
  let best: Blob | null = null
  let edge = Math.max(width, height)

  while (edge >= 900) {
    if (edge !== Math.max(width, height)) {
      const ratio = edge / Math.max(width, height)
      canvas.width = Math.max(1, Math.round(width * ratio))
      canvas.height = Math.max(1, Math.round(height * ratio))
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    }
    quality = 0.82
    while (quality >= minQuality) {
      const blob = await canvasToBlob(canvas, type, quality)
      if (!blob) break
      best = blob
      if (blob.size <= targetBytes) {
        const base = file.name.replace(/\.[^.]+$/, '') || 'portada'
        return new File([best], `${base}.${ext}`, { type, lastModified: Date.now() })
      }
      quality -= 0.07
    }
    edge = Math.round(edge * 0.85)
  }

  if (!best || best.size >= file.size) return file
  const base = file.name.replace(/\.[^.]+$/, '') || 'portada'
  return new File([best], `${base}.${ext}`, { type, lastModified: Date.now() })
}
