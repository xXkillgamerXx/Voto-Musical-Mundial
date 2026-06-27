import { apiRequest } from './client'

export const getPolls = (limit = 100) => apiRequest(`/polls?limit=${limit}`)

export const getLivePolls = (limit = 12) => apiRequest(`/polls/live?limit=${limit}`)

export const getPoll = (id) => apiRequest(`/polls/${encodeURIComponent(id)}`)

export const getPollResults = ({ pollId, roundId }) => {
  const query = roundId ? `?roundId=${encodeURIComponent(roundId)}` : ''
  return apiRequest(`/polls/${encodeURIComponent(pollId)}/results${query}`)
}
