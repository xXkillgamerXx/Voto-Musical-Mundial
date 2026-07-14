import { apiRequest, getStoredAuth } from './client'
import { i18n } from '../../i18n'

const missionsLang = () => {
  const locale = String(i18n.global.locale.value || 'es')
  return locale.toLowerCase().startsWith('en') ? 'en' : 'es'
}

export const getMissions = () => {
  const auth = getStoredAuth()
  const lang = missionsLang()

  if (auth?.accessToken) {
    return apiRequest(`/missions/me?lang=${encodeURIComponent(lang)}`, {
      token: auth.accessToken,
    })
  }

  return apiRequest(`/missions?lang=${encodeURIComponent(lang)}`)
}

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
