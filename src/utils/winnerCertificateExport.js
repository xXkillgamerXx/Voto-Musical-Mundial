const CERT_WIDTH = 819
const CERT_HEIGHT = 1024
const SCALE = CERT_WIDTH / 520

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load ${src}`))
    img.src = src
  })

const ensureMontserrat = async () => {
  if (typeof document === 'undefined') return

  const href =
    'https://fonts.googleapis.com/css2?family=Montserrat:wght@500;800;900&display=swap'
  if (!document.querySelector(`link[href="${href}"]`)) {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = href
    document.head.appendChild(link)
  }

  if (!document.fonts?.load) return
  await Promise.all([
    document.fonts.load('900 76px Montserrat'),
    document.fonts.load('800 37px Montserrat'),
    document.fonts.load('500 24px Montserrat'),
  ]).catch(() => {})
}

const drawSpacedText = (ctx, text, x, y, fontSize, letterSpacingEm) => {
  const spacing = letterSpacingEm * fontSize
  const chars = Array.from(text)
  const widths = chars.map((char) => ctx.measureText(char).width)
  const total =
    widths.reduce((sum, width) => sum + width, 0) +
    spacing * Math.max(0, chars.length - 1)
  let cursor = x - total / 2
  chars.forEach((char, index) => {
    ctx.fillText(char, cursor + widths[index] / 2, y)
    cursor += widths[index] + spacing
  })
}

const drawGradientText = (ctx, text, x, y, fontSize, weight, stops, letterSpacingEm = 0) => {
  ctx.save()
  ctx.font = `${weight} ${fontSize}px Montserrat, system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  const gradient = ctx.createLinearGradient(x, y, x, y + fontSize)
  stops.forEach(([offset, color]) => gradient.addColorStop(offset, color))
  ctx.fillStyle = gradient
  if (letterSpacingEm) {
    drawSpacedText(ctx, text, x, y, fontSize, letterSpacingEm)
  } else {
    ctx.fillText(text, x, y)
  }
  ctx.restore()
}

const slugify = (value) =>
  String(value || 'certificate')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'certificate'

export const buildCertificateFilename = ({ name, group, date } = {}) => {
  const parts = [name, group, date].map((part) => slugify(part)).filter(Boolean)
  return `music-mundial-${parts.join('-') || 'certificate'}.png`
}

export const renderWinnerCertificateBlob = async ({ name, group, date } = {}) => {
  await ensureMontserrat()

  const canvas = document.createElement('canvas')
  canvas.width = CERT_WIDTH
  canvas.height = CERT_HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unavailable')

  const background = await loadImage('/certificate-bg.png')
  ctx.drawImage(background, 0, 0, CERT_WIDTH, CERT_HEIGHT)

  const displayName = String(name || '').trim().toUpperCase()
  const displayGroup = String(group || '').trim().toUpperCase()
  const displayDate = String(date || '').trim().toUpperCase()

  if (displayName) {
    const fontSize = 48 * SCALE
    drawGradientText(
      ctx,
      displayName,
      CERT_WIDTH / 2,
      CERT_HEIGHT * 0.335,
      fontSize,
      900,
      [
        [0, '#ffffff'],
        [0.52, '#b789f4'],
        [1, '#9889fb'],
      ],
      0.04,
    )
  }

  if (displayGroup) {
    const fontSize = 23.2 * SCALE
    drawGradientText(
      ctx,
      displayGroup,
      CERT_WIDTH / 2,
      CERT_HEIGHT * 0.412,
      fontSize,
      800,
      [
        [0, '#a45de0'],
        [1, '#7953ca'],
      ],
      0.18,
    )
  }

  if (displayDate) {
    const fontSize = 14.7 * SCALE
    ctx.save()
    ctx.font = `500 ${fontSize}px Montserrat, system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillStyle = '#ffffff'
    drawSpacedText(ctx, displayDate, CERT_WIDTH * 0.74, CERT_HEIGHT * 0.81, fontSize, 0.1)
    ctx.restore()
  }

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error('PNG export failed'))),
      'image/png',
    )
  })

  return blob
}

export const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1500)
}

export const blobToFile = (blob, filename) =>
  new File([blob], filename, { type: blob.type || 'image/png' })
