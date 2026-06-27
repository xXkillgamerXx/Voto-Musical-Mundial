import { apiRequest, getStoredAuth } from './client'

export const claimDailyReward = () =>
  apiRequest('/rewards/daily-claim', {
    method: 'POST',
    token: getStoredAuth()?.accessToken,
  })
