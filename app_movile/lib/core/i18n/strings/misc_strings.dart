/// Cadenas varias: notificaciones, perfil de usuario y elementos sueltos.
const Map<String, Map<String, String>> miscStrings = {
  // Notificaciones (pantalla y campana)
  'misc.notificationsTitle': {
    'es': 'Notificaciones',
    'en': 'Notifications',
    'ko': '알림',
  },
  'misc.notificationCenter': {
    'es': 'CENTRO DE NOTIFICACIONES',
    'en': 'NOTIFICATION CENTER',
    'ko': '알림 센터',
  },
  'misc.yourActivity': {
    'es': 'Tu actividad',
    'en': 'Your activity',
    'ko': '내 활동',
  },
  'misc.unreadCount': {
    'es': '{count} sin leer',
    'en': '{count} unread',
    'ko': '읽지 않음 {count}개',
  },
  'misc.allCaughtUp': {
    'es': 'Estás al día con tus avisos.',
    'en': "You're all caught up.",
    'ko': '모든 알림을 확인했어요.',
  },
  'misc.exitAppTitle': {
    'es': 'Salir de la app',
    'en': 'Leave the app',
    'ko': '앱 종료',
  },
  'misc.exitAppConfirm': {
    'es': '¿Seguro que quieres salir de la app?',
    'en': 'Are you sure you want to leave the app?',
    'ko': '앱을 종료하시겠습니까?',
  },
  'misc.exitAppYes': {
    'es': 'Sí, salir',
    'en': 'Yes, leave',
    'ko': '네, 종료',
  },
  'misc.exitAppCancel': {
    'es': 'Cancelar',
    'en': 'Cancel',
    'ko': '취소',
  },
  'misc.markAllRead': {
    'es': 'Marcar todo como leído',
    'en': 'Mark all as read',
    'ko': '모두 읽음으로 표시',
  },
  'misc.enablePushTitle': {
    'es': 'Activa push notifications',
    'en': 'Enable push notifications',
    'ko': '푸시 알림 켜기',
  },
  'misc.enablePushBody': {
    'es': 'Recibe regalos, misiones y avisos aunque no tengas la app abierta.',
    'en': "Get gifts, missions and alerts even when the app isn't open.",
    'ko': '앱을 열지 않아도 선물, 미션, 알림을 받아보세요.',
  },
  'appFirstOpen.giftSender': {
    'es': 'Bonus de la app',
    'en': 'App bonus',
    'ko': '앱 보너스',
  },
  'appFirstOpen.giftMessage': {
    'es': 'Entraste a la app por primera vez y ganaste {points} puntos.',
    'en': 'You opened the app for the first time and earned {points} points.',
    'ko': '앱을 처음 열어 {points} 포인트를 받았어요.',
  },
  'misc.enablePushButton': {
    'es': 'ACTIVAR PUSH',
    'en': 'ENABLE PUSH',
    'ko': '푸시 켜기',
  },
  'misc.noNotifications': {
    'es': 'Todavía no tienes notificaciones.',
    'en': "You don't have any notifications yet.",
    'ko': '아직 알림이 없어요.',
  },

  // Modal de regalo
  'misc.missionCompletedPoints': {
    'es': 'Completaste una misión y ganaste {count} puntos.',
    'en': 'You completed a mission and earned {count} points.',
    'ko': '미션을 완료하고 {count}포인트를 획득했어요.',
  },
  'misc.giftReceivedPoints': {
    'es': 'Recibiste {count} puntos de regalo.',
    'en': 'You received {count} gift points.',
    'ko': '선물 포인트 {count}점을 받았어요.',
  },
  'misc.missionCompletedLabel': {
    'es': 'MISIÓN COMPLETADA',
    'en': 'MISSION COMPLETED',
    'ko': '미션 완료',
  },
  'misc.youHaveGift': {
    'es': 'TIENES UN REGALO',
    'en': 'YOU HAVE A GIFT',
    'ko': '선물이 도착했어요',
  },
  'misc.prizeReceived': {
    'es': 'PREMIO RECIBIDO',
    'en': 'PRIZE RECEIVED',
    'ko': '상품 수령 완료',
  },
  'misc.giftOpened': {
    'es': 'REGALO ABIERTO',
    'en': 'GIFT OPENED',
    'ko': '선물 개봉 완료',
  },
  'misc.prize': {'es': 'Premio', 'en': 'Prize', 'ko': '상품'},
  'misc.surprise': {'es': 'Sorpresa', 'en': 'Surprise', 'ko': '깜짝 선물'},
  'misc.missionOpenPrize': {
    'es': 'Completaste una misión. Abre tu premio para recibir los puntos.',
    'en': 'You completed a mission. Open your prize to receive the points.',
    'ko': '미션을 완료했어요. 상품을 열어 포인트를 받으세요.',
  },
  'misc.someoneSentGift': {
    'es':
        'Alguien del equipo te envió un regalo. Ábrelo para descubrir cuántos puntos recibiste.',
    'en':
        'Someone from the team sent you a gift. Open it to discover how many points you received.',
    'ko': '팀에서 선물을 보냈어요. 열어서 몇 포인트를 받았는지 확인해 보세요.',
  },
  'misc.sentBy': {'es': 'Enviado por', 'en': 'Sent by', 'ko': '보낸 사람'},
  'misc.newBalance': {'es': 'Nuevo saldo', 'en': 'New balance', 'ko': '새 잔액'},
  'misc.done': {'es': 'LISTO', 'en': 'DONE', 'ko': '완료'},
  'misc.openGift': {'es': 'ABRIR REGALO', 'en': 'OPEN GIFT', 'ko': '선물 열기'},

  // Texto de notificaciones (notification_display)
  'misc.giftTitle': {
    'es': 'Tienes un regalo',
    'en': 'You have a gift',
    'ko': '선물이 도착했어요',
  },
  'misc.missionCompletedWithTitle': {
    'es': 'Misión completada: {title}',
    'en': 'Mission completed: {title}',
    'ko': '미션 완료: {title}',
  },
  'misc.missionCompleted': {
    'es': 'Misión completada',
    'en': 'Mission completed',
    'ko': '미션 완료',
  },
  'misc.artistNews': {
    'es': 'Novedades de {name}',
    'en': 'News from {name}',
    'ko': '{name}의 새 소식',
  },
  'misc.artistNewsGeneric': {
    'es': 'Novedades de artista',
    'en': 'Artist news',
    'ko': '아티스트 소식',
  },
  'misc.teamNotice': {
    'es': 'Aviso del equipo',
    'en': 'Team notice',
    'ko': '팀 공지',
  },
  'misc.giftReceivedGeneric': {
    'es': 'Recibiste puntos de regalo.',
    'en': 'You received gift points.',
    'ko': '선물 포인트를 받았어요.',
  },
  'misc.earnedPoints': {
    'es': 'Ganaste {count} puntos.',
    'en': 'You earned {count} points.',
    'ko': '{count}포인트를 획득했어요.',
  },
  'misc.missionCompletedPrize': {
    'es': 'Completaste una misión y recibiste tu premio.',
    'en': 'You completed a mission and received your prize.',
    'ko': '미션을 완료하고 상품을 받았어요.',
  },
  'misc.artistNewsBody': {
    'es': 'Hay novedades sobre {name}.',
    'en': 'There is news about {name}.',
    'ko': '{name}에 대한 새 소식이 있어요.',
  },
  'misc.missionSystem': {
    'es': 'Sistema de misiones',
    'en': 'Mission system',
    'ko': '미션 시스템',
  },
  'misc.vmmTeam': {
    'es': 'Equipo Voto Música Mundial',
    'en': 'Voto Música Mundial Team',
    'ko': 'Voto Música Mundial 팀',
  },

  // Perfil de usuario
  'misc.myProfile': {'es': 'Mi perfil', 'en': 'My profile', 'ko': '내 프로필'},
  'misc.profile': {'es': 'Perfil', 'en': 'Profile', 'ko': '프로필'},
  'misc.profileLoadError': {
    'es': 'No se pudo cargar el perfil.',
    'en': 'Could not load the profile.',
    'ko': '프로필을 불러올 수 없어요.',
  },
  'misc.profileUnavailable': {
    'es': 'El usuario no existe o no está disponible.',
    'en': 'The user does not exist or is unavailable.',
    'ko': '해당 사용자가 존재하지 않거나 이용할 수 없어요.',
  },
  'misc.publicFanProfileBio': {
    'es': 'Perfil público de fan en Music Mundial VOTING.',
    'en': 'Public fan profile on Music Mundial VOTING.',
    'ko': 'Music Mundial VOTING의 공개 팬 프로필입니다.',
  },
  'misc.followedArtistsLabel': {
    'es': 'ARTISTAS SEGUIDOS',
    'en': 'FOLLOWED ARTISTS',
    'ko': '팔로우한 아티스트',
  },
  'misc.favoritesLabel': {
    'es': 'FAVORITOS',
    'en': 'FAVORITES',
    'ko': '즐겨찾기',
  },
  'misc.followedArtistsTitle': {
    'es': 'Artistas seguidos',
    'en': 'Followed artists',
    'ko': '팔로우한 아티스트',
  },
  'misc.following': {'es': 'Siguiendo', 'en': 'Following', 'ko': '팔로잉'},
  'misc.noFavoritesLabel': {
    'es': 'AÚN SIN FAVORITOS',
    'en': 'NO FAVORITES YET',
    'ko': '아직 즐겨찾기가 없어요',
  },
  'misc.fanNoArtists': {
    'es': 'Este fan todavía no sigue artistas.',
    'en': "This fan doesn't follow any artists yet.",
    'ko': '이 팬은 아직 팔로우하는 아티스트가 없어요.',
  },
  'misc.artistsWillAppear': {
    'es': 'Cuando siga artistas, aparecerán aquí.',
    'en': 'When they follow artists, they will appear here.',
    'ko': '아티스트를 팔로우하면 여기에 표시돼요.',
  },
};
