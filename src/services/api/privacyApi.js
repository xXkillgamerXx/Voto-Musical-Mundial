import { apiRequest } from './client'

export const getPublicPrivacy = (lang = 'es') =>
  apiRequest(`/privacy?lang=${encodeURIComponent(lang)}`)
