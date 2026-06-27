import { io } from 'socket.io-client'
import { getApiBaseUrl } from './client'

let socket = null

export const getRealtimeSocket = () => {
  if (!socket) {
    const baseUrl = getApiBaseUrl().replace(/\/api$/, '')
    socket = io(baseUrl, {
      transports: ['websocket'],
      autoConnect: true,
    })
  }

  return socket
}

export const subscribePollRealtime = (pollId, { onVoteDelta, onResultsDirty } = {}) => {
  const client = getRealtimeSocket()
  client.emit('join_poll', { pollId })

  if (onVoteDelta) client.on('vote_delta', onVoteDelta)
  if (onResultsDirty) client.on('results_dirty', onResultsDirty)

  return () => {
    if (onVoteDelta) client.off('vote_delta', onVoteDelta)
    if (onResultsDirty) client.off('results_dirty', onResultsDirty)
    client.emit('leave_poll', { pollId })
  }
}
