import { apiRequest } from './client'

export const getPublicTerms = (lang = 'es') =>
  apiRequest(`/terms?lang=${encodeURIComponent(lang)}`)
