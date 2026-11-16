/**
 * Vote mission visit tracker for Music Mundial (news SPA).
 * With ?vmm= token: show a 20s reading panel, then report the visit.
 */

const STORAGE_KEY = 'vmm_mission_visit_token'
const DEFAULT_DWELL_SECONDS = 20
const PANEL_ID = 'vmm-mission-dwell'

type VisitUpdate = {
  awarded?: boolean
  isNewPage?: boolean
  progress?: number
  target?: number
  rewardPoints?: number
  title?: string
  dwellSeconds?: number
}

type DwellController = {
  key: string
  stop: () => void
}

declare global {
  interface Window {
    VMM_MISSION_API?: string
    __vmmMissionDwell?: DwellController | null
  }
}

const apiBase = () => {
  const configured = String(window.VMM_MISSION_API || '').trim()
  if (configured) return configured.replace(/\/$/, '')
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

const isSpanish = () =>
  window.location.pathname === '/es' || window.location.pathname.startsWith('/es/')

const noticeCopy = (update: VisitUpdate) => {
  const spanish = isSpanish()
  const progress = Math.max(0, Number(update.progress || 0))
  const target = Math.max(1, Number(update.target || 1))
  const done = Boolean(update.awarded) || progress >= target
  const points = Math.max(0, Number(update.rewardPoints || 0))
  if (done) {
    return spanish
      ? {
          title: 'Misión completada',
          text: points > 0 ? `Esta nota ya cuenta. Sumaste ${points} puntos.` : 'Esta nota ya cuenta para tu misión.',
        }
      : {
          title: 'Mission completed',
          text: points > 0 ? `This page counted. You earned ${points} points.` : 'This page counted toward your mission.',
        }
  }
  return spanish
    ? { title: 'Misión en progreso', text: `Llevas ${progress} de ${target} páginas.` }
    : { title: 'Mission progress', text: `${progress} of ${target} pages so far.` }
}

/** One loud card per page. The early script and the SPA share this lock. */
export const showMissionNotice = (update: VisitUpdate) => {
  const progress = Number(update.progress || 0)
  const target = Math.max(1, Number(update.target || 1))
  if (!update.awarded && !update.isNewPage) return

  const pageKey = `${window.location.pathname}`
  const lock = `vmm_mission_notice:${pageKey}`
  try {
    if (window.sessionStorage.getItem(lock)) return
    window.sessionStorage.setItem(lock, '1')
  } catch {
    if (document.getElementById('vmm-mission-notice')) return
  }

  const copy = noticeCopy(update)
  const done = Boolean(update.awarded) || progress >= target
  const root = document.createElement('div')
  root.id = 'vmm-mission-notice'
  root.setAttribute('role', 'status')
  root.style.cssText = [
    'position:fixed',
    'left:50%',
    'bottom:28px',
    'transform:translateX(-50%)',
    'z-index:100000',
    'width:min(560px,calc(100% - 28px))',
    'display:flex',
    'gap:14px',
    'align-items:flex-start',
    'padding:18px 18px 18px 16px',
    'border-radius:22px',
    'color:#fff',
    'background:' + (done ? '#064e3b' : '#7c2d12'),
    'border:3px solid ' + (done ? '#34d399' : '#fdba74'),
    'box-shadow:0 22px 50px rgba(0,0,0,.38)',
    'font-family:DM Sans,Manrope,sans-serif',
  ].join(';')

  const mark = document.createElement('div')
  mark.textContent = done ? '✓' : `${progress}`
  mark.style.cssText = [
    'flex:0 0 auto',
    'width:46px',
    'height:46px',
    'border-radius:16px',
    'display:grid',
    'place-items:center',
    'font-weight:800',
    'font-size:22px',
    'background:rgba(255,255,255,.14)',
  ].join(';')

  const body = document.createElement('div')
  body.style.cssText = 'min-width:0;flex:1'
  const heading = document.createElement('p')
  heading.textContent = copy.title
  heading.style.cssText = 'margin:0;font-size:20px;font-weight:800;letter-spacing:-.02em'
  const detail = document.createElement('p')
  detail.textContent = copy.text
  detail.style.cssText = 'margin:4px 0 0;font-size:15px;font-weight:600;line-height:1.35;color:rgba(255,255,255,.88)'
  body.append(heading, detail)

  const close = document.createElement('button')
  close.type = 'button'
  close.textContent = '×'
  close.setAttribute('aria-label', 'Cerrar')
  close.style.cssText = [
    'border:0',
    'background:transparent',
    'color:#fff',
    'font-size:28px',
    'line-height:1',
    'cursor:pointer',
    'padding:0 2px',
  ].join(';')
  const remove = () => root.remove()
  close.addEventListener('click', remove)
  window.setTimeout(remove, 8000)

  root.append(mark, body, close)
  document.body.appendChild(root)
}

const reportWithToken = async (token: string, pageUrl: string) => {
  if (!token || !pageUrl) return
  try {
    const response = await fetch(`${apiBase()}/missions/visit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, pageUrl }),
      credentials: 'omit',
    })
    if (!response.ok) return
    const payload = (await response.json()) as VisitUpdate
    showMissionNotice(payload)
  } catch {
    /* best-effort */
  }
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

    const response = await fetch(`${apiBase()}/missions/visit-progress`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${auth.accessToken}`,
      },
      body: JSON.stringify({ pageUrl }),
      credentials: 'omit',
    })
    if (!response.ok) return
    const payload = (await response.json()) as { updates?: VisitUpdate[] }
    const updates = Array.isArray(payload.updates) ? payload.updates : []
    const match = updates.find((row) => row.awarded || row.isNewPage)
    if (match) showMissionNotice(match)
  } catch {
    /* best-effort */
  }
}

