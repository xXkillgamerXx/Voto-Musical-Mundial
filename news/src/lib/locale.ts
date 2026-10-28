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

export const withLocale = (path: string, locale: SiteLocale = localeFromPath()) => {
  const raw = path.startsWith('http') ? new URL(path, window.location.origin).pathname : path
  const stripped = stripLocale(raw.startsWith('/') ? raw : `/${raw}`)
  if (locale === 'es') return stripped === '/' ? '/es' : `/es${stripped}`
  return stripped
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
  return withLocale(stripped, next) + window.location.search + window.location.hash
}

export const articleHref = (locale: SiteLocale | string, slug: string) => {
  const lang: SiteLocale = locale === 'es' ? 'es' : 'en'
  const name = String(slug || '')
    .trim()
    .replace(/^\/+/, '')
  return withLocale(name ? `/${name}` : '/', lang)
}
