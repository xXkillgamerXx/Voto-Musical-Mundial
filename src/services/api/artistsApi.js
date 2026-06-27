import { apiRequest } from './client'

export const getArtists = (limit = 250) => apiRequest(`/artists?limit=${limit}`)

export const getArtist = (id) => apiRequest(`/artists/${encodeURIComponent(id)}`)

export const getPopularityRanking = (limit = 100) =>
  apiRequest(`/artists/ranking/popularity?limit=${limit}`)
