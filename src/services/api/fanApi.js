import { apiRequest, getStoredAuth } from './client'

const authToken = () => getStoredAuth()?.accessToken

export const getFanMe = () =>
  apiRequest('/fan-store/me', { token: authToken() })

export const checkoutFanStore = (body) =>
  apiRequest('/fan-store/checkout', {
    method: 'POST',
    token: authToken(),
    body,
  })

export const getPaypalConfig = () => apiRequest('/fan-store/paypal/config')

export const createPaypalOrder = (body) =>
  apiRequest('/fan-store/paypal/order', {
    method: 'POST',
    token: authToken(),
    body,
  })

export const capturePaypalOrder = (orderId) =>
  apiRequest('/fan-store/paypal/capture', {
    method: 'POST',
    token: authToken(),
    body: { orderId },
  })

export const importFanPlan = (body) =>
  apiRequest('/fan-store/checkout', {
    method: 'POST',
    token: authToken(),
    body: { ...body, adopt: true },
  })

export const cancelFanPurchase = (id) =>
  apiRequest(`/fan-store/purchases/${encodeURIComponent(id)}/cancel`, {
    method: 'POST',
    token: authToken(),
  })

export const getArtistSupportersApi = (artistId) =>
  apiRequest(`/artists/${encodeURIComponent(artistId)}/supporters`)
