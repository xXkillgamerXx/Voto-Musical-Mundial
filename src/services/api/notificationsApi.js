import { apiRequest, ensureAccessToken, getStoredAuth } from './client'

const hasNotificationSession = () => {
  const auth = getStoredAuth()
  return Boolean(auth?.accessToken && auth?.user && !auth.user.isAnonymous)
}

export const getNotifications = async (limit = 30) => {
  if (!hasNotificationSession()) {
    return []
  }

  const token = await ensureAccessToken()
  if (!token) {
    return []
  }

  try {
    return await apiRequest(`/notifications?limit=${limit}`, { token })
  } catch (error) {
    if (error.status === 401) {
      return []
    }
    throw error
  }
}

export const markNotificationRead = async (id) => {
  const token = await ensureAccessToken()
  if (!token) {
    return null
  }

  return apiRequest(`/notifications/${encodeURIComponent(id)}/read`, {
    method: 'PATCH',
    token,
  })
}

export const registerPushToken = async (token, permission = 'granted') => {
  const accessToken = await ensureAccessToken()
  if (!accessToken) {
    return null
  }

  return apiRequest('/notifications/push-token', {
    method: 'POST',
    token: accessToken,
    body: {
      token,
      permission,
      platform: 'web',
    },
  })
}

export const unregisterPushToken = async (token) => {
  const accessToken = await ensureAccessToken()
  if (!accessToken) {
    return null
  }

  return apiRequest('/notifications/push-token', {
    method: 'DELETE',
    token: accessToken,
    body: { token },
  })
}
