import { apiRequest } from './client'

export const createContentReport = (payload) =>
  apiRequest('/reports', { method: 'POST', body: payload })
