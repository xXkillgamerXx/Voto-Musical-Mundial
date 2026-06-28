import { apiRequest, getStoredAuth } from './client'

const authToken = () => getStoredAuth()?.accessToken

export const getPollComments = (pollId, limit = 100) =>
  apiRequest(`/polls/${encodeURIComponent(pollId)}/comments?limit=${limit}`)

export const createPollComment = (pollId, body) =>
  apiRequest(`/polls/${encodeURIComponent(pollId)}/comments`, {
    method: 'POST',
    body,
    token: authToken(),
  })

export const deletePollComment = (pollId, id) =>
  apiRequest(`/polls/${encodeURIComponent(pollId)}/comments/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    token: authToken(),
  })
