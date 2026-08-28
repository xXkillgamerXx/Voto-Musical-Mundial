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
export const getAdminOverview = (days = 30) => adminRequest(`/overview?days=${days}`)
export const getAdminMetrics = () => adminRequest('/metrics')
export const getAdminUsers = ({
  page = 1,
  limit = 20,
  search = '',
  role = '',
  sort = 'newest',
} = {}) => {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    sort: String(sort || 'newest'),
  })
  const query = String(search || '').trim()
  const roleFilter = String(role || '').trim()
  if (query) {
    params.set('search', query)
  }
  if (roleFilter) {
    params.set('role', roleFilter)
  }
  return adminRequest(`/users?${params.toString()}`)
}
export const updateAdminUser = (id, body) => adminRequest(`/users/${encodeURIComponent(id)}`, { method: 'PATCH', body })
export const getAdminUserProfile = (id) => adminRequest(`/users/${encodeURIComponent(id)}/profile`)
export const getAdminUserActivity = (id, limit = 120) =>
  adminRequest(`/users/${encodeURIComponent(id)}/activity?limit=${limit}`)
export const getAdminUserActivityDays = (id, days = 90) =>
  adminRequest(`/users/${encodeURIComponent(id)}/activity-days?days=${days}`)
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
export const createAdminBotCampaign = (pollId, contestantId, body) =>
  adminRequest(
    `/polls/${encodeURIComponent(pollId)}/contestants/${encodeURIComponent(contestantId)}/bot-campaigns`,
    { method: 'POST', body },
  )
export const getAdminBotCampaigns = (pollId) =>
  adminRequest(`/polls/${encodeURIComponent(pollId)}/bot-campaigns`)
export const getAdminBotCampaign = (campaignId) =>
  adminRequest(`/bot-campaigns/${encodeURIComponent(campaignId)}`)
export const cancelAdminBotCampaign = (campaignId) =>
  adminRequest(`/bot-campaigns/${encodeURIComponent(campaignId)}/cancel`, {
    method: 'POST',
    body: {},
  })
export const suggestAdminCommentBotMessages = (pollId, body) =>
  adminRequest(`/polls/${encodeURIComponent(pollId)}/comment-bot-campaigns/suggest-messages`, {
    method: 'POST',
    body,
  })
export const createAdminCommentBotCampaign = (pollId, body) =>
  adminRequest(`/polls/${encodeURIComponent(pollId)}/comment-bot-campaigns`, {
    method: 'POST',
    body,
  })
export const getAdminCommentBotCampaigns = (pollId) =>
  adminRequest(`/polls/${encodeURIComponent(pollId)}/comment-bot-campaigns`)
export const getAdminCommentBotCampaign = (campaignId) =>
  adminRequest(`/comment-bot-campaigns/${encodeURIComponent(campaignId)}`)
export const cancelAdminCommentBotCampaign = (campaignId) =>
  adminRequest(`/comment-bot-campaigns/${encodeURIComponent(campaignId)}/cancel`, {
    method: 'POST',
    body: {},
  })
export const deleteAdminCommentBotComments = (campaignId) =>
  adminRequest(`/comment-bot-campaigns/${encodeURIComponent(campaignId)}/delete-comments`, {
    method: 'POST',
    body: {},
  })
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

export const getAdminMailStatus = () => adminRequest('/mail/status')
export const sendAdminTestEmail = (body) =>
  adminRequest('/mail/send-test', { method: 'POST', body })

export const getAdminNotificationCampaigns = () => adminRequest('/notification-campaigns')
export const createAdminNotificationCampaign = (body) =>
  adminRequest('/notification-campaigns', { method: 'POST', body })
export const updateAdminNotificationCampaign = (id, body) =>
  adminRequest(`/notification-campaigns/${encodeURIComponent(id)}`, { method: 'PATCH', body })
export const deleteAdminNotificationCampaign = (id) =>
  adminRequest(`/notification-campaigns/${encodeURIComponent(id)}`, { method: 'DELETE' })
export const sendAdminNotificationCampaignNow = (id) =>
  adminRequest(`/notification-campaigns/${encodeURIComponent(id)}/send-now`, { method: 'POST', body: {} })

export const getAdminMissions = () => adminRequest('/missions')
export const createAdminMission = (body) => adminRequest('/missions', { method: 'POST', body })
export const updateAdminMission = (id, body) => adminRequest(`/missions/${encodeURIComponent(id)}`, { method: 'PATCH', body })
export const deleteAdminMission = (id) => adminRequest(`/missions/${encodeURIComponent(id)}`, { method: 'DELETE' })

export const getAdminDailyRewards = () => adminRequest('/settings/daily-rewards')
export const updateAdminDailyRewards = (body) =>
  adminRequest('/settings/daily-rewards', { method: 'PATCH', body })

export const getAdminShareVoteBoost = () => adminRequest('/settings/share-vote-boost')
export const updateAdminShareVoteBoost = (body) =>
  adminRequest('/settings/share-vote-boost', { method: 'PATCH', body })

export const getAdminAppDownload = () => adminRequest('/settings/app-download')
export const updateAdminAppDownload = (body) =>
  adminRequest('/settings/app-download', { method: 'PATCH', body })

export const getAdminTerms = () => adminRequest('/settings/terms')
export const updateAdminTerms = (body) =>
  adminRequest('/settings/terms', { method: 'PATCH', body })

export const getAdminPrivacy = () => adminRequest('/settings/privacy')
export const updateAdminPrivacy = (body) =>
  adminRequest('/settings/privacy', { method: 'PATCH', body })

export const getAdminContentReports = (status = '', limit = 50) => {
  const params = new URLSearchParams({ limit: String(limit) })
  if (status) params.set('status', status)
  return adminRequest(`/content-reports?${params.toString()}`)
}
export const updateAdminContentReport = (id, body) =>
  adminRequest(`/content-reports/${encodeURIComponent(id)}`, { method: 'PATCH', body })
