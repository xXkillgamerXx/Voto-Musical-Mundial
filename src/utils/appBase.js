/** Vite `base` without trailing slash, e.g. `/vote`. Empty when served at domain root. */
export const getAppBase = () => {
  const raw = String(import.meta.env.BASE_URL || '/').replace(/\/+$/, '')
  return raw === '/' ? '' : raw
}

export const stripAppBase = (pathname = '/') => {
  const path = String(pathname || '/').split('?')[0].split('#')[0] || '/'
  const normalized = path.startsWith('/') ? path : `/${path}`
  const base = getAppBase()
  if (!base) return normalized || '/'
  if (normalized === base) return '/'
  if (normalized.startsWith(`${base}/`)) {
    const rest = normalized.slice(base.length)
    return rest || '/'
  }
  return normalized
}

const PAGE_NOCACHE_RE = /^\/(user|perfil|profile)(\/|$)/

export const withAppBase = (pathname = '/') => {
  const raw = String(pathname || '/')
  const hashIndex = raw.indexOf('#')
  const hash = hashIndex >= 0 ? raw.slice(hashIndex) : ''
  const withoutHash = hashIndex >= 0 ? raw.slice(0, hashIndex) : raw
  const queryIndex = withoutHash.indexOf('?')
  const query = queryIndex >= 0 ? withoutHash.slice(queryIndex) : ''
  const pathOnly = queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash
  const stripped = stripAppBase(pathOnly)
  const base = getAppBase()
  const prefixed = !base
    ? stripped
    : stripped === '/'
      ? `${base}/`
      : `${base}${stripped}`
  if (!PAGE_NOCACHE_RE.test(stripped)) {
    return `${prefixed}${query}${hash}`
  }
  const params = new URLSearchParams(query.startsWith('?') ? query.slice(1) : query)
  params.set('_', `${Date.now()}${Math.floor(Math.random() * 1e9)}`)
  return `${prefixed}?${params.toString()}${hash}`
}

export const locationPath = () =>
  typeof window === 'undefined' ? '/' : stripAppBase(window.location.pathname)

export const assetUrl = (path = '') => {
  const raw = String(path || '').trim()
  if (!raw) return ''
  if (/^https?:\/\//i.test(raw) || raw.startsWith('data:')) return raw
  const pathname = raw.startsWith('/') ? raw : `/${raw}`
  return withAppBase(pathname)
}

const VOTE_ROOTS = new Set([
  'admin',
  'embed',
  'votaciones',
  'polls',
  'artistas',
  'artists',
  'salon-de-la-fama',
  'hall-of-fame',
  'ranking-popularity',
  'notificaciones',
  'notifications',
  'perfil',
  'profile',
  'registro',
  'register',
  'verificar-correo',
  'verify-email',
  'recuperar-contrasena',
  'reset-password',
  'terminos-y-condiciones',
  'terms-and-conditions',
  'politica-de-privacidad',
  'privacy-policy',
  'planes',
  'plans',
  'pago',
  'checkout',
  'votacion',
  'poll',
  'artista',
  'artist',
  'user',
])

/** True for vote-app URLs, including unprefixed hrefs generated before the /vote base. */
export const isVoteAppPath = (pathname = '/') => {
  const path = String(pathname || '/').split('?')[0].split('#')[0] || '/'
  const base = getAppBase()
  if (base && (path === base || path.startsWith(`${base}/`))) return true
  const stripped = stripAppBase(path)
  const first = stripped.split('/').filter(Boolean)[0] || ''
  if (!first) return Boolean(base && (path === base || path.startsWith(`${base}/`)))
  return VOTE_ROOTS.has(first)
}

export const isAdminLocation = () => locationPath().startsWith('/admin')
