const DEFAULT_INSTAGRAM_HANDLE = 'musicmundial_awards'

const cleanHandle = (value) =>
  String(value || '')
    .trim()
    .replace(/^[@#]+/, '')
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
    .replace(/\/.*$/, '')
    .replace(/[^a-zA-Z0-9._]/g, '')

export const getCertificateInstagramHandle = () => {
  const fromEnv = cleanHandle(
    import.meta.env.VITE_INSTAGRAM_HANDLE ||
      import.meta.env.VITE_INSTAGRAM_URL ||
      '',
  )
  return fromEnv || DEFAULT_INSTAGRAM_HANDLE
}

export const formatCertificateInstagramTag = (handle) => {
  const cleaned = cleanHandle(handle) || DEFAULT_INSTAGRAM_HANDLE
  return `#${cleaned}`
}
