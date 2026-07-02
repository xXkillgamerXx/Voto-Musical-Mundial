const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || ''
const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
const MOCK_WIDGET_ID_PREFIX = 'mock-turnstile-'
export const DEV_TURNSTILE_MOCK_TOKEN = 'dev-turnstile-mock-token'

let scriptPromise = null
const mockWidgets = new Map()

export const isTurnstileMocked = () => import.meta.env.DEV && !SITE_KEY

export const isTurnstileEnabled = () => Boolean(SITE_KEY) || isTurnstileMocked()

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

const renderMockWidget = (container, { onSuccess = () => {}, onExpired = () => {} } = {}) => {
  const widgetId = `${MOCK_WIDGET_ID_PREFIX}${Date.now()}`
  container.innerHTML = `
    <label class="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-600/80 bg-[#1b2433] px-4 py-3 shadow-inner">
      <input type="checkbox" class="size-5 rounded border-slate-500 accent-emerald-400" data-turnstile-mock-input />
      <span class="min-w-0">
        <span class="block text-sm font-semibold text-slate-100">Verifica que eres humano</span>
        <span class="mt-0.5 block text-xs text-slate-400">Modo local: Cloudflare Turnstile simulado</span>
      </span>
    </label>
  `

  const input = container.querySelector('[data-turnstile-mock-input]')
  const handler = () => {
    if (input?.checked) {
      onSuccess(DEV_TURNSTILE_MOCK_TOKEN)
      return
    }
    onExpired()
  }

  input?.addEventListener('change', handler)
  mockWidgets.set(widgetId, { input, handler })
  return widgetId
}

export const renderTurnstileWidget = async (container, {
  onSuccess = () => {},
  onError = () => {},
  onExpired = () => {},
} = {}) => {
  if (!container) return null

  if (isTurnstileMocked()) {
    container.innerHTML = ''
    return renderMockWidget(container, { onSuccess, onExpired })
  }

  if (!SITE_KEY) return null

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
  if (typeof widgetId === 'string' && widgetId.startsWith(MOCK_WIDGET_ID_PREFIX)) {
    const entry = mockWidgets.get(widgetId)
    if (entry?.input) {
      entry.input.checked = false
      entry.input.dispatchEvent(new Event('change'))
    }
    return
  }

  if (!window.turnstile || widgetId === null || widgetId === undefined) return
  window.turnstile.reset(widgetId)
}

export const removeTurnstileWidget = (widgetId) => {
  if (typeof widgetId === 'string' && widgetId.startsWith(MOCK_WIDGET_ID_PREFIX)) {
    const entry = mockWidgets.get(widgetId)
    if (entry?.input && entry.handler) {
      entry.input.removeEventListener('change', entry.handler)
    }
    mockWidgets.delete(widgetId)
    return
  }

  if (!window.turnstile || widgetId === null || widgetId === undefined) return
  window.turnstile.remove(widgetId)
}
