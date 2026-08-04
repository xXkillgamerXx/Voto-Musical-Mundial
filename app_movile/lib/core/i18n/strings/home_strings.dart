/// Cadenas de la sección Inicio (home) y recompensas mostradas en el inicio.
const Map<String, Map<String, String>> homeStrings = {
  // Estado general del inicio
  'home.artistFallback': {'es': 'Artista', 'en': 'Artist', 'ko': '아티스트'},
  'home.loadError': {
    'es': 'No se pudo cargar el inicio.',
    'en': "Couldn't load the home screen.",
    'ko': '홈 화면을 불러올 수 없습니다.',
  },

  // Banner hero vacío
  'home.heroEmptyBadge': {
    'es': 'Próximamente',
    'en': 'Coming soon',
    'ko': '곧 공개',
  },
  'home.heroEmptyStatus': {
    'es': 'Sin votaciones',
    'en': 'No polls',
    'ko': '투표 없음',
  },
  'home.heroEmptyEyebrow': {
    'es': 'Votos Musica Mundial',
    'en': 'Votos Musica Mundial',
    'ko': 'Votos Musica Mundial',
  },
  'home.heroEmptyTitle': {
    'es': 'Prepara tu fandom para la próxima votación',
    'en': 'Get your fandom ready for the next poll',
    'ko': '다음 투표를 위해 팬덤을 준비하세요',
  },
  'home.heroEmptyDescription': {
    'es':
        'Cuando haya una votación activa, aquí verás el líder, los votos y el avance real del ranking.',
    'en':
        "When there's an active poll, you'll see the leader, the votes and the real ranking progress here.",
    'ko': '진행 중인 투표가 있으면 여기에서 선두 아티스트, 득표수, 실시간 랭킹 현황을 확인할 수 있습니다.',
  },

  // Banner hero con votación
  'home.favoriteArtist': {
    'es': 'Tu artista favorito',
    'en': 'Your favorite artist',
    'ko': '당신이 좋아하는 아티스트',
  },
  'home.heroBadgeTop': {'es': '#1 en vivo', 'en': '#1 live', 'ko': '#1 실시간'},
  'home.heroBadgeLive': {
    'es': 'Votación en vivo',
    'en': 'Live poll',
    'ko': '실시간 투표',
  },
  'home.heroStatusInProcess': {
    'es': 'En proceso',
    'en': 'In progress',
    'ko': '진행 중',
  },
  'home.heroStatusLive': {'es': 'En vivo', 'en': 'Live', 'ko': '실시간'},
  'home.heroLeaderTitle': {
    'es': '{name} lidera la votación',
    'en': '{name} leads the poll',
    'ko': '{name}이(가) 투표를 선두하고 있어요',
  },
  'home.heroDefaultDescription': {
    'es':
        'Tu voto puede cambiar el ranking. Entra, apoya a tu artista y ayuda a tu fandom a subir posiciones.',
    'en':
        'Your vote can change the ranking. Come in, support your artist and help your fandom climb positions.',
    'ko': '당신의 한 표가 랭킹을 바꿀 수 있어요. 지금 참여해 아티스트를 응원하고 팬덤 순위를 끌어올리세요.',
  },

  // Estadísticas del hero
  'home.leaderVotes': {
    'es': 'Votos del líder',
    'en': 'Leader votes',
    'ko': '선두 득표수',
  },
  'home.leading': {'es': 'Liderando', 'en': 'Leading', 'ko': '선두'},
  'home.participation': {
    'es': 'Participación',
    'en': 'Participation',
    'ko': '참여율',
  },
  'home.totalVotes': {'es': 'Votos totales', 'en': 'Total votes', 'ko': '총 득표수'},
  'home.participants': {
    'es': 'Participantes',
    'en': 'Participants',
    'ko': '참여자',
  },

  // Botones del hero
  'home.viewPolls': {'es': 'Ver votaciones', 'en': 'View polls', 'ko': '투표 보기'},
  'home.voteNow': {'es': 'Votar ahora', 'en': 'Vote now', 'ko': '지금 투표하기'},
  'home.viewRankings': {
    'es': 'Ver rankings',
    'en': 'View rankings',
    'ko': '랭킹 보기',
  },

  // Sección votaciones activas
  'home.activePollsEyebrow': {
    'es': 'VOTACIONES',
    'en': 'POLLS',
    'ko': '투표',
  },
  'home.voteNowTitle': {'es': 'Vota ahora', 'en': 'Vote now', 'ko': '지금 투표하세요'},
  'home.activePollsSubtitle': {
    'es':
        'Desliza a un lado las abiertas y más abajo las cerradas.',
    'en': 'Swipe sideways through open polls, then closed ones below.',
    'ko': '진행 중 투표를 옆으로 넘기고, 아래에서 종료된 투표를 확인하세요.',
  },
  'home.openPollsSection': {
    'es': 'ABIERTAS',
    'en': 'OPEN',
    'ko': '진행 중',
  },
  'home.swipePollsHint': {
    'es': 'Desliza para ver más',
    'en': 'Swipe to see more',
    'ko': '더 보려면 밀어보세요',
  },
  'home.closedPollsSection': {
    'es': 'CERRADAS',
    'en': 'CLOSED',
    'ko': '종료됨',
  },
  'home.closedPollsEmpty': {
    'es': 'Todavía no hay votaciones cerradas para mostrar.',
    'en': 'There are no closed polls to show yet.',
    'ko': '아직 표시할 종료된 투표가 없습니다.',
  },
  'home.countingVotes': {
    'es': 'Contando votos...',
    'en': 'Counting votes...',
    'ko': '득표 집계 중...',
  },
  'home.whoLeadsPoll': {
    'es': '¿Quién lidera esta votación?',
    'en': 'Who leads this poll?',
    'ko': '이 투표의 선두는 누구일까요?',
  },
  'home.viewProcess': {
    'es': 'Ver proceso',
    'en': 'View process',
    'ko': '진행 상황 보기',
  },
  'home.vote': {'es': 'Votar', 'en': 'Vote', 'ko': '투표하기'},

  // Cuenta regresiva
  'home.days': {'es': 'Días', 'en': 'Days', 'ko': '일'},
  'home.hours': {'es': 'Horas', 'en': 'Hours', 'ko': '시간'},
  'home.minutesShort': {'es': 'Min', 'en': 'Min', 'ko': '분'},
  'home.secondsShort': {'es': 'Seg', 'en': 'Sec', 'ko': '초'},
  'home.liveNow': {'es': 'EN VIVO', 'en': 'LIVE', 'ko': '실시간'},
  'home.timeRemaining': {
    'es': 'TIEMPO RESTANTE',
    'en': 'TIME REMAINING',
    'ko': '남은 시간',
  },
  'home.noCloseDefined': {
    'es': 'SIN CIERRE DEFINIDO',
    'en': 'NO DEFINED CLOSE',
    'ko': '마감일 미정',
  },

  // Votaciones activas vacío
  'home.soon': {'es': 'Pronto', 'en': 'Soon', 'ko': '곧'},
  'home.noLivePolls': {
    'es': 'Sin votaciones en vivo',
    'en': 'No live polls',
    'ko': '실시간 투표 없음',
  },
  'home.noActivePollsTitle': {
    'es': 'Todavía no hay votaciones activas',
    'en': 'There are no active polls yet',
    'ko': '아직 진행 중인 투표가 없습니다',
  },
  'home.noActivePollsDescription': {
    'es':
        'Cuando se abra una nueva votación, la verás aquí con cuenta regresiva y acceso directo para votar.',
    'en':
        "When a new poll opens, you'll see it here with a countdown and direct access to vote.",
    'ko': '새 투표가 열리면 카운트다운과 함께 여기에서 확인하고 바로 투표할 수 있습니다.',
  },
  'home.viewRanking': {'es': 'Ver ranking', 'en': 'View ranking', 'ko': '랭킹 보기'},

  // Top de la semana
  'home.ofTheWeek': {'es': 'DE LA SEMANA', 'en': 'OF THE WEEK', 'ko': '이번 주'},
  'home.topVotedClosed': {
    'es': 'Más votados en votaciones cerradas',
    'en': 'Most voted in closed polls',
    'ko': '종료된 투표에서 최다 득표',
  },
  'home.topVotedSubtitle': {
    'es': 'Solo se cuentan votos de encuestas ya finalizadas.',
    'en': 'Only votes from finished polls are counted.',
    'ko': '종료된 투표의 득표만 집계됩니다.',
  },
  'home.viewArtists': {
    'es': 'Ver artistas',
    'en': 'View artists',
    'ko': '아티스트 보기',
  },
  'home.noClosedPollsTitle': {
    'es': 'Sin votaciones cerradas',
    'en': 'No closed polls',
    'ko': '종료된 투표 없음',
  },
  'home.noClosedPollsDescription': {
    'es':
        'Cuando finalice una votación, aquí verás sus resultados para consultarlos.',
    'en':
        'When a poll ends, you will see its results here to check them.',
    'ko': '투표가 종료되면 여기에서 결과를 확인할 수 있습니다.',
  },

  // Categorías
  'home.explore': {'es': 'EXPLORA', 'en': 'EXPLORE', 'ko': '둘러보기'},
  'home.mainCategories': {
    'es': 'Categorías principales',
    'en': 'Main categories',
    'ko': '주요 카테고리',
  },
  'home.viewAll': {'es': 'Ver todas', 'en': 'View all', 'ko': '전체 보기'},
  'home.categoriesPreparingTitle': {
    'es': 'Categorías en preparación',
    'en': 'Categories in preparation',
    'ko': '카테고리 준비 중',
  },
  'home.categoriesPreparingDescription': {
    'es':
        'Cuando existan votaciones con categorías en la base de datos, aquí aparecerán para explorar la comunidad.',
    'en':
        "When there are polls with categories in the database, they'll appear here to explore the community.",
    'ko': '카테고리가 있는 투표가 등록되면 여기에서 커뮤니티를 둘러볼 수 있습니다.',
  },
  'home.viewCategory': {
    'es': 'VER CATEGORÍA',
    'en': 'VIEW CATEGORY',
    'ko': '카테고리 보기',
  },

  // Actividad en tiempo real
  'home.realTime': {'es': 'EN TIEMPO REAL', 'en': 'IN REAL TIME', 'ko': '실시간'},
  'home.liveTag': {'es': 'LIVE', 'en': 'LIVE', 'ko': 'LIVE'},
  'home.connecting': {'es': 'CONECTANDO', 'en': 'CONNECTING', 'ko': '연결 중'},
  'home.realTimeSubtitle': {
    'es':
        'Fans registrados votando en encuestas activas. Se actualiza al instante.',
    'en': 'Registered fans voting in active polls. Updates instantly.',
    'ko': '등록된 팬들이 진행 중인 투표에 참여하고 있어요. 실시간으로 업데이트됩니다.',
  },
  'home.activeFans': {'es': 'Fans activos', 'en': 'Active fans', 'ko': '활동 팬'},
  'home.activityPerMin': {
    'es': 'Actividad/min',
    'en': 'Activity/min',
    'ko': '분당 활동',
  },
  'home.polls': {'es': 'Encuestas', 'en': 'Polls', 'ko': '투표'},
  'home.noRecentActivityTitle': {
    'es': 'Sin actividad reciente',
    'en': 'No recent activity',
    'ko': '최근 활동 없음',
  },
  'home.noRecentActivityDescription': {
    'es':
        'Cuando haya votos en encuestas activas, la actividad aparecerá aquí al instante.',
    'en':
        'When there are votes in active polls, activity will appear here instantly.',
    'ko': '진행 중인 투표에서 득표가 발생하면 활동이 실시간으로 여기에 표시됩니다.',
  },
  'home.pollFallback': {'es': 'Votación', 'en': 'Poll', 'ko': '투표'},
  'home.justVotedFor': {
    'es': 'acaba de votar por {name}',
    'en': 'just voted for {name}',
    'ko': '방금 {name}에게 투표했어요',
  },

  // Noticias (sección inicio)
  'home.news': {'es': 'NOTICIAS', 'en': 'NEWS', 'ko': '뉴스'},
  'home.musicMundial': {
    'es': 'Music Mundial',
    'en': 'Music Mundial',
    'ko': 'Music Mundial',
  },
  'home.seeMore': {'es': 'Ver más', 'en': 'See more', 'ko': '더 보기'},

  // Ranking / tarjeta de artista
  'home.noGroup': {'es': 'SIN GRUPO', 'en': 'NO GROUP', 'ko': '그룹 없음'},
  'home.followers': {'es': 'Seguidores', 'en': 'Followers', 'ko': '팔로워'},
  'home.votes': {'es': 'Votos', 'en': 'Votes', 'ko': '득표'},
  'home.votesCount': {
    'es': '{count} votos',
    'en': '{count} votes',
    'ko': '{count}표',
  },

  // Tiempo relativo de actividad
  'home.timeNow': {'es': 'ahora', 'en': 'now', 'ko': '방금'},
  'home.timeSecondsAgo': {
    'es': 'hace {count} s',
    'en': '{count}s ago',
    'ko': '{count}초 전',
  },
  'home.timeMinutesAgo': {
    'es': 'hace {count} min',
    'en': '{count} min ago',
    'ko': '{count}분 전',
  },
  'home.timeHoursAgo': {
    'es': 'hace {count} h',
    'en': '{count}h ago',
    'ko': '{count}시간 전',
  },
  'home.timeDaysAgo': {
    'es': 'hace {count} d',
    'en': '{count}d ago',
    'ko': '{count}일 전',
  },

  // Página de noticias
  'home.newsTitle': {'es': 'Noticias', 'en': 'News', 'ko': '뉴스'},
  'home.newsSubtitle': {
    'es':
        'Últimas noticias de música y entretenimiento cargadas desde el feed oficial de Music Mundial.',
    'en':
        'Latest music and entertainment news loaded from the official Music Mundial feed.',
    'ko': 'Music Mundial 공식 피드에서 불러온 최신 음악 및 엔터테인먼트 뉴스입니다.',
  },
  'home.newsLoadError': {
    'es': 'No se pudieron cargar las noticias.',
    'en': "Couldn't load the news.",
    'ko': '뉴스를 불러올 수 없습니다.',
  },
  'home.newsEmptySearch': {
    'es': 'No encontramos noticias para tu búsqueda.',
    'en': "We couldn't find news for your search.",
    'ko': '검색 결과에 해당하는 뉴스를 찾지 못했습니다.',
  },
  'home.searchNews': {'es': 'Buscar noticias', 'en': 'Search news', 'ko': '뉴스 검색'},
  'home.loadingNews': {
    'es': 'Cargando noticias...',
    'en': 'Loading news...',
    'ko': '뉴스 불러오는 중...',
  },
  'home.newsAvailable': {
    'es': '{count} noticias disponibles',
    'en': '{count} news available',
    'ko': '{count}개의 뉴스 이용 가능',
  },
  'home.newsShowing': {
    'es': 'Mostrando {loaded} de {total} noticias',
    'en': 'Showing {loaded} of {total} news',
    'ko': '뉴스 {total}개 중 {loaded}개 표시 중',
  },
  'home.newsSeenAll': {
    'es': 'Has visto las {loaded} noticias{extra}.',
    'en': "You've seen all {loaded} news{extra}.",
    'ko': '{loaded}개의 뉴스{extra}를 모두 확인했습니다.',
  },
  'home.newsSeenAllExtra': {
    'es': ' de {total}',
    'en': ' of {total}',
    'ko': ' (총 {total}개 중)',
  },
  'home.scrollToLoadMore': {
    'es': 'Desliza hacia abajo para cargar más',
    'en': 'Scroll down to load more',
    'ko': '아래로 스크롤하여 더 불러오기',
  },

  // Tarjeta de noticia
  'home.readNews': {'es': 'LEER NOTICIA', 'en': 'READ ARTICLE', 'ko': '기사 읽기'},

  // Misiones
  'home.missionsLoadError': {
    'es': 'No se pudieron cargar las misiones.',
    'en': "Couldn't load the missions.",
    'ko': '미션을 불러올 수 없습니다.',
  },
  'home.retry': {'es': 'Reintentar', 'en': 'Retry', 'ko': '다시 시도'},
  'home.earnExtraPoints': {
    'es': 'GANA PUNTOS EXTRA',
    'en': 'EARN EXTRA POINTS',
    'ko': '추가 포인트 획득',
  },
  'home.missionsTitle': {'es': 'Misiones', 'en': 'Missions', 'ko': '미션'},
  'home.completed': {'es': 'COMPLETADA', 'en': 'COMPLETED', 'ko': '완료'},
  'home.pending': {'es': 'DISPONIBLE', 'en': 'AVAILABLE', 'ko': '가능'},
  'home.progress': {'es': 'PROGRESO', 'en': 'PROGRESS', 'ko': '진행도'},
  'home.doMission': {'es': 'HACER MISIÓN', 'en': 'DO MISSION', 'ko': '미션 하기'},
  'home.viewDetail': {
    'es': 'VER DETALLE',
    'en': 'VIEW DETAILS',
    'ko': '자세히 보기',
  },
  'home.newMissionsSoon': {
    'es': 'NUEVAS MISIONES PRONTO',
    'en': 'NEW MISSIONS SOON',
    'ko': '새 미션 곧 공개',
  },
  'home.missionsEmptyDescription': {
    'es':
        'Estamos preparando retos para que puedas ganar puntos extra.',
    'en': "We're preparing challenges so you can earn extra points.",
    'ko': '추가 포인트를 얻을 수 있는 챌린지를 준비하고 있습니다.',
  },
  'home.verifyingMission': {
    'es': 'Verificando misión...',
    'en': 'Verifying mission...',
    'ko': '미션 확인 중...',
  },
  'home.missionCompletedMessage': {
    'es': '¡Misión completada! Tus puntos se actualizarán.',
    'en': 'Mission completed! Your points will be updated.',
    'ko': '미션 완료! 포인트가 곧 업데이트됩니다.',
  },
  'home.missionRegisterError': {
    'es': 'No se pudo registrar la misión. Intenta otra vez.',
    'en': "Couldn't register the mission. Try again.",
    'ko': '미션을 등록할 수 없습니다. 다시 시도해 주세요.',
  },
  'home.missionAutoValidate': {
    'es':
        'Esta misión se valida automáticamente. Completa la acción en la app.',
    'en':
        'This mission is validated automatically. Complete the action in the app.',
    'ko': '이 미션은 자동으로 확인됩니다. 앱에서 해당 활동을 완료하세요.',
  },
  'home.validating': {'es': 'VALIDANDO...', 'en': 'VALIDATING...', 'ko': '확인 중...'},

  // Comunidad
  'home.community': {'es': 'COMUNIDAD', 'en': 'COMMUNITY', 'ko': '커뮤니티'},
  'home.communityStartlyTitle': {
    'es': 'Comunidad Startly',
    'en': 'Startly Community',
    'ko': 'Startly 커뮤니티',
  },
  'home.communityStartlyDescription': {
    'es':
        'Entra al hub de Music Mundial para descubrir enlaces, novedades y contenido destacado.',
    'en':
        'Enter the Music Mundial hub to discover links, news and featured content.',
    'ko': 'Music Mundial 허브에서 링크, 소식, 추천 콘텐츠를 만나보세요.',
  },
  'home.officialLink': {'es': 'Link oficial', 'en': 'Official link', 'ko': '공식 링크'},
  'home.communityXTitle': {
    'es': 'Music Mundial en X',
    'en': 'Music Mundial on X',
    'ko': 'X의 Music Mundial',
  },
  'home.communityXDescription': {
    'es':
        'Sigue noticias, votaciones, tendencias KPOP y actualizaciones de la comunidad.',
    'en': 'Follow news, polls, KPOP trends and community updates.',
    'ko': '뉴스, 투표, KPOP 트렌드, 커뮤니티 소식을 팔로우하세요.',
  },
  'home.communityXFollowers': {
    'es': '43.5K seguidores',
    'en': '43.5K followers',
    'ko': '팔로워 43.5K',
  },
  'home.openCommunity': {
    'es': 'ABRIR COMUNIDAD',
    'en': 'OPEN COMMUNITY',
    'ko': '커뮤니티 열기',
  },

  // Recompensa diaria (modal)
  'home.rewardClaimError': {
    'es': 'No se pudo reclamar la recompensa. Intenta otra vez.',
    'en': "Couldn't claim the reward. Try again.",
    'ko': '보상을 받을 수 없습니다. 다시 시도해 주세요.',
  },
  'home.dailyReward': {'es': 'RECOMPENSA DIARIA', 'en': 'DAILY REWARD', 'ko': '일일 보상'},
  'home.sevenDayStreak': {
    'es': 'Racha de 7 días',
    'en': '7-day streak',
    'ko': '7일 연속 출석',
  },
  'home.dailyRewardDescription': {
    'es':
        'Entra cada día y reclama puntos gratis para apoyar a tu artista favorito. Cada día suma sus propios puntos dentro de la semana.',
    'en':
        'Come in every day and claim free points to support your favorite artist. Each day adds its own points within the week.',
    'ko': '매일 접속해 무료 포인트를 받아 좋아하는 아티스트를 응원하세요. 매일 그날의 포인트가 한 주 동안 쌓입니다.',
  },
  'home.weeklyTotalPoints': {
    'es': 'Total semanal sumatorio: {total} pts',
    'en': 'Weekly cumulative total: {total} pts',
    'ko': '주간 누적 합계: {total} pts',
  },
  'home.streakRules': {
    'es':
        'Si completas los 7 días, la racha vuelve al Día 1 la semana siguiente. Si faltas un día, la racha reinicia.',
    'en':
        'If you complete the 7 days, the streak returns to Day 1 the next week. If you miss a day, the streak resets.',
    'ko': '7일을 모두 완료하면 다음 주에 1일 차로 돌아갑니다. 하루라도 빠지면 연속 기록이 초기화됩니다.',
  },
  'home.todayClaimed': {
    'es': 'HOY ✓ RECLAMADO',
    'en': 'TODAY ✓ CLAIMED',
    'ko': '오늘 ✓ 수령 완료',
  },
  'home.todayPoints': {
    'es': 'HOY +{points} pts',
    'en': 'TODAY +{points} pts',
    'ko': '오늘 +{points} pts',
  },
  'home.claimedTodayPoints': {
    'es': 'Reclamaste +{points} pts hoy',
    'en': 'You claimed +{points} pts today',
    'ko': '오늘 +{points} pts를 받았어요',
  },
  'home.rewardReady': {
    'es': 'Tu recompensa de hoy está lista',
    'en': 'Your reward for today is ready',
    'ko': '오늘의 보상이 준비되었어요',
  },
  'home.comeBackTomorrow': {
    'es': 'Vuelve mañana por ',
    'en': 'Come back tomorrow for ',
    'ko': '내일 다시 오세요 · ',
  },
  'home.plusPoints': {'es': '+{points} pts', 'en': '+{points} pts', 'ko': '+{points} pts'},
  'home.dayLabel': {'es': ' · Día {day}', 'en': ' · Day {day}', 'ko': ' · {day}일 차'},
  'home.claiming': {'es': 'RECLAMANDO...', 'en': 'CLAIMING...', 'ko': '수령 중...'},
  'home.claimNow': {'es': 'RECLAMAR AHORA', 'en': 'CLAIM NOW', 'ko': '지금 받기'},
  'home.dayUpper': {'es': 'DÍA {day}', 'en': 'DAY {day}', 'ko': '{day}일 차'},
  'home.pts': {'es': 'PTS', 'en': 'PTS', 'ko': 'PTS'},
  'home.rewardClaimed': {
    'es': '¡RECOMPENSA RECLAMADA!',
    'en': 'REWARD CLAIMED!',
    'ko': '보상 수령 완료!',
  },
  'home.earnedPoints': {
    'es': 'Sumaste +{points} pts',
    'en': 'You earned +{points} pts',
    'ko': '+{points} pts를 획득했어요',
  },
  'home.pointsAvailable': {
    'es':
        'Tus puntos ya están disponibles para apoyar a tu artista favorito.',
    'en': 'Your points are now available to support your favorite artist.',
    'ko': '이제 포인트로 좋아하는 아티스트를 응원할 수 있어요.',
  },
  'home.currentTotal': {
    'es': 'Total actual: {total} pts',
    'en': 'Current total: {total} pts',
    'ko': '현재 합계: {total} pts',
  },
  'home.continueUpper': {'es': 'CONTINUAR', 'en': 'CONTINUE', 'ko': '계속하기'},

  // Banner de recompensa diaria
  'home.alreadyClaimedDay': {
    'es': 'Ya reclamaste hoy · Día {day} completado',
    'en': 'You already claimed today · Day {day} completed',
    'ko': '오늘 이미 수령함 · {day}일 차 완료',
  },
  'home.claimFreePoints': {
    'es': 'Reclama tus puntos gratis de hoy',
    'en': 'Claim your free points for today',
    'ko': '오늘의 무료 포인트를 받으세요',
  },
  'home.done': {'es': 'LISTO', 'en': 'DONE', 'ko': '완료'},
  'home.open': {'es': 'ABRIR', 'en': 'OPEN', 'ko': '열기'},
};
