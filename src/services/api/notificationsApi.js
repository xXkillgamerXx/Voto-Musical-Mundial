import { apiRequest, getStoredAuth } from './client'

const authToken = () => getStoredAuth()?.accessToken

export const getNotifications = (limit = 30) =>
  apiRequest(`/notifications?limit=${limit}`, {
    token: authToken(),
  })

export const markNotificationRead = (id) =>
  apiRequest(`/notifications/${encodeURIComponent(id)}/read`, {
    method: 'PATCH',
    token: authToken(),
  })

export const registerPushToken = (token, permission = 'granted') =>
  apiRequest('/notifications/push-token', {
    method: 'POST',
    token: authToken(),
    body: {
      token,
      permission,
      platform: 'web',
    },
  })

export const unregisterPushToken = (token) =>
  apiRequest('/notifications/push-token', {
    method: 'DELETE',
    token: authToken(),
    body: { token },
  })