const removeDwellPanel = () => {
  document.getElementById(PANEL_ID)?.remove()
}

const ensureDwellPanel = (totalSeconds: number) => {
  removeDwellPanel()
  const spanish = isSpanish()
  const root = document.createElement('div')
  root.id = PANEL_ID
  root.setAttribute('role', 'status')
  root.setAttribute('aria-live', 'polite')
  root.style.cssText = [
    'position:fixed',
    'left:50%',
    'bottom:0',
    'transform:translateX(-50%) translateY(110%)',
    'z-index:99999',
    'width:min(560px,calc(100% - 20px))',
    'margin:0 0 16px',
    'padding:16px 18px 14px',
    'border-radius:22px 22px 18px 18px',
    'color:#fff',
    'background:linear-gradient(165deg,#111827 0%,#1e3a5f 55%,#0f766e 140%)',
    'border:2px solid rgba(125,211,252,.45)',
    'box-shadow:0 18px 48px rgba(0,0,0,.42)',
    'font-family:DM Sans,Manrope,sans-serif',
    'transition:transform .45s cubic-bezier(.22,1,.36,1)',
  ].join(';')

  const title = document.createElement('p')
  title.textContent = spanish ? 'Misión: lee la nota' : 'Mission: read the article'
  title.style.cssText = 'margin:0;font-size:17px;font-weight:800;letter-spacing:-.02em'

  const detail = document.createElement('p')
  detail.dataset.role = 'detail'
  detail.textContent = spanish
    ? `Quédate en esta página ${totalSeconds} segundos para que cuente.`
    : `Stay on this page for ${totalSeconds} seconds so it counts.`
  detail.style.cssText =
    'margin:6px 0 12px;font-size:14px;font-weight:600;line-height:1.35;color:rgba(255,255,255,.86)'

  const track = document.createElement('div')
  track.style.cssText =
    'height:10px;border-radius:999px;background:rgba(255,255,255,.16);overflow:hidden'

  const fill = document.createElement('div')
  fill.dataset.role = 'fill'
  fill.style.cssText =
    'height:100%;width:0%;border-radius:inherit;background:linear-gradient(90deg,#67e8f9,#34d399);transition:width .2s linear'

  const clock = document.createElement('p')
  clock.dataset.role = 'clock'
  clock.textContent = `${totalSeconds}s`
  clock.style.cssText =
    'margin:10px 0 0;font-size:13px;font-weight:800;letter-spacing:.04em;color:#a5f3fc;text-align:right'

  track.appendChild(fill)
  root.append(title, detail, track, clock)
  document.body.appendChild(root)
  window.requestAnimationFrame(() => {
    root.style.transform = 'translateX(-50%) translateY(0)'
  })
  return root
}

