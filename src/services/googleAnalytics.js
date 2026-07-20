const MEASUREMENT_ID = 'G-GSXPF4JEXS'
const CONSENT_KEY = 'vmm_cookie_consent'
const CONSENT_CHANGE_EVENT = 'vmm-cookie-consent-change'
const SCRIPT_ID = 'vmm-gtag-js'

let started = false

const readConsent = () => {
  try {
    return JSON.parse(window.localStorage.getItem(CONSENT_KEY) || 'null')
  } catch {
    return null
  }
}

const hasAnalyticsConsent = (consent = readConsent()) =>
  Boolean(consent?.mode === 'all' || consent?.analytics === true)

const ensureGtag = () => {
  window.dataLayer = window.dataLayer || []
  if (typeof window.gtag !== 'function') {
    window.gtag = function gtag() {
      window.dataLayer.push(arguments)
    }
  }
}

const loadScript = () => {
  if (document.getElementById(SCRIPT_ID)) return

  const script = document.createElement('script')
  script.id = SCRIPT_ID
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`
  document.head.appendChild(script)
}

export const trackPageView = (path = window.location.pathname) => {
  if (!started || typeof window.gtag !== 'function') return

  window.gtag('event', 'page_view', {
    page_path: path,
    page_location: window.location.href,
    page_title: document.title,
  })
}

export const enableGoogleAnalytics = () => {
  if (started || typeof window === 'undefined') return

  ensureGtag()
  loadScript()
  window.gtag('js', new Date())
  window.gtag('config', MEASUREMENT_ID, {
    send_page_view: false,
  })
  started = true
  trackPageView()
}

export const initGoogleAnalytics = () => {
  if (typeof window === 'undefined') return

  const applyConsent = (consent) => {
    if (hasAnalyticsConsent(consent)) {
      enableGoogleAnalytics()
    }
  }

  applyConsent(readConsent())
  window.addEventListener(CONSENT_CHANGE_EVENT, (event) => {
    applyConsent(event.detail || readConsent())
  })
}
