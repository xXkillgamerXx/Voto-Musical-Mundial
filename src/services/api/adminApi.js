import { apiFormRequest, apiRequest, getStoredAuth } from './client'

const authToken = () => getStoredAuth()?.accessToken

export const adminRequest = (path, options = {}) =>
  apiRequest(`/admin${path}`, {
    ...options,
    token: authToken(),
  })

export const adminFormRequest = (path, options = {}) =>
  apiFormRequest(`/admin${path}`, {
    ...options,
    token: authToken(),
  })

export const getAdminDashboard = () => adminRequest('/dashboard')
export const getAdminMetrics = () => adminRequest('/metrics')
export const getAdminUsers = (limit = 100) => adminRequest(`/users?limit=${limit}`)
export const updateAdminUser = (id, body) => adminRequest(`/users/${encodeURIComponent(id)}`, { method: 'PATCH', body })
export const uploadAdminImage = (type, file) => {
  const formData = new FormData()
  formData.append('file', file)

  return adminFormRequest(`/uploads/${encodeURIComponent(type)}`, {
    method: 'POST',
    body: formData,
  })
}

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
export const deleteAdminRound = (pollId, roundId) => adminRequest(`/polls/${encodeURIComponent(pollId)}/rounds/${encodeURIComponent(roundId)}`, { method: 'DELETE' })
export const createAdminContestant = (pollId, body) => adminRequest(`/polls/${encodeURIComponent(pollId)}/contestants`, { method: 'POST', body })
export const updateAdminContestant = (pollId, contestantId, body) => adminRequest(`/polls/${encodeURIComponent(pollId)}/contestants/${encodeURIComponent(contestantId)}`, { method: 'PATCH', body })
export const deleteAdminContestant = (pollId, contestantId) => adminRequest(`/polls/${encodeURIComponent(pollId)}/contestants/${encodeURIComponent(contestantId)}`, { method: 'DELETE' })
export const adjustAdminContestantVotes = (pollId, contestantId, amount) => adminRequest(`/polls/${encodeURIComponent(pollId)}/contestants/${encodeURIComponent(contestantId)}/manual-votes`, { method: 'POST', body: { amount } })
export const finishAdminRound = (pollId, roundId, body) => adminRequest(`/polls/${encodeURIComponent(pollId)}/rounds/${encodeURIComponent(roundId)}/finish`, { method: 'POST', body })
export const launchAdminRound = (pollId, roundId) => adminRequest(`/polls/${encodeURIComponent(pollId)}/rounds/${encodeURIComponent(roundId)}/launch`, { method: 'POST', body: {} })
export const closeAdminPoll = (pollId) => adminRequest(`/polls/${encodeURIComponent(pollId)}/close`, { method: 'POST', body: {} })
export const generateAdminVersus = (pollId, roundId) => adminRequest(`/polls/${encodeURIComponent(pollId)}/rounds/${encodeURIComponent(roundId)}/generate-versus`, { method: 'POST', body: {} })

export const getModerationOverview = (hours = 24) => adminRequest(`/moderation/overview?hours=${hours}`)
export const getModerationIpActivity = (hours = 24, limit = 50) => adminRequest(`/moderation/ip-activity?hours=${hours}&limit=${limit}`)
export const getModerationRecentVotes = (limit = 100) => adminRequest(`/moderation/recent-votes?limit=${limit}`)
export const getModerationBlocks = () => adminRequest('/moderation/blocks')
export const blockModerationIp = (ipHash, reason) => adminRequest('/moderation/block-ip', { method: 'POST', body: { ipHash, reason } })
export const unblockModerationIp = (ipHash) => adminRequest(`/moderation/block-ip/${encodeURIComponent(ipHash)}`, { method: 'DELETE' })
export const blockModerationUser = (userId, reason) => adminRequest('/moderation/block-user', { method: 'POST', body: { userId, reason } })
export const unblockModerationUser = (userId) => adminRequest(`/moderation/block-user/${encodeURIComponent(userId)}`, { method: 'DELETE' })

export const getAdminPushUsers = (search = '', limit = 50) =>
  adminRequest(`/push/users?search=${encodeURIComponent(search)}&limit=${limit}`)
export const getAdminPushTokens = (userId = '') =>
  adminRequest(`/push/tokens${userId ? `?userId=${encodeURIComponent(userId)}` : ''}`)
export const sendAdminPush = (body) =>
  adminRequest('/push/send', { method: 'POST', body })
export const sendAdminArtistPush = (artistId, body) =>
  adminRequest(`/push/artists/${encodeURIComponent(artistId)}/followers`, { method: 'POST', body })

export const getAdminMissions = () => adminRequest('/missions')
export const createAdminMission = (body) => adminRequest('/missions', { method: 'POST', body })
export const updateAdminMission = (id, body) => adminRequest(`/missions/${encodeURIComponent(id)}`, { method: 'PATCH', body })
export const deleteAdminMission = (id) => adminRequest(`/missions/${encodeURIComponent(id)}`, { method: 'DELETE' })
