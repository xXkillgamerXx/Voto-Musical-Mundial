import { apiRequest, getStoredAuth } from './client'

const authToken = () => getStoredAuth()?.accessToken

const normalizeCommentsPayload = (payload, fallbackLimit = 20) => {
  if (Array.isArray(payload)) {
    return {
      items: payload,
      total: payload.length,
      sort: 'latest',
      hasMore: payload.length >= fallbackLimit,
    }
  }

  const items = Array.isArray(payload?.items)
    ? payload.items
    : Array.isArray(payload?.comments)
      ? payload.comments
      : []
  const total = Number(payload?.total)
  return {
    items,
    total: Number.isFinite(total) ? total : items.length,
    sort: String(payload?.sort || 'latest'),
    hasMore: Boolean(
      payload?.hasMore
      ?? (Number.isFinite(total) ? items.length + Number(payload?.offset || 0) < total : false),
    ),
  }
}

export const getPollComments = async (pollId, { limit = 20, offset = 0, sort = 'latest' } = {}) => {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
    sort: String(sort || 'latest'),
  })
  const payload = await apiRequest(
    `/polls/${encodeURIComponent(pollId)}/comments?${params.toString()}`,
    { token: authToken() },
  )
  return normalizeCommentsPayload(payload, limit)
}

export const createPollComment = (pollId, body) =>
  apiRequest(`/polls/${encodeURIComponent(pollId)}/comments`, {
    method: 'POST',
    body,
    token: authToken(),
  })

export const reactPollComment = (pollId, commentId, reaction) =>
  apiRequest(
    `/polls/${encodeURIComponent(pollId)}/comments/${encodeURIComponent(commentId)}/reactions`,
    {
      method: 'POST',
      body: { reaction },
      token: authToken(),
    },
  )

export const deletePollComment = (pollId, id) =>
  apiRequest(`/polls/${encodeURIComponent(pollId)}/comments/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    token: authToken(),
  })
