export type SiteLocale = 'es' | 'en'

const LOCALES = new Set(['es', 'en'])

export const localeFromPath = (pathname = window.location.pathname): SiteLocale => {
  const first = pathname.split('/').filter(Boolean)[0]
  return first === 'en' ? 'en' : 'es'
}

export const stripLocale = (pathname = window.location.pathname) => {
  const parts = pathname.split('/').filter(Boolean)
  if (LOCALES.has(parts[0] || '')) parts.shift()
  return parts.length ? `/${parts.join('/')}` : '/'
}

export const withLocale = (path: string, locale: SiteLocale = localeFromPath()) => {
  const raw = path.startsWith('http') ? new URL(path, window.location.origin).pathname : path
  const stripped = stripLocale(raw.startsWith('/') ? raw : `/${raw}`)
  return stripped === '/' ? `/${locale}` : `/${locale}${stripped}`
}

export const ensureLocalePath = () => {
  const parts = window.location.pathname.split('/').filter(Boolean)
  if (LOCALES.has(parts[0] || '')) return false
  const rest = window.location.pathname === '/' ? '' : window.location.pathname
  window.history.replaceState({}, '', `/es${rest}${window.location.search}${window.location.hash}`)
  return true
}

export const swapLocalePath = (next: SiteLocale) => {
  const stripped = stripLocale(window.location.pathname)
  return withLocale(stripped, next) + window.location.search + window.location.hash
}
