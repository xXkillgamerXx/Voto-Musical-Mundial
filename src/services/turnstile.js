const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || ''
const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

let scriptPromise = null

export const isTurnstileEnabled = () => Boolean(SITE_KEY)

const loadScript = () => {
  if (window.turnstile) return Promise.resolve()
  if (scriptPromise) return scriptPromise

  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SCRIPT_SRC
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => {
      scriptPromise = null
      reject(new Error('turnstile-script-failed'))
    }
    document.head.appendChild(script)
  })

  return scriptPromise
}

export const renderTurnstileWidget = async (container, {
  onSuccess = () => {},
  onError = () => {},
  onExpired = () => {},
} = {}) => {
  if (!SITE_KEY || !container) return null
  await loadScript()

  container.innerHTML = ''
  return window.turnstile.render(container, {
    sitekey: SITE_KEY,
    appearance: 'always',
    theme: 'dark',
    callback: onSuccess,
    'error-callback': () => {
      onError()
      return true
    },
    'expired-callback': onExpired,
  })
}

export const resetTurnstileWidget = (widgetId) => {
  if (!window.turnstile || widgetId === null || widgetId === undefined) return
  window.turnstile.reset(widgetId)
}

export const removeTurnstileWidget = (widgetId) => {
  if (!window.turnstile || widgetId === null || widgetId === undefined) return
  window.turnstile.remove(widgetId)
}
