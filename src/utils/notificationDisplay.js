const hiddenNotificationTypes = new Set(['daily_reward_claimed'])

export const getNotificationTitle = (notification) => {
  const payload = notification?.payload || {}

  if (payload.title) {
    return String(payload.title)
  }

  switch (notification?.type) {
    case 'admin_points_gift':
      return 'Tienes un regalo'
    case 'mission_completed':
      return payload.missionTitle ? `Misión completada: ${payload.missionTitle}` : 'Misión completada'
    case 'artist_push':
      return payload.artistName ? `Novedades de ${payload.artistName}` : 'Novedades de artista'
    case 'admin_push':
      return 'Aviso del equipo'
    default:
      return ''
  }
}

export const getNotificationBody = (notification) => {
  const payload = notification?.payload || {}
  const explicitBody = payload.message || payload.body || payload.description

  if (explicitBody) {
    return String(explicitBody)
  }

  switch (notification?.type) {
    case 'admin_points_gift': {
      const amount = Number(payload.amount || payload.rewardPoints || 0)
      return amount > 0
        ? `Recibiste ${amount.toLocaleString('es')} puntos de regalo.`
        : 'Recibiste puntos de regalo.'
    }
    case 'mission_completed': {
      const amount = Number(payload.rewardPoints || 0)
      return amount > 0
        ? `Ganaste ${amount.toLocaleString('es')} puntos.`
        : 'Completaste una misión y recibiste tu premio.'
    }
    case 'artist_push':
      return payload.artistName
        ? `Hay novedades sobre ${payload.artistName}.`
        : ''
    case 'admin_push':
      return ''
    default:
      return ''
  }
}

export const shouldDisplayNotification = (notification) => {
  if (!notification?.id) {
    return false
  }

  if (hiddenNotificationTypes.has(notification.type)) {
    return false
  }

  return Boolean(getNotificationTitle(notification) && getNotificationBody(notification))
}

export const getNotificationIcon = (notification) => {
  switch (notification?.type) {
    case 'admin_points_gift':
      return 'fa-solid fa-gift text-amber-200'
    case 'mission_completed':
      return 'fa-solid fa-bullseye text-emerald-200'
    case 'artist_push':
      return 'fa-solid fa-star text-fuchsia-200'
    case 'admin_push':
      return 'fa-solid fa-bell text-cyan-200'
    default:
      return 'fa-solid fa-circle-info text-violet-200'
  }
}
