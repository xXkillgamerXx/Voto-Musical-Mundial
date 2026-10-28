import { apiRequest, getStoredAuth } from './client'

export const newsLocale = (locale) => {
  if (locale === 'en' || locale === 'es') return locale
  const first = window.location.pathname.split('/').filter(Boolean)[0]
  return first === 'es' ? 'es' : 'en'
}

const withLocale = (path, locale) => {
  const url = new URL(path, window.location.origin)
  url.searchParams.set('locale', newsLocale(locale))
  return `${url.pathname}${url.search}`
}

export const getNewsHome = (locale) => apiRequest(withLocale('/news/home', locale))
export const getNewsCategories = (locale) => apiRequest(withLocale('/news/categories', locale))
export const getNewsPosts = ({ page = 1, limit = 12, category = '', q = '', locale } = {}) => {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    locale: newsLocale(locale),
  })
  if (category) params.set('category', category)
  if (q) params.set('q', q)
  return apiRequest(`/news/posts?${params.toString()}`)
}
export const getNewsPost = (slug, locale) =>
  apiRequest(withLocale(`/news/posts/${encodeURIComponent(slug)}`, locale))
export const getNewsComments = (slug, locale) =>
  apiRequest(withLocale(`/news/posts/${encodeURIComponent(slug)}/comments`, locale))
export const postNewsComment = (slug, text, locale) =>
  apiRequest(withLocale(`/news/posts/${encodeURIComponent(slug)}/comments`, locale), {
    method: 'POST',
    body: { text },
    token: getStoredAuth()?.accessToken,
  })
export const getNewsPopular = ({ exclude = '', limit = 5, locale } = {}) => {
  const params = new URLSearchParams({
    locale: newsLocale(locale),
    limit: String(limit),
  })
  if (exclude) params.set('exclude', exclude)
  return apiRequest(`/news/popular?${params.toString()}`)
}
