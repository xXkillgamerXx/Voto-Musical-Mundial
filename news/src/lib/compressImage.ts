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

export const slugifyImageBase = (value?: string | null, fallback = 'portada') => {
  const slug = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
  return slug || fallback
}

const renameFile = (file: File, base: string, extHint?: string) => {
  const fromName = (file.name.match(/\.([^.]+)$/) || [])[1] || ''
  const fromType = file.type.includes('webp')
    ? 'webp'
    : file.type.includes('png')
      ? 'png'
      : file.type.includes('gif')
        ? 'gif'
        : 'jpg'
  const ext = (extHint || fromName || fromType).replace(/^\./, '').toLowerCase() || 'jpg'
  return new File([file], `${base}.${ext}`, { type: file.type || `image/${ext === 'jpg' ? 'jpeg' : ext}`, lastModified: Date.now() })
}

/** Resize + compress cover/photo uploads to roughly 150–180 KB. */
export const compressImageFile = async (
  file: File,
  options?: { maxEdge?: number; targetBytes?: number; minQuality?: number; fileNameBase?: string },
): Promise<File> => {
  const base = slugifyImageBase(options?.fileNameBase || file.name.replace(/\.[^.]+$/, ''), 'portada')
  if (!file.type.startsWith('image/') || file.type.includes('gif') || file.type.includes('svg')) {
    return renameFile(file, base)
  }

  // Accept any original size; always downscale/re-encode to a web-friendly weight.
  const maxEdge = options?.maxEdge || 1600
  const targetBytes = options?.targetBytes || 220_000
  const minQuality = options?.minQuality || 0.58

  let img: HTMLImageElement
  try {
    img = await loadImage(file)
  } catch {
    return renameFile(file, base)
  }

  const longest = Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height)
  // Already light and within size: keep pixels, only rename from title.
  if (file.size <= targetBytes && longest <= maxEdge) {
    return renameFile(file, base)
  }
  const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height))
  const width = Math.max(1, Math.round((img.naturalWidth || img.width) * scale))
  const height = Math.max(1, Math.round((img.naturalHeight || img.height) * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return renameFile(file, base)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(img, 0, 0, width, height)

  let type = 'image/jpeg'
  const probe = await canvasToBlob(canvas, 'image/webp', 0.82)
  if (probe && probe.type === 'image/webp') type = 'image/webp'
  const ext = type === 'image/webp' ? 'webp' : 'jpg'
  let quality = 0.86
  let best: Blob | null = null
  let edge = Math.max(width, height)

  while (edge >= 1000) {
    if (edge !== Math.max(width, height)) {
      const ratio = edge / Math.max(width, height)
      canvas.width = Math.max(1, Math.round(width * ratio))
      canvas.height = Math.max(1, Math.round(height * ratio))
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    }
    quality = 0.86
    while (quality >= minQuality) {
      const blob = await canvasToBlob(canvas, type, quality)
      if (!blob) break
      best = blob
      if (blob.size <= targetBytes) {
        return new File([best], `${base}.${ext}`, { type, lastModified: Date.now() })
      }
      quality -= 0.06
    }
    edge = Math.round(edge * 0.88)
  }

  if (!best || best.size >= file.size) return renameFile(file, base)
  return new File([best], `${base}.${ext}`, { type, lastModified: Date.now() })
}
