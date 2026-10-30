import { ref } from 'vue'

export const COOKIE_CONSENT_KEY = 'vmm_cookie_consent'
export const COOKIE_CONSENT_EVENT = 'vmm-cookie-consent-change'
export const COOKIE_CONSENT_VERSION = 3

export const readCookieConsent = () => {
  if (typeof window === 'undefined') return null
  try {
    return JSON.parse(window.localStorage.getItem(COOKIE_CONSENT_KEY) || 'null')
  } catch {
    return null
  }
}

const isCurrentConsent = (consent = readCookieConsent()) =>
  Number(consent?.version) >= COOKIE_CONSENT_VERSION

export const hasAdCookieConsent = (consent = readCookieConsent()) =>
  isCurrentConsent(consent) && (consent?.mode === 'all' || consent?.ads === true)

export const hasAnalyticsCookieConsent = (consent = readCookieConsent()) =>
  isCurrentConsent(consent) && (consent?.mode === 'all' || consent?.analytics === true)

export const hasPushCookieConsent = (consent = readCookieConsent()) =>
  isCurrentConsent(consent) && (consent?.mode === 'all' || consent?.pushPrompt === true)

export const adCookieConsent = ref(typeof window !== 'undefined' && hasAdCookieConsent())

if (typeof window !== 'undefined') {
  window.addEventListener(COOKIE_CONSENT_EVENT, (event) => {
    adCookieConsent.value = hasAdCookieConsent(event?.detail || readCookieConsent())
  })
}
