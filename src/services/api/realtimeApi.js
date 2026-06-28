import { io } from 'socket.io-client'
import { getApiBaseUrl, getStoredAuth } from './client'

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

export const subscribeUserRealtime = (userId, { onUserEvent } = {}) => {
  const client = getRealtimeSocket()
  const join = () => client.emit('join_user', { userId, token: getStoredAuth()?.accessToken })

  join()
  client.on('connect', join)

  if (onUserEvent) client.on('user_event', onUserEvent)

  return () => {
    client.off('connect', join)
    if (onUserEvent) client.off('user_event', onUserEvent)
    client.emit('leave_user', { userId })
  }
}

export const subscribePollRealtime = (pollId, { onVoteDelta, onResultsDirty, onPollStateChanged, onCommentEvent } = {}) => {
  const client = getRealtimeSocket()
  const join = () => client.emit('join_poll', { pollId })

  join()
  client.on('connect', join)

  if (onVoteDelta) client.on('vote_delta', onVoteDelta)
  if (onResultsDirty) client.on('results_dirty', onResultsDirty)
  if (onPollStateChanged) client.on('poll_state_changed', onPollStateChanged)
  if (onCommentEvent) client.on('comment_event', onCommentEvent)

  return () => {
    client.off('connect', join)
    if (onVoteDelta) client.off('vote_delta', onVoteDelta)
    if (onResultsDirty) client.off('results_dirty', onResultsDirty)
    if (onPollStateChanged) client.off('poll_state_changed', onPollStateChanged)
    if (onCommentEvent) client.off('comment_event', onCommentEvent)
    client.emit('leave_poll', { pollId })
  }
}

export const subscribeLivePollsRealtime = ({ onPollStateChanged } = {}) => {
  const client = getRealtimeSocket()
  const join = () => client.emit('join_live_polls')

  join()
  client.on('connect', join)

  if (onPollStateChanged) client.on('poll_state_changed', onPollStateChanged)

  return () => {
    client.off('connect', join)
    if (onPollStateChanged) client.off('poll_state_changed', onPollStateChanged)
    client.emit('leave_live_polls')
  }
}
