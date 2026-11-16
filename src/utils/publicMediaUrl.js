/**
 * Normalize stored profile/media URLs so news + vote show the same files.
 * Old rows often have http://vote.musicmundial.com/uploads/... (dead host / mixed content).
 */
export const publicMediaUrl = (raw) => {
  const value = String(raw || '').trim()
  if (!value) return ''

  if (value.startsWith('/')) {
    return value.replace(/^\/vote(?=\/)/, '') || value
  }

  try {
    const url = new URL(value)
    const host = url.hostname.toLowerCase()
    const ours =
      host === 'vote.musicmundial.com' ||
      host === 'www.musicmundial.com' ||
      host === 'musicmundial.com' ||
      host === '161.97.154.152' ||
      host === 'localhost' ||
      host === '127.0.0.1' ||
      /^\d+\.\d+\.\d+\.\d+$/.test(host)

    if (!ours) return value

    const path = `${url.pathname || ''}${url.search || ''}`.replace(/^\/vote(?=\/)/, '')
    return path || value
  } catch {
    return value
  }
}
