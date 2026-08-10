const DEFAULT_OG_IMAGE = 'https://vote.musicmundial.com/web-app-manifest-512x512.png'
const TWITTER_SITE = '@MusicMundial'
export const PUBLIC_SHARE_ORIGIN = 'https://vote.musicmundial.com'

const ensureMeta = (attr, key, content) => {
  if (!content || typeof document === 'undefined') {
    return
  }

  let el = document.head.querySelector(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

const guessImageType = (imageUrl) => {
  if (/\.png(?:$|\?)/i.test(imageUrl)) return 'image/png'
  if (/\.webp(?:$|\?)/i.test(imageUrl)) return 'image/webp'
  if (/\.gif(?:$|\?)/i.test(imageUrl)) return 'image/gif'
  if (/\.jpe?g(?:$|\?)/i.test(imageUrl)) return 'image/jpeg'
  return ''
}

/** Origin used for social shares (Facebook cannot scrape localhost). */
export const getPublicShareOrigin = () => {
  if (typeof window === 'undefined') {
    return PUBLIC_SHARE_ORIGIN
  }
  const origin = String(window.location.origin || '').replace(/\/$/, '')
  if (!origin || /localhost|127\.0\.0\.1/i.test(origin)) {
    return PUBLIC_SHARE_ORIGIN
  }
  return origin
}

export const toAbsoluteUrl = (value, base = getPublicShareOrigin()) => {
  const raw = String(value || '').trim()
  if (!raw) {
    return ''
  }
  if (/^https?:\/\//i.test(raw)) {
    // Rewrite localhost absolute URLs to the public share origin.
    try {
      const parsed = new URL(raw)
      if (/localhost|127\.0\.0\.1/i.test(parsed.hostname)) {
        return `${getPublicShareOrigin()}${parsed.pathname}${parsed.search}${parsed.hash}`
      }
    } catch {
      // keep as-is
    }
    return raw
  }
  if (raw.startsWith('//')) {
    return `https:${raw}`
  }
  const origin = String(base || getPublicShareOrigin()).replace(/\/$/, '')
  return `${origin}${raw.startsWith('/') ? '' : '/'}${raw}`
}

export const resolvePollShareImage = (poll) => {
  const meta = poll?.config || poll?.metadata || {}
  return (
    poll?.banner ||
    poll?.cover ||
    poll?.coverImage ||
    poll?.image ||
    meta.banner ||
    meta.bannerUrl ||
    meta.cover ||
    meta.coverImage ||
    meta.image ||
    meta.imageUrl ||
    ''
  )
}

export const applyShareMeta = ({
  title,
  description,
  url,
  image,
  imageType = '',
  imageWidth = '',
  imageHeight = '',
  locale = '',
} = {}) => {
  if (typeof document === 'undefined') {
    return
  }

  const nextTitle = String(title || document.title || 'MUSIC MUNDIAL VOTE').trim()
  const nextDescription = String(
    description ||
      'Vota por tus artistas favoritos, sigue rondas en vivo y descubre rankings globales de fandoms.',
  )
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200)
  const nextUrl = toAbsoluteUrl(url || (typeof window !== 'undefined' ? window.location.href : ''))
  const nextImage = toAbsoluteUrl(image) || DEFAULT_OG_IMAGE
  const nextImageType = imageType || guessImageType(nextImage)
  const isDefaultImage = nextImage === DEFAULT_OG_IMAGE
  const nextWidth = String(imageWidth || (isDefaultImage ? 512 : 1200))
  const nextHeight = String(imageHeight || (isDefaultImage ? 512 : 630))
  const pathLocale = String(locale || '').toLowerCase()
  const ogLocale =
    pathLocale.startsWith('en') || /\/poll\//.test(nextUrl) ? 'en_US' : 'es_ES'
  const ogLocaleAlt = ogLocale === 'en_US' ? 'es_ES' : 'en_US'

  document.title = nextTitle

  ensureMeta('name', 'description', nextDescription)
  ensureMeta('property', 'og:type', 'website')
  ensureMeta('property', 'og:site_name', 'MUSIC MUNDIAL VOTE')
  ensureMeta('property', 'og:locale', ogLocale)
  ensureMeta('property', 'og:locale:alternate', ogLocaleAlt)
  ensureMeta('property', 'og:title', nextTitle)
  ensureMeta('property', 'og:description', nextDescription)
  ensureMeta('property', 'og:url', nextUrl)
  ensureMeta('property', 'og:image', nextImage)
  ensureMeta('property', 'og:image:secure_url', nextImage)
  ensureMeta('property', 'og:image:alt', nextTitle)
  if (nextImageType) {
    ensureMeta('property', 'og:image:type', nextImageType)
  }
  ensureMeta('property', 'og:image:width', nextWidth)
  ensureMeta('property', 'og:image:height', nextHeight)

  ensureMeta('name', 'twitter:card', 'summary_large_image')
  ensureMeta('name', 'twitter:site', TWITTER_SITE)
  ensureMeta('name', 'twitter:title', nextTitle)
  ensureMeta('name', 'twitter:description', nextDescription)
  ensureMeta('name', 'twitter:image', nextImage)
  ensureMeta('name', 'twitter:image:alt', nextTitle)
  ensureMeta('name', 'twitter:url', nextUrl)

  let canonical = document.head.querySelector('link[rel="canonical"]')
  if (!canonical) {
    canonical = document.createElement('link')
    canonical.setAttribute('rel', 'canonical')
    document.head.appendChild(canonical)
  }
  canonical.setAttribute('href', nextUrl)
}

export const shareWithOptionalImage = async ({ title, text, url, imageUrl }) => {
  const payload = { title, text, url }

  if (navigator.share && imageUrl && typeof navigator.canShare === 'function') {
    try {
      const response = await fetch(toAbsoluteUrl(imageUrl), { mode: 'cors' })
      if (response.ok) {
        const blob = await response.blob()
        const extension = (blob.type || '').includes('png')
          ? 'png'
          : (blob.type || '').includes('webp')
            ? 'webp'
            : 'jpg'
        const file = new File([blob], `vmm-share.${extension}`, {
          type: blob.type || 'image/jpeg',
        })
        if (navigator.canShare({ ...payload, files: [file] })) {
          await navigator.share({ ...payload, files: [file] })
          return 'shared-with-image'
        }
      }
    } catch {
      // Fall through to text/url share.
    }
  }

  if (navigator.share) {
    await navigator.share(payload)
    return 'shared'
  }

  return 'unsupported'
}
