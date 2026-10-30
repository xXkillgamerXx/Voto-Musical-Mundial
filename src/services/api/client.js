const appBase = String(import.meta.env.BASE_URL || '/').replace(/\/+$/, '')
const envApiBase = String(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
const sameOriginApi = appBase && appBase !== '/' ? `${appBase}/api` : '/api'
const pageHost = typeof window !== 'undefined' ? window.location.hostname : ''
const bakedLocalhost = /localhost|127\.0\.0\.1/i.test(envApiBase)
const pageIsLocal = /localhost|127\.0\.0\.1/i.test(pageHost)
const API_BASE_URL = !envApiBase || (bakedLocalhost && !pageIsLocal) ? sameOriginApi : envApiBase

const storageKey = 'vmm_api_auth'
const anonymousStorageKey = 'vmm_api_anonymous_v2'
const legacyAnonymousStorageKeys = ['vmm_api_anonymous']
const authChangeEvent = 'vmm-api-auth-change'
let refreshPromise = null

const decodeJwtPayload = (token) => {
  try {
    const payloadPart = token.split('.')[1]
    if (!payloadPart) return null
    const normalized = payloadPart.replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(window.atob(normalized))
  } catch {
    return null
  }
}

export const isAccessTokenExpired = (token, skewMs = 10_000) => {
  const payload = decodeJwtPayload(token)
  if (!payload?.exp) return false
  return payload.exp * 1000 <= Date.now() + skewMs
}

const jwtType = (token) => decodeJwtPayload(token)?.type || ''

export const getStoredAuth = () => {
  try {
    return JSON.parse(window.localStorage.getItem(storageKey) || 'null')
  } catch {
    return null
  }
}

export const setStoredAuth = (auth) => {
  if (!auth) {
    window.localStorage.removeItem(storageKey)
    window.dispatchEvent(new CustomEvent(authChangeEvent, { detail: null }))
    return
  }
  window.localStorage.setItem(storageKey, JSON.stringify(auth))
  window.dispatchEvent(new CustomEvent(authChangeEvent, { detail: auth }))
}

export const getStoredAnonymousAuth = () => {
  try {
    const current = JSON.parse(window.localStorage.getItem(anonymousStorageKey) || 'null')
    if (current?.accessToken) return current
    legacyAnonymousStorageKeys.forEach((key) => window.localStorage.removeItem(key))
    return null
  } catch {
    legacyAnonymousStorageKeys.forEach((key) => window.localStorage.removeItem(key))
    return null
  }
}

export const setStoredAnonymousAuth = (auth) => {
  if (!auth) {
    window.localStorage.removeItem(anonymousStorageKey)
    return
  }
  window.localStorage.setItem(anonymousStorageKey, JSON.stringify(auth))
}

const refreshStoredAuth = async () => {
  const current = getStoredAuth()

  if (!current?.refreshToken) {
    return null
  }

  if (!refreshPromise) {
    refreshPromise = window.fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken: current.refreshToken }),
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => null)

        if (!response.ok) {
          setStoredAuth(null)
          return null
        }

        setStoredAuth(payload)
        return payload
      })
      .finally(() => {
        refreshPromise = null
      })
  }

  return refreshPromise
}

export const ensureAccessToken = async () => {
  const current = getStoredAuth()
  if (!current?.accessToken) {
    return null
  }

  if (!isAccessTokenExpired(current.accessToken)) {
    return current.accessToken
  }

  const refreshed = await refreshStoredAuth()
  return refreshed?.accessToken || null
}

const withUserCacheBuster = (path) => {
  const [pathname, search = ''] = String(path || '').split('?')
  if (!/^\/(users|votes|polls|rankings|admin|news)(\/|$)/.test(pathname)) return path
  const params = new URLSearchParams(search)
  params.set('_', `${Date.now()}${Math.floor(Math.random() * 1e9)}`)
  return `${pathname}?${params.toString()}`
}

const noStoreFetch = (url, init = {}) =>
  window.fetch(url, {
    cache: 'no-store',
    ...init,
    headers: {
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
      ...(init.headers || {}),
    },
  })

export const apiRequest = async (path, {
  method = 'GET',
  body,
  token,
  headers = {},
} = {}) => {
  const requestPath = withUserCacheBuster(path)
  const buildRequest = (requestToken) => ({
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(requestToken ? { Authorization: `Bearer ${requestToken}` } : {}),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })

  let response = await noStoreFetch(`${API_BASE_URL}${requestPath}`, buildRequest(token))
  let payload = await response.json().catch(() => null)
  const usedAnonymous = jwtType(token) === 'anonymous'

  if (response.status === 401 && !path.startsWith('/auth/') && !usedAnonymous) {
    const refreshedAuth = await refreshStoredAuth()

    if (refreshedAuth?.accessToken) {
      response = await noStoreFetch(`${API_BASE_URL}${withUserCacheBuster(path)}`, buildRequest(refreshedAuth.accessToken))
      payload = await response.json().catch(() => null)
    }
  }

  if (!response.ok) {
    const rawMessage = payload?.message || payload?.error?.message
    const message = Array.isArray(rawMessage)
      ? rawMessage.filter(Boolean).join(' ')
      : rawMessage || 'No se pudo completar la solicitud.'
    const error = new Error(message)
    error.status = response.status
    error.payload = payload
    if (response.status === 401 && !path.startsWith('/auth/')) {
      if (usedAnonymous) {
        setStoredAnonymousAuth(null)
      } else {
        setStoredAuth(null)
      }
    }
    throw error
  }

  return payload
}

export const apiFormRequest = async (path, {
  method = 'POST',
  body,
  token,
  headers = {},
} = {}) => {
  const requestPath = withUserCacheBuster(path)
  const buildRequest = (requestToken) => ({
    method,
    headers: {
      ...(requestToken ? { Authorization: `Bearer ${requestToken}` } : {}),
      ...headers,
    },
    body,
  })

  let response = await noStoreFetch(`${API_BASE_URL}${requestPath}`, buildRequest(token))
  let payload = await response.json().catch(() => null)
  const usedAnonymous = jwtType(token) === 'anonymous'

  if (response.status === 401 && !path.startsWith('/auth/') && !usedAnonymous) {
    const refreshedAuth = await refreshStoredAuth()

    if (refreshedAuth?.accessToken) {
      response = await noStoreFetch(`${API_BASE_URL}${withUserCacheBuster(path)}`, buildRequest(refreshedAuth.accessToken))
      payload = await response.json().catch(() => null)
    }
  }

  if (!response.ok) {
    const rawMessage = payload?.message || payload?.error?.message
    const message = Array.isArray(rawMessage)
      ? rawMessage.filter(Boolean).join(' ')
      : rawMessage || 'No se pudo completar la solicitud.'
    const error = new Error(message)
    error.status = response.status
    error.payload = payload
    if (response.status === 401 && !path.startsWith('/auth/')) {
      if (usedAnonymous) {
        setStoredAnonymousAuth(null)
      } else {
        setStoredAuth(null)
      }
    }
    throw error
  }

  return payload
}

export const getApiBaseUrl = () => API_BASE_URL

export const onStoredAuthChange = (callback) => {
  const handler = (event) => callback(event.detail ?? getStoredAuth())
  window.addEventListener(authChangeEvent, handler)
  window.addEventListener('storage', handler)

  return () => {
    window.removeEventListener(authChangeEvent, handler)
    window.removeEventListener('storage', handler)
  }
}
