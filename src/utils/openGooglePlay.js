const DEFAULT_PACKAGE_ID = 'vote.musicmundial.com'

const DEFAULT_PLAY_URL =
  `https://play.google.com/store/apps/details?id=${DEFAULT_PACKAGE_ID}`

export const APP_STORE_URL =
  'https://apps.apple.com/us/app/music-mundial-vote/id6802404318'

const userAgent = () =>
  typeof navigator !== 'undefined' ? navigator.userAgent || '' : ''

export const isAndroidDevice = () => /Android/i.test(userAgent())

export const isAppleMobileDevice = () => {
  if (/iPhone|iPad|iPod/i.test(userAgent())) return true
  return (
    typeof navigator !== 'undefined' &&
    navigator.platform === 'MacIntel' &&
    Number(navigator.maxTouchPoints || 0) > 1
  )
}

export const showPlayStoreBadge = () => !isAppleMobileDevice()
export const showAppStoreBadge = () => !isAndroidDevice()

export const getPlayStorePackageId = (playStoreUrl = '') => {
  try {
    const parsed = new URL(String(playStoreUrl || DEFAULT_PLAY_URL).trim())
    const id = String(parsed.searchParams.get('id') || '').trim()
    if (id) return id
  } catch {
    // ignore
  }
  const match = String(playStoreUrl || '').match(/[?&]id=([^&#]+)/i)
  if (match?.[1]) return decodeURIComponent(match[1])
  return DEFAULT_PACKAGE_ID
}

export const normalizePlayStoreWebUrl = (playStoreUrl = '') => {
  const raw = String(playStoreUrl || '').trim()
  if (!raw) return DEFAULT_PLAY_URL
  try {
    const parsed = new URL(raw)
    if (!parsed.searchParams.get('id')) {
      parsed.searchParams.set('id', DEFAULT_PACKAGE_ID)
    }
    return parsed.toString()
  } catch {
    return DEFAULT_PLAY_URL
  }
}

/**
 * URL that prefers opening the Google Play *app* on Android,
 * with HTTPS web Play Store as fallback.
 */
export const getGooglePlayOpenUrl = (playStoreUrl = '') => {
  const webUrl = normalizePlayStoreWebUrl(playStoreUrl)
  const packageId = getPlayStorePackageId(webUrl)

  if (!isAndroidDevice()) {
    return webUrl
  }

  // Opens com.android.vending (Play Store app). Falls back to the web URL.
  return (
    `intent://details?id=${encodeURIComponent(packageId)}` +
    `#Intent;scheme=market;package=com.android.vending;` +
    `S.browser_fallback_url=${encodeURIComponent(webUrl)};end`
  )
}

export const openGooglePlay = (playStoreUrl = '') => {
  const openUrl = getGooglePlayOpenUrl(playStoreUrl)

  if (isAndroidDevice()) {
    window.location.href = openUrl
    return
  }

  window.open(normalizePlayStoreWebUrl(playStoreUrl), '_blank', 'noopener,noreferrer')
}

export const openAppStore = () => {
  window.open(APP_STORE_URL, '_blank', 'noopener,noreferrer')
}

export const openOfficialApp = (playStoreUrl = '') => {
  if (isAppleMobileDevice()) {
    openAppStore()
    return
  }
  openGooglePlay(playStoreUrl)
}
