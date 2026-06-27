const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api'

const storageKey = 'vmm_api_auth'
const anonymousStorageKey = 'vmm_api_anonymous'
const authChangeEvent = 'vmm-api-auth-change'

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
    return JSON.parse(window.localStorage.getItem(anonymousStorageKey) || 'null')
  } catch {
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

export const apiRequest = async (path, {
  method = 'GET',
  body,
  token,
  headers = {},
} = {}) => {
  const response = await window.fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    const message = payload?.message || payload?.error?.message || 'No se pudo completar la solicitud.'
    const error = new Error(message)
    error.status = response.status
    error.payload = payload
    if (response.status === 401 && !path.startsWith('/auth/')) {
      setStoredAuth(null)
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
  const response = await window.fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body,
  })
  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    const message = payload?.message || payload?.error?.message || 'No se pudo completar la solicitud.'
    const error = new Error(message)
    error.status = response.status
    error.payload = payload
    if (response.status === 401 && !path.startsWith('/auth/')) {
      setStoredAuth(null)
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
