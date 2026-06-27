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
