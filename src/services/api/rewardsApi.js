import { apiRequest, getStoredAuth } from './client'

export const getDailyRewardSchedule = () => apiRequest('/rewards/daily-schedule')

export const claimDailyReward = () =>
  apiRequest('/rewards/daily-claim', {
    method: 'POST',
    token: getStoredAuth()?.accessToken,
  })
