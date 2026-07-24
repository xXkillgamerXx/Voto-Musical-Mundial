import { getAnonymousToken } from './authApi'
import { apiRequest, getStoredAuth } from './client'

const recentActivityRequests = new Map()

export const castVote = async (payload, { anonymous = false } = {}) => {
  const auth = anonymous ? await getAnonymousToken() : getStoredAuth()

  return apiRequest('/votes', {
    method: 'POST',
    body: payload,
    token: auth?.accessToken,
  })
}

export const getAnonymousVoteStatus = async (
  payload,
  { anonymous = true } = {},
) => {
  const auth = anonymous ? await getAnonymousToken() : getStoredAuth()
  return apiRequest('/votes/status', {
    method: 'POST',
    body: payload,
    token: auth?.accessToken,
  })
}

export const getRecentVoteActivity = (limit = 24, hours = 168) => {
  const key = `${limit}:${hours}`

  if (!recentActivityRequests.has(key)) {
    recentActivityRequests.set(
      key,
      apiRequest(`/votes/recent-activity?limit=${limit}&hours=${hours}`)
        .finally(() => {
          recentActivityRequests.delete(key)
        }),
    )
  }

  return recentActivityRequests.get(key)
}

export const getShareVoteBoost = async ({ anonymous = false } = {}) => {
  const auth = anonymous ? await getAnonymousToken() : getStoredAuth()
  return apiRequest('/votes/share-boost', {
    token: auth?.accessToken,
  })
}

export const claimShareVoteBoost = async (platform, { anonymous = false } = {}) => {
  const auth = anonymous ? await getAnonymousToken() : getStoredAuth()
  return apiRequest('/votes/share-boost', {
    method: 'POST',
    body: { platform },
    token: auth?.accessToken,
  })
}
