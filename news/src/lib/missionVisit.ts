/**
 * Vote mission visit tracker for Music Mundial (news SPA).
 * Captures ?vmm= token from Vote "Hacer misión" links and reports page views
 * so visit_page missions can award points.
 */

const STORAGE_KEY = 'vmm_mission_visit_token'

const apiBase = () => {
  const configured = String((window as Window & { VMM_MISSION_API?: string }).VMM_MISSION_API || '').trim()
  if (configured) return configured.replace(/\/$/, '')
  // Same-origin /api (prod nginx + local Vite proxy → Nest).
  return `${window.location.origin}/api`
}

const currentPageUrl = () => {
  const params = new URLSearchParams(window.location.search || '')
  params.delete('vmm')
  return (
    window.location.origin +
    window.location.pathname +
    (params.toString() ? `?${params.toString()}` : '')
  )
}

const readTokenFromQuery = () => {
  try {
    const params = new URLSearchParams(window.location.search || '')
    const token = String(params.get('vmm') || '').trim()
    if (!token) return ''

    try {
      window.sessionStorage.setItem(STORAGE_KEY, token)
    } catch {
      /* ignore */
    }

    params.delete('vmm')
    const clean =
      window.location.pathname + (params.toString() ? `?${params.toString()}` : '') + window.location.hash
    window.history.replaceState({}, '', clean)
    return token
  } catch {
    return ''
  }
}

const storedToken = () => {
  try {
    return String(window.sessionStorage.getItem(STORAGE_KEY) || '').trim()
  } catch {
    return ''
  }
}

const reportWithToken = (token: string, pageUrl: string) => {
  if (!token || !pageUrl) return
  const img = new Image()
  img.referrerPolicy = 'no-referrer-when-downgrade'
  img.src = `${apiBase()}/missions/visit?t=${encodeURIComponent(token)}&u=${encodeURIComponent(pageUrl)}`
}

const reportAuthenticated = async (pageUrl: string) => {
  try {
    const raw = localStorage.getItem('vmm_api_auth')
    if (!raw) return
    const auth = JSON.parse(raw) as {
      accessToken?: string
      user?: { isAnonymous?: boolean }
    }
    if (!auth?.accessToken || auth?.user?.isAnonymous) return

    await fetch(`${apiBase()}/missions/visit-progress`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${auth.accessToken}`,
      },
      body: JSON.stringify({ pageUrl }),
      credentials: 'omit',
    })
  } catch {
    /* best-effort */
  }
}

let lastReported = ''

/** Call on each news route change (and initial load). */
export const reportMissionPageVisit = () => {
  if (typeof window === 'undefined') return

  const fromQuery = readTokenFromQuery()
  const token = fromQuery || storedToken()
  const pageUrl = currentPageUrl()

  // Always report token path when present (mission started from Vote).
  if (token) {
    // Deduplicate identical page+token bursts from double syncs.
    const key = `t:${token}:${pageUrl}`
    if (key !== lastReported) {
      lastReported = key
      reportWithToken(token, pageUrl)
    }
  }

  // If the reader is also logged into Vote on this browser, count host missions too.
  void reportAuthenticated(pageUrl)
}
