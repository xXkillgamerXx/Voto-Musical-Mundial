import { apiRequest, getStoredAuth } from './client'

export const getArtists = (limit = 250) => apiRequest(`/artists?limit=${limit}`)

export const getArtist = (id) => apiRequest(`/artists/${encodeURIComponent(id)}`)

export const getPopularityRanking = (limit = 100) =>
  apiRequest(`/artists/ranking/popularity?limit=${limit}`)

const authToken = () => getStoredAuth()?.accessToken

export const getArtistFollowStatus = (id) =>
  apiRequest(`/artists/${encodeURIComponent(id)}/follow`, {
    token: authToken(),
  })

export const followArtist = (id) =>
  apiRequest(`/artists/${encodeURIComponent(id)}/follow`, {
    method: 'POST',
    body: {},
    token: authToken(),
  })

export const unfollowArtist = (id) =>
  apiRequest(`/artists/${encodeURIComponent(id)}/follow`, {
    method: 'DELETE',
    token: authToken(),
  })
