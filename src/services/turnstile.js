const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || ''
const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
const TOKEN_TIMEOUT_MS = 30000

let scriptPromise = null
let widgetId = null
let containerEl = null
let pendingResolve = null
let pendingReject = null

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

const settleResolve = (token) => {
  if (pendingResolve) {
    const resolve = pendingResolve
    pendingResolve = null
    pendingReject = null
    resolve(token)
  }
}

const settleReject = (error) => {
  if (pendingReject) {
    const reject = pendingReject
    pendingResolve = null
    pendingReject = null
    reject(error)
  }
}

const ensureWidget = () => {
  if (widgetId !== null) return

  containerEl = document.createElement('div')
  // Off-screen but rendered; Cloudflare shows an interactive overlay only when needed.
  containerEl.style.position = 'fixed'
  containerEl.style.bottom = '12px'
  containerEl.style.right = '12px'
  containerEl.style.zIndex = '2147483647'
  document.body.appendChild(containerEl)

  widgetId = window.turnstile.render(containerEl, {
    sitekey: SITE_KEY,
    appearance: 'interaction-only',
    execution: 'execute',
    callback: (token) => settleResolve(token),
    'error-callback': () => {
      settleReject(new Error('turnstile-error'))
      return true
    },
    'expired-callback': () => settleReject(new Error('turnstile-expired')),
  })
}

/**
 * Resolves with a fresh single-use Turnstile token, prompting the user only if required.
 * Returns null when Turnstile is not configured (feature disabled).
 */
export const getTurnstileToken = async () => {
  if (!SITE_KEY) return null

  await loadScript()
  ensureWidget()

  // Reject any in-flight request so we only ever track one at a time.
  settleReject(new Error('turnstile-superseded'))

  return new Promise((resolve, reject) => {
    pendingResolve = resolve
    pendingReject = reject

    const timeout = window.setTimeout(() => {
      settleReject(new Error('turnstile-timeout'))
    }, TOKEN_TIMEOUT_MS)

    const wrappedResolve = (token) => {
      window.clearTimeout(timeout)
      resolve(token)
    }
    const wrappedReject = (error) => {
      window.clearTimeout(timeout)
      reject(error)
    }
    pendingResolve = wrappedResolve
    pendingReject = wrappedReject

    try {
      window.turnstile.reset(widgetId)
      window.turnstile.execute(widgetId)
    } catch (error) {
      wrappedReject(error)
    }
  })
}
