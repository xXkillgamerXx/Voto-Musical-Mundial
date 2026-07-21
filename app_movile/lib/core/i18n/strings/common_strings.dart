/// Cadenas compartidas / transversales (acciones genéricas, idioma, etc.).
const Map<String, Map<String, String>> commonStrings = {
  // Idioma
  'lang.title': {'es': 'Idioma', 'en': 'Language', 'ko': '언어'},
  'lang.spanish': {'es': 'Español', 'en': 'Spanish', 'ko': '스페인어'},
  'lang.english': {'es': 'Inglés', 'en': 'English', 'ko': '영어'},
  'lang.korean': {'es': 'Coreano', 'en': 'Korean', 'ko': '한국어'},
  'lang.changeToEnglish': {'es': 'English', 'en': 'English', 'ko': 'English'},
  'lang.changeToSpanish': {'es': 'Español', 'en': 'Español', 'ko': 'Español'},

  // Acciones genéricas
  'common.retry': {'es': 'Reintentar', 'en': 'Retry', 'ko': '다시 시도'},
  'common.cancel': {'es': 'Cancelar', 'en': 'Cancel', 'ko': '취소'},
  'common.close': {'es': 'Cerrar', 'en': 'Close', 'ko': '닫기'},
  'common.accept': {'es': 'Aceptar', 'en': 'Accept', 'ko': '확인'},
  'common.save': {'es': 'Guardar', 'en': 'Save', 'ko': '저장'},
  'common.continueLabel': {'es': 'Continuar', 'en': 'Continue', 'ko': '계속'},
  'common.loading': {'es': 'Cargando...', 'en': 'Loading...', 'ko': '로딩 중...'},
  'common.seeAll': {'es': 'Ver todas', 'en': 'See all', 'ko': '모두 보기'},
  'common.seeMore': {'es': 'Ver más', 'en': 'See more', 'ko': '더 보기'},
  'common.error': {
    'es': 'Ocurrió un error',
    'en': 'Something went wrong',
    'ko': '오류가 발생했습니다',
  },
  'common.tryAgain': {
    'es': 'Inténtalo de nuevo',
    'en': 'Please try again',
    'ko': '다시 시도해 주세요',
  },
  'common.noConnection': {
    'es': 'Sin conexión. Revisa tu internet.',
    'en': 'No connection. Check your internet.',
    'ko': '연결 없음. 인터넷을 확인하세요.',
  },

  // Navegación inferior
  'nav.home': {'es': 'Inicio', 'en': 'Home', 'ko': '홈'},
  'nav.polls': {'es': 'Votaciones', 'en': 'Polls', 'ko': '투표'},
  'nav.artists': {'es': 'Artistas', 'en': 'Artists', 'ko': '아티스트'},
  'nav.missions': {'es': 'Misiones', 'en': 'Missions', 'ko': '미션'},

  // Secciones (el identificador interno sigue siendo el texto en español;
  // aquí solo se traduce lo que se muestra).
  'section.Inicio': {'es': 'Inicio', 'en': 'Home', 'ko': '홈'},
  'section.Noticias': {'es': 'Noticias', 'en': 'News', 'ko': '뉴스'},
  'section.Notificaciones': {
    'es': 'Notificaciones',
    'en': 'Notifications',
    'ko': '알림',
  },
  'section.Votaciones': {'es': 'Votaciones', 'en': 'Polls', 'ko': '투표'},
  'section.Artistas': {'es': 'Artistas', 'en': 'Artists', 'ko': '아티스트'},
  'section.Misiones': {'es': 'Misiones', 'en': 'Missions', 'ko': '미션'},
  'section.Ranking Popularity': {
    'es': 'Ranking Popularity',
    'en': 'Popularity Ranking',
    'ko': '인기 랭킹',
  },
  'section.Salón de la fama': {
    'es': 'Salón de la fama',
    'en': 'Hall of Fame',
    'ko': '명예의 전당',
  },
  'section.Configuración': {
    'es': 'Configuración',
    'en': 'Settings',
    'ko': '설정',
  },

  // Puntos
  'points.suffix': {'es': 'pts', 'en': 'pts', 'ko': 'pts'},
  'points.label': {'es': 'Puntos', 'en': 'Points', 'ko': '포인트'},
};
