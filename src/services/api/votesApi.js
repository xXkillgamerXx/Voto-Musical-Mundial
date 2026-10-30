import { getAnonymousToken } from './authApi'
import { apiRequest, ensureAccessToken, getStoredAuth } from './client'

const recentActivityRequests = new Map()

const resolveVoteAuth = async (anonymous) => {
  if (!anonymous) {
    const accessToken = await ensureAccessToken()
    const stored = getStoredAuth()
    if (accessToken && stored) {
      return { ...stored, accessToken }
    }
  }
  return getAnonymousToken()
}

const withVoteAuth = async (anonymous, request) => {
  const auth = await resolveVoteAuth(anonymous)
  try {
    return await request(auth)
  } catch (error) {
    if (error.status === 401) {
      const next = await getAnonymousToken({ force: true })
      return request(next)
    }
    throw error
  }
}

export const castVote = async (payload, { anonymous = false } = {}) =>
  withVoteAuth(anonymous, (auth) =>
    apiRequest('/votes', {
      method: 'POST',
      body: payload,
      token: auth?.accessToken,
    }),
  )

export const getAnonymousVoteStatus = async (
  payload,
  { anonymous = true } = {},
) =>
  withVoteAuth(anonymous, (auth) =>
    apiRequest('/votes/status', {
      method: 'POST',
      body: payload,
      token: auth?.accessToken,
    }),
  )

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

export const getShareVoteBoost = async ({ anonymous = false } = {}) =>
  withVoteAuth(anonymous, (auth) =>
    apiRequest('/votes/share-boost', {
      token: auth?.accessToken,
    }),
  )

export const claimShareVoteBoost = async (platform, { anonymous = false } = {}) =>
  withVoteAuth(anonymous, (auth) =>
    apiRequest('/votes/share-boost', {
      method: 'POST',
      body: { platform },
      token: auth?.accessToken,
    }),
  )
