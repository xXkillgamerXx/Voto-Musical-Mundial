const hiddenNotificationTypes = new Set(['daily_reward_claimed'])

const resolveUiLocale = () => {
  try {
    const stored = localStorage.getItem('vmm-locale') || localStorage.getItem('vmm_locale') || localStorage.getItem('locale')
    if (stored) {
      return String(stored).toLowerCase().startsWith('en') ? 'en' : 'es'
    }
  } catch {
    // ignore storage errors
  }

  return String(document?.documentElement?.lang || navigator?.language || 'es')
    .toLowerCase()
    .startsWith('en')
    ? 'en'
    : 'es'
}

const pickLocalized = (payload, esKeys, enKeys) => {
  const useEn = resolveUiLocale() === 'en'
  const keys = useEn ? [...enKeys, ...esKeys] : [...esKeys, ...enKeys]

  for (const key of keys) {
    const value = payload?.[key]
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value)
    }
  }

  return ''
}

export const getNotificationTitle = (notification) => {
  const payload = notification?.payload || {}
  const localized = pickLocalized(payload, ['title'], ['titleEn'])

  if (localized) {
    return localized
  }

  switch (notification?.type) {
    case 'admin_points_gift':
      return 'Tienes un regalo'
    case 'report_thanks':
      return resolveUiLocale() === 'en' ? 'Thanks for your report' : 'Gracias por tu reporte'
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
  const localized = pickLocalized(
    payload,
    ['message', 'body', 'description'],
    ['messageEn', 'bodyEn'],
  )

  if (localized) {
    return localized
  }

  switch (notification?.type) {
    case 'admin_points_gift': {
      const amount = Number(payload.amount || payload.rewardPoints || 0)
      return amount > 0
        ? `Recibiste ${amount.toLocaleString('es')} puntos de regalo.`
        : 'Recibiste puntos de regalo.'
    }
    case 'report_thanks': {
      const amount = Number(payload.amount || 0)
      if (resolveUiLocale() === 'en') {
        return amount > 0
          ? `Thanks for reporting. We gave you ${amount.toLocaleString('en')} points for helping keep the community safer.`
          : 'Thanks for reporting. Reports like yours help keep the community safer.'
      }
      return amount > 0
        ? `Gracias por reportar. Te dimos ${amount.toLocaleString('es')} puntos por ayudar a hacer la comunidad más segura.`
        : 'Gracias por reportar. Denuncias como la tuya hacen la comunidad más segura.'
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
    case 'report_thanks':
      return 'fa-solid fa-shield-halved text-emerald-200'
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
