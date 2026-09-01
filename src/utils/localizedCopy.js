export const localeCode = (locale, fallback = 'es') => {
  const code = String(locale || fallback).trim().toLowerCase().split('-')[0]
  return code || fallback
}

export const pickLocalized = (map, locale, fallback = 'es') => {
  if (typeof map === 'string') return map
  if (!map || typeof map !== 'object' || Array.isArray(map)) return ''
  const code = localeCode(locale, fallback)
  return (
    map[code] ||
    map[fallback] ||
    map.es ||
    map.en ||
    Object.values(map).find((value) => typeof value === 'string' && value.trim()) ||
    ''
  )
}

export const pickLocalizedList = (map, locale, fallback = 'es') => {
  if (Array.isArray(map)) return map.filter(Boolean)
  if (!map || typeof map !== 'object') return []
  const code = localeCode(locale, fallback)
  const list = map[code] || map[fallback] || map.es || map.en || []
  return Array.isArray(list) ? list.filter(Boolean) : []
}
