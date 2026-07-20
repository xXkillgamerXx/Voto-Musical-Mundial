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

export const createMissionVisitToken = (missionId) => {
  const auth = getStoredAuth()
  return apiRequest(`/missions/${encodeURIComponent(missionId)}/visit-token`, {
    method: 'POST',
    token: auth?.accessToken,
  })
}

export const reportMissionVisitProgress = (pageUrl) => {
  const auth = getStoredAuth()
  if (!auth?.accessToken || auth?.user?.isAnonymous) {
    return Promise.resolve({ ok: false, updates: [] })
  }

  return apiRequest('/missions/visit-progress', {
    method: 'POST',
    body: { pageUrl: String(pageUrl || '').trim() },
    token: auth.accessToken,
  })
}

export const claimDailyReward = () => {
  const auth = getStoredAuth()
  return apiRequest('/rewards/daily-claim', {
    method: 'POST',
    token: auth?.accessToken,
  })
}
