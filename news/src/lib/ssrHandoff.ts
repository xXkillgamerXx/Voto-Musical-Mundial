const READY_CLASS = 'news-spa-ready'
const FALLBACK_MS = 10000

export const hasSsrShell = () => typeof document !== 'undefined' && Boolean(document.getElementById('news-ssr'))

/** Swap the server-rendered page for the SPA in one frame. */
export const markNewsSpaReady = () => {
  if (typeof document === 'undefined') return
  const ssr = document.getElementById('news-ssr')
  const app = document.getElementById('app')
  // Lock height during the swap so the article does not jump when chrome differs.
  if (ssr && app) {
    const height = Math.max(ssr.getBoundingClientRect().height, window.innerHeight)
    app.style.minHeight = `${Math.round(height)}px`
  }
  document.documentElement.classList.add(READY_CLASS)
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      if (app) app.style.minHeight = ''
    })
  })
}

/** Wait for the SPA cover to decode so the swap never flashes an empty frame. */
export const handoffWhenImageReady = async (selector: string, timeoutMs = 3000) => {
  if (!hasSsrShell() || document.documentElement.classList.contains(READY_CLASS)) {
    markNewsSpaReady()
    return
  }
  const img = document.querySelector<HTMLImageElement>(`#app ${selector}`)
  if (img && !img.complete) {
    await Promise.race([
      img.decode().catch(() => undefined),
      new Promise((resolve) => window.setTimeout(resolve, timeoutMs)),
    ])
  }
  markNewsSpaReady()
}

/** Pages without a server shell show immediately; shells get a safety net. */
export const startSsrHandoff = () => {
  if (!hasSsrShell()) {
    markNewsSpaReady()
    return
  }
  window.setTimeout(markNewsSpaReady, FALLBACK_MS)
}
