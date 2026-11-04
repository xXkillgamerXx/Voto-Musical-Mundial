export const GA_MEASUREMENT_ID = 'G-MYCSLDGEHG'

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

let lastTrackedPath = ''

const gtagReady = () => typeof window.gtag === 'function'

/** SPA pageview for every Music Mundial route (home, posts, categories, forum, static, profile, etc.). */
export const trackPageView = (title = document.title, url = window.location.href) => {
  if (!gtagReady()) return

  const path = `${window.location.pathname}${window.location.search}`
  if (path === lastTrackedPath) return
  lastTrackedPath = path

  window.gtag?.('event', 'page_view', {
    page_title: title,
    page_location: url,
    page_path: path,
    send_to: GA_MEASUREMENT_ID,
  })
}

/** After cookie consent enables gtag, force a hit for the current URL. */
export const trackCurrentPage = (opts?: { force?: boolean }) => {
  if (opts?.force) lastTrackedPath = ''
  trackPageView(document.title, window.location.href)
}
