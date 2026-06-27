import { apiRequest, getStoredAuth } from './client'

const authToken = () => getStoredAuth()?.accessToken

export const adminRequest = (path, options = {}) =>
  apiRequest(`/admin${path}`, {
    ...options,
    token: authToken(),
  })

export const getAdminDashboard = () => adminRequest('/dashboard')
export const getAdminUsers = (limit = 100) => adminRequest(`/users?limit=${limit}`)
export const updateAdminUser = (id, body) => adminRequest(`/users/${encodeURIComponent(id)}`, { method: 'PATCH', body })

export const getAdminArtists = (limit = 250) => adminRequest(`/artists?limit=${limit}`)
export const createAdminArtist = (body) => adminRequest('/artists', { method: 'POST', body })
export const updateAdminArtist = (id, body) => adminRequest(`/artists/${encodeURIComponent(id)}`, { method: 'PATCH', body })
export const deleteAdminArtist = (id) => adminRequest(`/artists/${encodeURIComponent(id)}`, { method: 'DELETE' })

export const getAdminPollCategories = () => adminRequest('/poll-categories')
export const createAdminPollCategory = (body) => adminRequest('/poll-categories', { method: 'POST', body })
export const updateAdminPollCategory = (id, body) => adminRequest(`/poll-categories/${encodeURIComponent(id)}`, { method: 'PATCH', body })
export const deleteAdminPollCategory = (id) => adminRequest(`/poll-categories/${encodeURIComponent(id)}`, { method: 'DELETE' })

export const getAdminPolls = (limit = 100) => adminRequest(`/polls?limit=${limit}`)
export const createAdminPoll = (body) => adminRequest('/polls', { method: 'POST', body })
export const updateAdminPoll = (id, body) => adminRequest(`/polls/${encodeURIComponent(id)}`, { method: 'PATCH', body })
export const deleteAdminPoll = (id) => adminRequest(`/polls/${encodeURIComponent(id)}`, { method: 'DELETE' })

export const getAdminRounds = (pollId) => adminRequest(`/polls/${encodeURIComponent(pollId)}/rounds`)
export const createAdminRound = (pollId, body) => adminRequest(`/polls/${encodeURIComponent(pollId)}/rounds`, { method: 'POST', body })
export const updateAdminRound = (pollId, roundId, body) => adminRequest(`/polls/${encodeURIComponent(pollId)}/rounds/${encodeURIComponent(roundId)}`, { method: 'PATCH', body })

export const getAdminMissions = () => adminRequest('/missions')
export const createAdminMission = (body) => adminRequest('/missions', { method: 'POST', body })
export const updateAdminMission = (id, body) => adminRequest(`/missions/${encodeURIComponent(id)}`, { method: 'PATCH', body })
export const deleteAdminMission = (id) => adminRequest(`/missions/${encodeURIComponent(id)}`, { method: 'DELETE' })