const startTokenDwell = (token: string, pageUrl: string, dwellSeconds = DEFAULT_DWELL_SECONDS) => {
  const key = `t:${token}:${pageUrl}`
  const existing = window.__vmmMissionDwell
  if (existing?.key === key) return
  existing?.stop()

  const totalMs = Math.max(1, Math.round(dwellSeconds * 1000))
  const panel = ensureDwellPanel(dwellSeconds)
  const fill = panel.querySelector('[data-role="fill"]') as HTMLElement | null
  const clock = panel.querySelector('[data-role="clock"]') as HTMLElement | null
  const detail = panel.querySelector('[data-role="detail"]') as HTMLElement | null
  const spanish = isSpanish()

  let visibleMs = 0
  let lastTick = document.visibilityState === 'visible' ? Date.now() : 0
  let finished = false
  let timerId = 0

  const stop = () => {
    window.clearInterval(timerId)
    if (window.__vmmMissionDwell?.key === key) window.__vmmMissionDwell = null
    removeDwellPanel()
  }

  const finish = () => {
    if (finished) return
    finished = true
    window.clearInterval(timerId)
    if (fill) fill.style.width = '100%'
    if (clock) clock.textContent = spanish ? 'Listo' : 'Done'
    if (detail) {
      detail.textContent = spanish
        ? 'Gracias. Registrando la visita…'
        : 'Thanks. Saving your visit…'
    }
    void reportWithToken(token, pageUrl).finally(() => {
      window.setTimeout(() => {
        if (window.__vmmMissionDwell?.key === key) window.__vmmMissionDwell = null
        removeDwellPanel()
      }, 700)
    })
  }

  const onVisibility = () => {
    const now = Date.now()
    if (document.visibilityState === 'visible') {
      lastTick = now
      if (detail) {
        detail.textContent = spanish
          ? `Quédate en esta página ${dwellSeconds} segundos para que cuente.`
          : `Stay on this page for ${dwellSeconds} seconds so it counts.`
      }
    } else if (lastTick) {
      visibleMs += now - lastTick
      lastTick = 0
      if (detail) {
        detail.textContent = spanish
          ? 'Pausado: vuelve a esta pestaña para seguir contando.'
          : 'Paused: return to this tab to keep counting.'
      }
    }
  }

  document.addEventListener('visibilitychange', onVisibility)
  timerId = window.setInterval(() => {
    const now = Date.now()
    if (document.visibilityState === 'visible' && lastTick) {
      visibleMs += now - lastTick
      lastTick = now
    }
    const ratio = Math.min(1, visibleMs / totalMs)
    const left = Math.max(0, Math.ceil((totalMs - visibleMs) / 1000))
    if (fill) fill.style.width = `${Math.round(ratio * 100)}%`
    if (clock) clock.textContent = left > 0 ? `${left}s` : spanish ? 'Listo' : 'Done'
    if (visibleMs >= totalMs) {
      document.removeEventListener('visibilitychange', onVisibility)
      finish()
    }
  }, 200)

  window.__vmmMissionDwell = {
    key,
    stop: () => {
      document.removeEventListener('visibilitychange', onVisibility)
      stop()
    },
  }
}

let lastAuthenticatedPage = ''

/** Call on each news route change (and initial load). */
export const reportMissionPageVisit = () => {
  if (typeof window === 'undefined') return

  const fromQuery = readTokenFromQuery()
  const token = fromQuery || storedToken()
  const pageUrl = currentPageUrl()

  // Token path: require ~20s of visible reading before crediting the page.
  if (token) {
    startTokenDwell(token, pageUrl, DEFAULT_DWELL_SECONDS)
  }

  // Host / logged-in browsing still counts page views without the curtain.
  if (pageUrl !== lastAuthenticatedPage) {
    lastAuthenticatedPage = pageUrl
    void reportAuthenticated(pageUrl)
  }
}
