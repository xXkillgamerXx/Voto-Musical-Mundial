import { getAnonymousToken } from './authApi'
import { apiRequest, getStoredAuth } from './client'

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

export const getRecentVoteActivity = (limit = 24, hours = 168) =>
  apiRequest(`/votes/recent-activity?limit=${limit}&hours=${hours}`)
