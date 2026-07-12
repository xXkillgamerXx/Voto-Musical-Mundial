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

export const getAnonymousVoteStatus = async (payload) => {
  const auth = await getAnonymousToken()
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
