const MEASUREMENT_IDS = ['G-MYCSLDGEHG', 'G-GSXPF4JEXS']
const PRIMARY_ID = MEASUREMENT_IDS[0]
const CONSENT_KEY = 'vmm_cookie_consent'
const CONSENT_CHANGE_EVENT = 'vmm-cookie-consent-change'
const SCRIPT_ID = 'vmm-gtag-js'

let started = false
let lastTrackedPath = ''

const readConsent = () => {
  try {
    return JSON.parse(window.localStorage.getItem(CONSENT_KEY) || 'null')
  } catch {
    return null
  }
}

const hasAnalyticsConsent = (consent = readConsent()) =>
  Boolean(Number(consent?.version) >= 3 && (consent?.mode === 'all' || consent?.analytics === true))

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
  script.src = `https://www.googletagmanager.com/gtag/js?id=${PRIMARY_ID}`
  document.head.appendChild(script)
}

export const trackPageView = (path = `${window.location.pathname}${window.location.search}`) => {
  if (!started || typeof window.gtag !== 'function') return
  if (path === lastTrackedPath) return
  lastTrackedPath = path

  window.gtag('event', 'page_view', {
    page_path: path,
    page_location: window.location.href,
    page_title: document.title,
    send_to: MEASUREMENT_IDS,
  })
}

export const enableGoogleAnalytics = () => {
  if (started || typeof window === 'undefined') return

  ensureGtag()
  loadScript()
  window.gtag('js', new Date())
  for (const id of MEASUREMENT_IDS) {
    window.gtag('config', id, {
      send_page_view: false,
      anonymize_ip: true,
    })
  }
  started = true
  lastTrackedPath = ''
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
