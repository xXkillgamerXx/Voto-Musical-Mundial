const ADSENSE_CLIENT = 'ca-pub-1078939545517246'
const ADSENSE_SRC = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`
const ADMIN_ROLES = new Set(['admin', 'superadmin', 'owner'])

const AD_SELECTOR = [
  'ins.adsbygoogle',
  '.google-auto-placed',
  '.adsbygoogle-noablate',
  '.grippy-host',
  '#google_vignette',
  '[id*="google_vignette"]',
  'iframe[id^="aswift_"]',
  'iframe[name^="aswift_"]',
  'iframe[id^="google_ads"]',
  'div[id^="google_ads_iframe"]',
  'div[id^="aswift_"]',
  'iframe[src*="googlesyndication.com"]',
  'iframe[src*="doubleclick.net"]',
  'iframe[src*="googleadservices.com"]',
].join(',')

const NO_ADS_CSS = `
html.mm-no-ads ins.adsbygoogle,
html.mm-no-ads .google-auto-placed,
html.mm-no-ads .adsbygoogle-noablate,
html.mm-no-ads .grippy-host,
html.mm-no-ads #google_vignette,
html.mm-no-ads [id*="google_vignette"],
html.mm-no-ads iframe[id^="aswift_"],
html.mm-no-ads iframe[name^="aswift_"],
html.mm-no-ads iframe[id^="google_ads"],
html.mm-no-ads div[id^="google_ads_iframe"],
html.mm-no-ads div[id^="aswift_"],
html.mm-no-ads iframe[src*="googlesyndication.com"],
html.mm-no-ads iframe[src*="doubleclick.net"],
html.mm-no-ads iframe[src*="googleadservices.com"] {
  display: none !important;
  visibility: hidden !important;
  height: 0 !important;
  max-height: 0 !important;
  min-height: 0 !important;
  overflow: hidden !important;
  pointer-events: none !important;
}
`

let observer = null
let active = false
let sweeping = false
let scheduled = false
let sweepTimers = []

const clearSweepTimers = () => {
  sweepTimers.forEach((id) => window.clearTimeout(id))
  sweepTimers = []
}

export const isSiteAdminPath = (pathname = '/') => {
  const parts = String(pathname || '/')
    .split('?')[0]
    .split('#')[0]
    .split('/')
    .filter(Boolean)
  if (parts[0] === 'es' || parts[0] === 'en') parts.shift()
  if (parts[0] === 'vote') parts.shift()
  if (parts[0] === 'es' || parts[0] === 'en') parts.shift()
  return parts[0] === 'admin'
}

const jwtRole = (token) => {
  try {
    const payloadPart = String(token || '').split('.')[1]
    if (!payloadPart) return ''
    const normalized = payloadPart.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
    const payload = JSON.parse(window.atob(padded))
    return String(payload?.role || '').trim().toLowerCase()
  } catch {
    return ''
  }
}

export const isStoredAdminUser = () => {
  if (typeof window === 'undefined') return false
  try {
    const auth = JSON.parse(window.localStorage.getItem('vmm_api_auth') || 'null')
    const role = String(auth?.user?.role || jwtRole(auth?.accessToken) || '').trim().toLowerCase()
    return ADMIN_ROLES.has(role)
  } catch {
    return false
  }
}

const ensureStyle = () => {
  if (document.getElementById('mm-no-ads-style')) return
  const style = document.createElement('style')
  style.id = 'mm-no-ads-style'
  style.textContent = NO_ADS_CSS
  document.head.appendChild(style)
}

const pauseAds = (paused) => {
  const ads = (window.adsbygoogle = window.adsbygoogle || [])
  ads.pauseAdRequests = paused ? 1 : 0
}

const removeAdNodes = () => {
  if (sweeping || !active) return
  sweeping = true
  try {
    document.querySelectorAll(AD_SELECTOR).forEach((node) => {
      const host = node.closest?.('.google-auto-placed, .adsbygoogle-noablate') || node
      host.remove()
    })
  } finally {
    sweeping = false
  }
}

const scheduleSweep = () => {
  if (scheduled || !active) return
  scheduled = true
  window.requestAnimationFrame(() => {
    scheduled = false
    removeAdNodes()
  })
}

const looksLikeAd = (node) => {
  if (!(node instanceof Element)) return false
  if (node.matches?.(AD_SELECTOR)) return true
  return Boolean(node.querySelector?.(AD_SELECTOR))
}

const ensureAdSense = () => {
  if (document.querySelector('script[src*="pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"]')) return
  const script = document.createElement('script')
  script.async = true
  script.crossOrigin = 'anonymous'
  script.src = ADSENSE_SRC
  document.head.appendChild(script)
}

export const setAdminAdsSuppressed = (suppressed, { restoreScript = false } = {}) => {
  if (typeof document === 'undefined') return
  ensureStyle()
  active = Boolean(suppressed)
  document.documentElement.classList.toggle('mm-no-ads', active)
  pauseAds(active)
  if (active) {
    removeAdNodes()
    clearSweepTimers()
    sweepTimers = [400, 1200, 3000].map((ms) => window.setTimeout(removeAdNodes, ms))
    if (!observer) {
      observer = new MutationObserver((mutations) => {
        if (!active) return
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) {
            if (looksLikeAd(node)) {
              scheduleSweep()
              return
            }
          }
        }
      })
      observer.observe(document.documentElement, { childList: true, subtree: true })
    }
    return
  }
  clearSweepTimers()
  observer?.disconnect()
  observer = null
  if (restoreScript && !isStoredAdminUser() && !isSiteAdminPath(window.location.pathname)) {
    ensureAdSense()
  }
}
