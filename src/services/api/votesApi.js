import { getTurnstileToken, isTurnstileEnabled } from '../turnstile'
import { getAnonymousToken } from './authApi'
import { apiRequest, getStoredAuth } from './client'

export const castVote = async (payload, { anonymous = false } = {}) => {
  const auth = anonymous ? await getAnonymousToken() : getStoredAuth()
  let body = payload

  // Anonymous votes must pass a Cloudflare Turnstile challenge when the feature is enabled.
  if (anonymous && isTurnstileEnabled()) {
    const turnstileToken = await getTurnstileToken()
    body = { ...payload, turnstileToken }
  }

  return apiRequest('/votes', {
    method: 'POST',
    body,
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
