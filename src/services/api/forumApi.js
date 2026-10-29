import { apiRequest, getStoredAuth } from './client'
import { newsLocale } from './newsApi'

const withLocale = (path, locale) => {
  const url = new URL(path, window.location.origin)
  url.searchParams.set('locale', newsLocale(locale))
  return `${url.pathname}${url.search}`
}

const authToken = () => getStoredAuth()?.accessToken

export const getForumHome = (locale) => apiRequest(withLocale('/forum/home', locale))

export const getForumCategory = (slug, { page = 1, limit = 20, sort = 'activity', q = '', locale } = {}) => {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    sort,
    locale: newsLocale(locale),
  })
  if (q) params.set('q', q)
  return apiRequest(`/forum/categories/${encodeURIComponent(slug)}?${params.toString()}`)
}

export const getForumTopic = (id, { page = 1, locale } = {}) => {
  const params = new URLSearchParams({
    page: String(page),
    locale: newsLocale(locale),
  })
  return apiRequest(`/forum/topics/${encodeURIComponent(id)}?${params.toString()}`)
}

export const searchForum = (q, { page = 1, locale } = {}) => {
  const params = new URLSearchParams({
    q,
    page: String(page),
    locale: newsLocale(locale),
  })
  return apiRequest(`/forum/search?${params.toString()}`)
}

export const createForumTopic = (body, locale) =>
  apiRequest(withLocale('/forum/topics', locale), {
    method: 'POST',
    body,
    token: authToken(),
  })

export const createForumPost = (topicId, body) =>
  apiRequest(`/forum/topics/${encodeURIComponent(topicId)}/posts`, {
    method: 'POST',
    body,
    token: authToken(),
  })
