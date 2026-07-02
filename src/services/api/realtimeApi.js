import { io } from 'socket.io-client'
import { getApiBaseUrl, getStoredAuth } from './client'

let socket = null

export const getRealtimeSocket = () => {
  if (!socket) {
    const baseUrl = getApiBaseUrl().replace(/\/api$/, '') || window.location.origin
    socket = io(baseUrl, {
      path: '/socket.io',
      transports: ['polling', 'websocket'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    })
  }

  return socket
}

export const onRealtimeConnectionChange = (callback) => {
  const client = getRealtimeSocket()
  const onConnect = () => callback(true)
  const onDisconnect = () => callback(false)

  client.on('connect', onConnect)
  client.on('disconnect', onDisconnect)

  if (client.connected) {
    callback(true)
  }

  return () => {
    client.off('connect', onConnect)
    client.off('disconnect', onDisconnect)
  }
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

export const subscribeLivePollsRealtime = ({ onPollStateChanged, onVoteDelta } = {}) => {
  const client = getRealtimeSocket()
  const join = () => {
    if (client.connected) {
      client.emit('join_live_polls')
    }
  }

  join()
  client.on('connect', join)

  if (onPollStateChanged) client.on('poll_state_changed', onPollStateChanged)
  if (onVoteDelta) client.on('vote_delta', onVoteDelta)

  return () => {
    client.off('connect', join)
    if (onPollStateChanged) client.off('poll_state_changed', onPollStateChanged)
    if (onVoteDelta) client.off('vote_delta', onVoteDelta)
    client.emit('leave_live_polls')
  }
}
