export type SiteLocale = 'es' | 'en'

const LOCALES = new Set(['es', 'en'])

export const localeFromPath = (pathname = window.location.pathname): SiteLocale => {
  const first = pathname.split('/').filter(Boolean)[0]
  return first === 'es' ? 'es' : 'en'
}

export const stripLocale = (pathname = window.location.pathname) => {
  const parts = pathname.split('/').filter(Boolean)
  if (LOCALES.has(parts[0] || '')) parts.shift()
  return parts.length ? `/${parts.join('/')}` : '/'
}

const PAGE_NOCACHE_RE = /^\/(user|perfil|profile)(\/|$)/

export const withPageCacheBuster = (href: string) => {
  const url = new URL(href, 'https://www.musicmundial.com')
  if (!PAGE_NOCACHE_RE.test(stripLocale(url.pathname))) return href
  url.searchParams.set('_', `${Date.now()}${Math.floor(Math.random() * 1e9)}`)
  return `${url.pathname}?${url.searchParams.toString()}${url.hash}`
}

export const withLocale = (path: string, locale: SiteLocale = localeFromPath()) => {
  const raw = path.startsWith('http') ? new URL(path, window.location.origin).pathname : path
  const stripped = stripLocale(raw.startsWith('/') ? raw : `/${raw}`)
  const prefixed = locale === 'es' ? (stripped === '/' ? '/es' : `/es${stripped}`) : stripped
  return withPageCacheBuster(prefixed)
}

export const ensureLocalePath = () => {
  const parts = window.location.pathname.split('/').filter(Boolean)
  if (parts[0] !== 'en') return false
  parts.shift()
  const next = (parts.length ? `/${parts.join('/')}` : '/') + window.location.search + window.location.hash
  window.history.replaceState({}, '', next)
  return true
}

export const swapLocalePath = (next: SiteLocale) => {
  const stripped = stripLocale(window.location.pathname)
  const href = withLocale(stripped, next)
  if (PAGE_NOCACHE_RE.test(stripped)) return href + window.location.hash
  return href + window.location.search + window.location.hash
}

export const articleHref = (locale: SiteLocale | string, slug: string) => {
  const lang: SiteLocale = locale === 'es' ? 'es' : 'en'
  const name = String(slug || '')
    .trim()
    .replace(/^\/+/, '')
  return withLocale(name ? `/${name}` : '/', lang)
}
