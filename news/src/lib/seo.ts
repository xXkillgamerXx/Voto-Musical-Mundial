import { stripLocale, withLocale } from './locale'
import { FACEBOOK_PAGE, SITE_NAME, TWITTER_SITE, buildNewsArticleGraph } from './schema'

const DEFAULT_IMAGE = 'https://www.musicmundial.com/images/portada-1600x900.jpg'
const LOGO_IMAGE_RE =
  /logo-cuadrado|cropped-logo-music-mundial|logo-music-mundial|\/images\/logo(?:-dark)?\.(?:png|webp|jpe?g|svg)/i
const TITLE_MAX = 110
const DESC_MAX = 160
const SCHEMA_DESC_MAX = 320
const GA_ID = 'G-MYCSLDGEHG'
const ARTICLE_SCHEMA_ID = 'news-article-schema'

const setAttr = (attr: 'name' | 'property', key: string, content?: string | null) => {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null
  const value = String(content || '').trim()
  if (!value) {
    el?.remove()
    return
  }
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', value)
}

const setCanonical = (url: string) => {
  let el = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null
  if (!el) {
    el = document.createElement('link')
    el.rel = 'canonical'
    document.head.appendChild(el)
  }
  el.href = url
}

const clip = (value: string, max: number) => {
  const text = String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (text.length <= max) return text
  return `${text.slice(0, max - 1).trimEnd()}…`
}

