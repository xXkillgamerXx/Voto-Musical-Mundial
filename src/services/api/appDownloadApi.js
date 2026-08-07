import { apiRequest } from './client'

export const getAppDownloadConfig = () => apiRequest('/app-download')
