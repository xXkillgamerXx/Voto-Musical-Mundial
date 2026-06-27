import { apiRequest, getStoredAuth } from './client'

export const getMissions = () => apiRequest('/missions')

export const completeMission = (missionId, payload = {}) => {
  const auth = getStoredAuth()
  return apiRequest(`/missions/${encodeURIComponent(missionId)}/complete`, {
    method: 'POST',
    body: payload,
    token: auth?.accessToken,
  })
}

export const claimDailyReward = () => {
  const auth = getStoredAuth()
  return apiRequest('/rewards/daily-claim', {
    method: 'POST',
    token: auth?.accessToken,
  })
}