const absoluteUrl = (value?: string | null) => {
  const raw = String(value || '').trim()
  const origin = window.location.origin.replace(/\/$/, '')
  if (!raw) return DEFAULT_IMAGE
  if (/^https?:\/\//i.test(raw)) return raw
  if (raw.startsWith('//')) return `${window.location.protocol}${raw}`
  return `${origin}${raw.startsWith('/') ? '' : '/'}${raw}`
}

const pickArticleImage = (value?: string | null) => {
  const raw = String(value || '').trim()
  if (!raw) return DEFAULT_IMAGE
  const abs = absoluteUrl(raw)
  if (LOGO_IMAGE_RE.test(abs)) return DEFAULT_IMAGE
  return abs
}

const toIsoUtc = (value?: string | Date | null) => {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}+00:00`
}

const setHreflang = (links: Record<string, string>) => {
  document.head.querySelectorAll('link[rel="alternate"][hreflang]').forEach((el) => el.remove())
  Object.entries(links).forEach(([lang, href]) => {
    const url = String(href || '').trim()
    if (!url) return
    const el = document.createElement('link')
    el.rel = 'alternate'
    el.hreflang = lang
    el.href = absoluteUrl(url)
    document.head.appendChild(el)
  })
}

const setListAttr = (attr: 'name' | 'property', key: string, values: string[]) => {
  document.head.querySelectorAll(`meta[${attr}="${key}"]`).forEach((el) => el.remove())
  values
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .forEach((content) => {
      const el = document.createElement('meta')
      el.setAttribute(attr, key)
      el.setAttribute('content', content)
      document.head.appendChild(el)
    })
}

const imageType = (url: string) => {
  if (/\.png(?:$|\?)/i.test(url)) return 'image/png'
  if (/\.webp(?:$|\?)/i.test(url)) return 'image/webp'
  if (/\.gif(?:$|\?)/i.test(url)) return 'image/gif'
  if (/\.jpe?g(?:$|\?)/i.test(url)) return 'image/jpeg'
  return ''
}

const setJsonLd = (id: string, data: object | null) => {
  let el = document.getElementById(id) as HTMLScriptElement | null
  if (!data) {
    el?.remove()
    return
  }
  if (!el) {
    el = document.createElement('script')
    el.type = 'application/ld+json'
    el.id = id
    document.head.appendChild(el)
  }
  el.textContent = JSON.stringify(data)
}

export type NewsSeoInput = {
  type?: 'website' | 'article'
  title: string
  description?: string
  path?: string
  image?: string | null
  imageAlt?: string
  publishedAt?: string | Date | null
  modifiedAt?: string | Date | null
  author?: string
  authorUrl?: string
  authorImage?: string
  keywords?: string[]
  sections?: string[]
  categoryName?: string
  categoryPath?: string
  locale?: 'es' | 'en'
  hreflangEn?: string | null
  hreflangEs?: string | null
  videos?: string[]
}

export const applyNewsSeo = (input: NewsSeoInput) => {
  const type = input.type || 'website'
  const locale = input.locale === 'es' ? 'es' : 'en'
  const title = clip(input.title, TITLE_MAX)
  const description = clip(
    input.description ||
      (locale === 'es'
        ? 'Noticias de música, K-POP y entretenimiento en Music Mundial.'
        : 'Music, K-POP and entertainment news on Music Mundial.'),
    DESC_MAX,
  )
  const url = absoluteUrl(input.path || window.location.pathname)
  const image = pickArticleImage(input.image)
  const imageAlt = input.imageAlt || title
  const published = toIsoUtc(input.publishedAt)
  const modified = toIsoUtc(input.modifiedAt || input.publishedAt)
  const stripped = stripLocale(input.path || window.location.pathname)
  const enHref = input.hreflangEn || (type === 'article' && locale !== 'en' ? '' : withLocale(stripped, 'en'))
  const esHref = input.hreflangEs || (type === 'article' && locale !== 'es' ? '' : withLocale(stripped, 'es'))

  const fullTitle = title.includes('Music Mundial') ? title : `${title} — ${SITE_NAME}`
  document.title = fullTitle
  document.documentElement.lang = locale
  setCanonical(url)
  setHreflang({
    ...(esHref ? { es: esHref, 'es-ES': esHref } : {}),
    ...(enHref ? { en: enHref, 'en-US': enHref } : {}),
    'x-default': enHref || '/',
  })
  setAttr('name', 'description', description)
  setAttr(
    'name',
    'robots',
    type === 'article'
      ? 'follow, index, max-snippet:-1, max-video-preview:-1, max-image-preview:large'
      : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1',
  )
  setAttr('name', 'googlebot', 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1')
  setAttr('name', 'googlebot-news', type === 'article' ? 'index, follow' : '')
  setAttr('property', 'og:type', type)
  setAttr('property', 'og:locale', locale === 'es' ? 'es_ES' : 'en_US')
  setListAttr('property', 'og:locale:alternate', locale === 'es' ? ['en_US'] : ['es_ES'])
  setAttr('property', 'og:title', fullTitle)
  setAttr('property', 'og:description', description)
  setAttr('property', 'og:url', url)
  setAttr('property', 'og:image', image)
  setAttr('property', 'og:image:secure_url', /^https:/i.test(image) ? image : '')
  setAttr('property', 'og:image:type', imageType(image) || (type === 'article' ? 'image/jpeg' : ''))
  setAttr('property', 'og:image:width', '1600')
  setAttr('property', 'og:image:height', '900')
  setAttr('property', 'og:image:alt', imageAlt)
  setAttr('property', 'og:site_name', SITE_NAME)
  setAttr('property', 'article:publisher', type === 'article' ? FACEBOOK_PAGE : '')
  setAttr('property', 'article:published_time', type === 'article' ? published : '')
  setAttr('property', 'article:modified_time', type === 'article' ? modified : '')
  setAttr('property', 'article:author', type === 'article' ? input.author || '' : '')
  setAttr('property', 'article:section', type === 'article' ? input.categoryName || input.sections?.[0] || '' : '')
  setListAttr('property', 'article:tag', type === 'article' ? input.keywords || [] : [])
  setAttr('name', 'twitter:card', 'summary_large_image')
  setAttr('name', 'twitter:title', fullTitle)
  setAttr('name', 'twitter:description', description)
  setAttr('name', 'twitter:site', TWITTER_SITE)
  setAttr('name', 'twitter:image', image)
  setAttr('name', 'twitter:image:alt', imageAlt)
  setAttr('name', 'keywords', type === 'article' ? (input.keywords || []).join(', ') : '')
  setJsonLd(
    ARTICLE_SCHEMA_ID,
    type === 'article'
      ? buildNewsArticleGraph({
          locale,
          origin: window.location.origin,
          url,
          title: clip(input.title, 200),
          description: clip(input.description || description, SCHEMA_DESC_MAX),
          image,
          published,
          modified,
          author: input.author,
          authorUrl: input.authorUrl,
          authorImage: input.authorImage ? absoluteUrl(input.authorImage) : '',
          keywords: input.keywords,
          sections: input.sections,
          categoryName: input.categoryName,
          categoryUrl: input.categoryPath ? absoluteUrl(input.categoryPath) : '',
          imageCaption: imageAlt,
          videos: input.videos,
        })
      : null,
  )

  trackPageView(document.title, url)
}

export const applyPrivateSeo = (title: string) => {
  document.title = title
  setAttr('name', 'robots', 'noindex, nofollow')
  setAttr('name', 'googlebot', 'noindex, nofollow')
  setAttr('name', 'googlebot-news', '')
}

export const applyHomeSeo = (locale: 'es' | 'en') =>
  applyNewsSeo({
    type: 'website',
    locale,
    path: locale === 'es' ? '/es' : '/',
    title: locale === 'es' ? 'Music Mundial — Cultura y entretenimiento' : 'Music Mundial — Entertainment news',
    description:
      locale === 'es'
        ? 'Noticias de música, K-POP y entretenimiento en Music Mundial.'
        : 'Music, K-POP and entertainment news on Music Mundial.',
    image: DEFAULT_IMAGE,
    imageAlt: locale === 'es' ? 'Music Mundial — Cultura y entretenimiento' : 'Music Mundial — Entertainment news',
    hreflangEn: '/',
    hreflangEs: '/es',
  })

let firstPageView = true
export const trackPageView = (title: string, url: string) => {
  if (firstPageView) {
    firstPageView = false
    return
  }
  const gtag = (window as Window & { gtag?: (...args: unknown[]) => void }).gtag
  if (typeof gtag !== 'function') return
  gtag('event', 'page_view', {
    page_title: title,
    page_location: url,
    page_path: window.location.pathname,
    send_to: GA_ID,
  })
}
