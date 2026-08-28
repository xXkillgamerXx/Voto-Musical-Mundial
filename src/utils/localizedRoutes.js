import { resolvePollLocale } from './pollLocale'

/** Rutas estáticas ES ↔ EN para navegación y compartir. */
export const STATIC_ROUTES = {
  home: { es: '/', en: '/' },
  polls: { es: '/votaciones', en: '/polls' },
  artists: { es: '/artistas', en: '/artists' },
  hallOfFame: { es: '/salon-de-la-fama', en: '/hall-of-fame' },
  rankingPopularity: { es: '/ranking-popularity', en: '/ranking-popularity' },
  news: { es: '/noticias', en: '/news' },
  notifications: { es: '/notificaciones', en: '/notifications' },
  profile: { es: '/perfil', en: '/profile' },
  register: { es: '/registro', en: '/register' },
  verifyEmail: { es: '/verificar-correo', en: '/verify-email' },
  resetPassword: { es: '/recuperar-contrasena', en: '/reset-password' },
  terms: { es: '/terminos-y-condiciones', en: '/terms-and-conditions' },
  privacy: { es: '/politica-de-privacidad', en: '/privacy-policy' },
}

const PREFIX = {
  poll: { es: '/votacion', en: '/poll' },
  artist: { es: '/artista', en: '/artist' },
}

const buildStaticLookup = () => {
  const map = new Map()
  for (const [key, paths] of Object.entries(STATIC_ROUTES)) {
    map.set(paths.es, { key, canonical: paths.es })
    map.set(paths.en, { key, canonical: paths.es })
  }
  return map
}

const staticLookup = buildStaticLookup()

export const routePath = (key, locale = 'es') => {
  const entry = STATIC_ROUTES[key]
  if (!entry) return '/'
  return resolvePollLocale(locale) === 'en' ? entry.en : entry.es
}

/** Convierte cualquier ruta conocida a su forma canónica (ES) para el router. */
export const toCanonicalPath = (pathname = '/') => {
  const path = String(pathname || '/').split('?')[0].split('#')[0] || '/'
  if (path === '/') return '/'

  const staticHit = staticLookup.get(path)
  if (staticHit) return staticHit.canonical

  const parts = path.split('/').filter(Boolean)
  if (!parts.length) return '/'

  if (parts[0] === 'poll' || parts[0] === 'votacion') {
    return `/votacion/${parts.slice(1).join('/')}`
  }

  if (parts[0] === 'artist' || parts[0] === 'artista') {
    return `/artista/${parts.slice(1).join('/')}`
  }

  return path
}

/** Reescribe la ruta actual al idioma pedido (para compartir / cambiar idioma). */
export const localizePath = (pathname = '/', locale = 'es') => {
  const path = String(pathname || '/').split('?')[0].split('#')[0] || '/'
  const useEn = resolvePollLocale(locale) === 'en'
  const canonical = toCanonicalPath(path)

  const staticHit = staticLookup.get(canonical)
  if (staticHit) {
    const entry = STATIC_ROUTES[staticHit.key]
    return useEn ? entry.en : entry.es
  }

  const parts = canonical.split('/').filter(Boolean)
  if (!parts.length) return '/'

  if (parts[0] === 'votacion') {
    const prefix = useEn ? PREFIX.poll.en : PREFIX.poll.es
    return `${prefix}/${parts.slice(1).join('/')}`
  }

  if (parts[0] === 'artista') {
    const prefix = useEn ? PREFIX.artist.en : PREFIX.artist.es
    return `${prefix}/${parts.slice(1).join('/')}`
  }

  return path
}

export const matchStaticRoute = (pathname, key) =>
  toCanonicalPath(pathname) === STATIC_ROUTES[key]?.es

export const pollPathPrefix = (locale = 'es') =>
  resolvePollLocale(locale) === 'en' ? PREFIX.poll.en : PREFIX.poll.es

export const artistPathPrefix = (locale = 'es') =>
  resolvePollLocale(locale) === 'en' ? PREFIX.artist.en : PREFIX.artist.es

/** Actualiza la URL del navegador al idioma actual sin recargar. */
export const syncLocalizedLocation = (locale = 'es') => {
  if (typeof window === 'undefined') return
  try {
    const url = new URL(window.location.href)
    if (url.pathname.startsWith('/admin') || url.pathname.startsWith('/embed')) {
      return
    }
    const nextPath = localizePath(url.pathname, locale)
    if (nextPath !== url.pathname) {
      window.history.replaceState({}, '', `${nextPath}${url.search}${url.hash}`)
      window.dispatchEvent(new PopStateEvent('popstate'))
    }
  } catch {
    // ignore
  }
}
