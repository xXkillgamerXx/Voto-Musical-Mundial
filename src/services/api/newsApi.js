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
export const getNewsTag = (slug, { page = 1, limit = 12, locale } = {}) => {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    locale: newsLocale(locale),
  })
  return apiRequest(`/news/tags/${encodeURIComponent(slug)}?${params.toString()}`)
}
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
export const getNewsAuthor = (slug, { page = 1, limit = 18, locale } = {}) => {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    locale: newsLocale(locale),
  })
  return apiRequest(`/news/authors/${encodeURIComponent(slug)}?${params.toString()}`)
}
export const getNewsComments = (slug, locale) =>
  apiRequest(withLocale(`/news/posts/${encodeURIComponent(slug)}/comments`, locale), {
    token: getStoredAuth()?.accessToken,
  })
export const postNewsComment = (slug, text, locale, parentId, gif) =>
  apiRequest(withLocale(`/news/posts/${encodeURIComponent(slug)}/comments`, locale), {
    method: 'POST',
    body: {
      text: text || '',
      ...(parentId ? { parentId: String(parentId) } : {}),
      ...(gif?.url ? { gif: { url: String(gif.url), title: String(gif.title || '') } } : {}),
    },
    token: getStoredAuth()?.accessToken,
  })
export const voteNewsComment = (slug, commentId, value, locale) =>
  apiRequest(
    withLocale(`/news/posts/${encodeURIComponent(slug)}/comments/${encodeURIComponent(commentId)}/vote`, locale),
    {
      method: 'POST',
      body: { value },
      token: getStoredAuth()?.accessToken,
    },
  )
export const reactNewsComment = (slug, commentId, reaction, locale) =>
  apiRequest(
    withLocale(`/news/posts/${encodeURIComponent(slug)}/comments/${encodeURIComponent(commentId)}/react`, locale),
    {
      method: 'POST',
      body: { reaction },
      token: getStoredAuth()?.accessToken,
    },
  )
export const getNewsCommentReportOptions = (locale) =>
  apiRequest(withLocale('/news/comment-report-options', locale))
export const reportNewsComment = (slug, commentId, { reason, details } = {}, locale) =>
  apiRequest(
    withLocale(`/news/posts/${encodeURIComponent(slug)}/comments/${encodeURIComponent(commentId)}/report`, locale),
    {
      method: 'POST',
      body: { reason, details },
      token: getStoredAuth()?.accessToken,
    },
  )
export const getNewsPopular = ({ exclude = '', limit = 5, locale } = {}) => {
  const params = new URLSearchParams({
    locale: newsLocale(locale),
    limit: String(limit),
  })
  if (exclude) params.set('exclude', exclude)
  return apiRequest(`/news/popular?${params.toString()}`)
}
export const getNewsPage = (slug, locale) =>
  apiRequest(withLocale(`/news/pages/${encodeURIComponent(slug)}`, locale))
export const postNewsContact = (body) =>
  apiRequest('/news/contact', { method: 'POST', body })
