import { apiRequest } from './client'

export const getArtistPopularityRanking = (limit = 100) =>
  apiRequest(`/rankings/artists/popularity?limit=${limit}`)

export const getPollRanking = ({ pollId, roundId }) => {
  const query = roundId ? `?roundId=${encodeURIComponent(roundId)}` : ''
  return apiRequest(`/rankings/polls/${encodeURIComponent(pollId)}${query}`)
}
