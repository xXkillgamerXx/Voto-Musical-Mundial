/// Catálogo de cadenas para las pantallas de catálogo:
/// votaciones, artistas, perfil de artista, ranking de popularidad,
/// tarjeta de artista y salón de la fama.
///
/// Todas las claves usan el prefijo de namespace `catalog.`.
const Map<String, Map<String, String>> catalogStrings = {
  // Comunes / reutilizadas
  'catalog.followers': {'es': 'Seguidores', 'en': 'Followers', 'ko': '팔로워'},
  'catalog.popularity': {'es': 'Popularidad', 'en': 'Popularity', 'ko': '인기도'},
  'catalog.noGroup': {'es': 'Sin grupo', 'en': 'No group', 'ko': '그룹 없음'},
  'catalog.cancel': {'es': 'Cancelar', 'en': 'Cancel', 'ko': '취소'},
  'catalog.votesCount': {
    'es': '{count} votos',
    'en': '{count} votes',
    'ko': '{count}표',
  },

  // Pantalla de votaciones (polls_page)
  'catalog.pollsEyebrow': {'es': 'VOTACIONES', 'en': 'POLLS', 'ko': '투표'},
  'catalog.pollsTitle': {
    'es': 'Todas las encuestas',
    'en': 'All polls',
    'ko': '전체 투표',
  },
  'catalog.pollsSubtitle': {
    'es': 'Explora votaciones abiertas y consulta resultados de las cerradas.',
    'en': 'Explore open polls and check results from closed ones.',
    'ko': '진행 중인 투표를 살펴보고 종료된 투표의 결과를 확인하세요.',
  },
  'catalog.pollsTabOpen': {'es': 'Abiertas', 'en': 'Open', 'ko': '진행 중'},
  'catalog.pollsTabClosed': {'es': 'Cerradas', 'en': 'Closed', 'ko': '종료됨'},
  'catalog.pollsLoadError': {
    'es': 'No se pudieron cargar las votaciones.',
    'en': 'Could not load the polls.',
    'ko': '투표를 불러올 수 없습니다.',
  },
  'catalog.pollsRetryHint': {
    'es': 'Desliza hacia abajo para reintentar.',
    'en': 'Swipe down to retry.',
    'ko': '아래로 당겨서 다시 시도하세요.',
  },
  'catalog.pollsEmptyOpenTitle': {
    'es': 'Sin votaciones abiertas',
    'en': 'No open polls',
    'ko': '진행 중인 투표 없음',
  },
  'catalog.pollsEmptyOpenSubtitle': {
    'es': 'Cuando haya encuestas en vivo o en proceso, aparecerán aquí.',
    'en': 'When there are live or in-progress polls, they will appear here.',
    'ko': '라이브 또는 진행 중인 투표가 있으면 여기에 표시됩니다.',
  },
  'catalog.pollsEmptyClosedTitle': {
    'es': 'Sin votaciones cerradas',
    'en': 'No closed polls',
    'ko': '종료된 투표 없음',
  },
  'catalog.pollsEmptyClosedSubtitle': {
    'es': 'Cuando finalice una votación, sus resultados quedarán aquí.',
    'en': 'When a poll ends, its results will remain here.',
    'ko': '투표가 종료되면 결과가 여기에 남습니다.',
  },
  'catalog.pollsCategorySelected': {
    'es': 'CATEGORÍA SELECCIONADA',
    'en': 'SELECTED CATEGORY',
    'ko': '선택한 카테고리',
  },
  'catalog.pollsViewAll': {
    'es': 'Ver todas',
    'en': 'View all',
    'ko': '전체 보기',
  },
  'catalog.pollsEmptyCategoryTitle': {
    'es': 'Sin votaciones en esta categoría',
    'en': 'No polls in this category',
    'ko': '이 카테고리에 투표가 없습니다',
  },
  'catalog.pollsEmptyCategorySubtitle': {
    'es': 'Prueba otra categoría o mira todas las votaciones.',
    'en': 'Try another category or view all polls.',
    'ko': '다른 카테고리를 보거나 전체 투표를 확인하세요.',
  },
  'catalog.pollFallbackTitle': {'es': 'Votación', 'en': 'Poll', 'ko': '투표'},
  'catalog.pollActionViewProcess': {
    'es': 'Ver proceso',
    'en': 'View process',
    'ko': '진행 상황 보기',
  },
  'catalog.pollActionViewResults': {
    'es': 'Ver resultados',
    'en': 'View results',
    'ko': '결과 보기',
  },
  'catalog.pollActionVoteNow': {
    'es': 'Votar ahora',
    'en': 'Vote now',
    'ko': '지금 투표하기',
  },
  'catalog.pollFinished': {'es': 'Finalizada', 'en': 'Finished', 'ko': '종료됨'},
  'catalog.pollLive': {'es': 'En vivo', 'en': 'Live', 'ko': '라이브'},
  'catalog.pollEndedOn': {
    'es': 'Terminó {date}',
    'en': 'Ended {date}',
    'ko': '{date} 종료',
  },
  'catalog.pollEndsOn': {
    'es': 'Termina {date}',
    'en': 'Ends {date}',
    'ko': '{date} 종료 예정',
  },
  'catalog.statusLive': {'es': 'EN VIVO', 'en': 'LIVE', 'ko': '라이브'},
  'catalog.statusInProcess': {
    'es': 'EN PROCESO',
    'en': 'IN PROGRESS',
    'ko': '진행 중',
  },
  'catalog.statusClosed': {'es': 'CERRADA', 'en': 'CLOSED', 'ko': '종료됨'},

  // Pantalla de artistas (artists_page)
  'catalog.artistsLoadError': {
    'es': 'No se pudieron cargar los artistas.',
    'en': 'Could not load the artists.',
    'ko': '아티스트를 불러올 수 없습니다.',
  },
  'catalog.artistsTitle': {
    'es': 'Artistas populares de la semana',
    'en': 'Popular artists of the week',
    'ko': '이번 주 인기 아티스트',
  },
  'catalog.artistsSubtitle': {
    'es':
        'Ranking público por fans. Abre cada perfil para ver popularidad, votos y apoyo del fandom.',
    'en':
        'Public ranking by fans. Open each profile to see popularity, votes and fandom support.',
    'ko': '팬이 뽑은 공개 랭킹입니다. 각 프로필을 열어 인기도, 투표 수, 팬덤 응원을 확인하세요.',
  },
  'catalog.artistsSearchEmpty': {
    'es': 'No encontramos artistas con esa búsqueda.',
    'en': "We couldn't find artists with that search.",
    'ko': '해당 검색어에 맞는 아티스트를 찾을 수 없습니다.',
  },
  'catalog.artistsSearchLabel': {
    'es': 'Buscar artista',
    'en': 'Search artist',
    'ko': '아티스트 검색',
  },
  'catalog.artistsAvailableCount': {
    'es': '{count} artistas disponibles',
    'en': '{count} artists available',
    'ko': '{count}명의 아티스트',
  },

  // Perfil de artista (artist_profile_page)
  'catalog.profileBioFallback': {
    'es': 'Perfil público con popularidad, fans y actividad en votaciones.',
    'en': 'Public profile with popularity, fans and activity in polls.',
    'ko': '인기도, 팬, 투표 활동을 담은 공개 프로필입니다.',
  },
  'catalog.profileAccumulatedVotes': {
    'es': 'Votos acumulados',
    'en': 'Accumulated votes',
    'ko': '누적 투표 수',
  },
  'catalog.profileAverageSupport': {
    'es': 'Apoyo promedio',
    'en': 'Average support',
    'ko': '평균 응원율',
  },
  'catalog.profileFollowError': {
    'es': 'No se pudo actualizar el seguimiento.',
    'en': 'Could not update the follow status.',
    'ko': '팔로우 상태를 업데이트할 수 없습니다.',
  },
  'catalog.profileUnfollow': {
    'es': 'Dejar de seguir',
    'en': 'Unfollow',
    'ko': '팔로우 취소',
  },
  'catalog.profileUnfollowConfirm': {
    'es': '¿Quieres dejar de seguir a {name}?',
    'en': 'Do you want to unfollow {name}?',
    'ko': '{name} 팔로우를 취소하시겠습니까?',
  },
  'catalog.profileEyebrow': {
    'es': 'PERFIL DE ARTISTA',
    'en': 'ARTIST PROFILE',
    'ko': '아티스트 프로필',
  },
  'catalog.profileSignInToFollow': {
    'es': 'Inicia sesión para seguir',
    'en': 'Sign in to follow',
    'ko': '팔로우하려면 로그인하세요',
  },
  'catalog.profileFollowing': {
    'es': 'SIGUIENDO',
    'en': 'FOLLOWING',
    'ko': '팔로잉',
  },
  'catalog.profileFollow': {'es': 'SEGUIR', 'en': 'FOLLOW', 'ko': '팔로우'},
  'catalog.profileDataTitle': {'es': 'DATOS', 'en': 'DETAILS', 'ko': '정보'},
  'catalog.profileRole': {'es': 'Rol', 'en': 'Role', 'ko': '역할'},
  'catalog.profileRoleFallback': {
    'es': 'Artista',
    'en': 'Artist',
    'ko': '아티스트',
  },
  'catalog.profileCountry': {'es': 'País', 'en': 'Country', 'ko': '국가'},
  'catalog.profileNotDefined': {
    'es': 'No definido',
    'en': 'Not defined',
    'ko': '미정',
  },
  'catalog.profileFandom': {'es': 'Fandom', 'en': 'Fandom', 'ko': '팬덤'},
  'catalog.profileAchievements': {
    'es': 'LOGROS',
    'en': 'ACHIEVEMENTS',
    'ko': '업적',
  },
  'catalog.profileNoAchievements': {
    'es': 'Sin logros todavía',
    'en': 'No achievements yet',
    'ko': '아직 업적이 없습니다',
  },
  'catalog.profileCurrentSupport': {
    'es': 'Apoyo actual',
    'en': 'Current support',
    'ko': '현재 지지율',
  },
  'catalog.profileWinnerBadge': {
    'es': 'GANADOR',
    'en': 'WINNER',
    'ko': '우승',
  },
  'catalog.profileVotesCount': {
    'es': '{count} votos',
    'en': '{count} votes',
    'ko': '{count}표',
  },
  'catalog.profileNoRoundsEyebrow': {
    'es': 'SIN RONDAS REGISTRADAS',
    'en': 'NO ROUNDS RECORDED',
    'ko': '기록된 라운드 없음',
  },
  'catalog.profileNoVotesTitle': {
    'es': 'Aún no hay votos de {name}',
    'en': 'No votes for {name} yet',
    'ko': '아직 {name}의 투표가 없습니다',
  },
  'catalog.profileNoVotesBody': {
    'es':
        'Este artista todavía no aparece con votos registrados en rondas cerradas o activas. Cuando participe en una votación, aquí verás su apoyo, porcentaje y resultados.',
    'en':
        'This artist does not yet appear with recorded votes in closed or active rounds. When they take part in a poll, you will see their support, percentage and results here.',
    'ko': '이 아티스트는 아직 종료되거나 진행 중인 라운드에 기록된 투표가 없습니다. 투표에 참여하면 여기에서 응원, 비율, 결과를 확인할 수 있습니다.',
  },
  'catalog.profileViewPolls': {
    'es': 'VER VOTACIONES',
    'en': 'VIEW POLLS',
    'ko': '투표 보기',
  },

  // Ranking de popularidad (ranking_popularity_page)
  'catalog.rankingLoadError': {
    'es': 'No se pudo cargar el Ranking Popularity.',
    'en': 'Could not load the Popularity Ranking.',
    'ko': '인기 랭킹을 불러올 수 없습니다.',
  },
  'catalog.rankingShowing': {
    'es': 'Mostrando {shown} de {total}',
    'en': 'Showing {shown} of {total}',
    'ko': '{total}개 중 {shown}개 표시',
  },
  'catalog.rankingFullChart': {
    'es': 'FULL CHART',
    'en': 'FULL CHART',
    'ko': 'FULL CHART',
  },
  'catalog.rankingLoadMore': {
    'es': 'Ver más ({count} restantes)',
    'en': 'Show more ({count} remaining)',
    'ko': '더 보기 ({count}개 남음)',
  },
  'catalog.rankingNew': {'es': 'NEW', 'en': 'NEW', 'ko': 'NEW'},
  'catalog.rankingBillboardStyle': {
    'es': 'BILLBOARD STYLE CHART',
    'en': 'BILLBOARD STYLE CHART',
    'ko': 'BILLBOARD STYLE CHART',
  },
  'catalog.rankingTitle': {
    'es': 'RANKING\nPOPULARITY',
    'en': 'RANKING\nPOPULARITY',
    'ko': 'RANKING\nPOPULARITY',
  },
  'catalog.rankingHeroSubtitle': {
    'es':
        'El chart oficial de artistas populares según seguidores, votos acumulados y apoyo del público en las votaciones.',
    'en':
        'The official chart of popular artists based on followers, accumulated votes and public support in polls.',
    'ko': '팔로워, 누적 투표 수, 투표에서의 대중 응원을 기준으로 한 인기 아티스트 공식 차트입니다.',
  },
  'catalog.rankingChartMetrics': {
    'es': 'CHART METRICS',
    'en': 'CHART METRICS',
    'ko': 'CHART METRICS',
  },
  'catalog.rankingMetricArtists': {
    'es': 'Artistas',
    'en': 'Artists',
    'ko': '아티스트',
  },
  'catalog.rankingMetricVotes': {'es': 'Votos', 'en': 'Votes', 'ko': '투표 수'},
  'catalog.rankingTop3': {'es': 'TOP 3', 'en': 'TOP 3', 'ko': 'TOP 3'},
  'catalog.rankingHotArtists': {
    'es': 'Hot artists',
    'en': 'Hot artists',
    'ko': '핫 아티스트',
  },
  'catalog.rankingHotArtist': {
    'es': 'HOT ARTIST',
    'en': 'HOT ARTIST',
    'ko': 'HOT ARTIST',
  },
  'catalog.rankingPopularityScore': {
    'es': 'POPULARITY SCORE',
    'en': 'POPULARITY SCORE',
    'ko': 'POPULARITY SCORE',
  },
  'catalog.rankingLastWeek': {
    'es': 'Last week',
    'en': 'Last week',
    'ko': '지난주',
  },
  'catalog.rankingPeak': {'es': 'Peak', 'en': 'Peak', 'ko': '최고 순위'},
  'catalog.rankingWeeks': {'es': 'Weeks', 'en': 'Weeks', 'ko': '주 수'},
  'catalog.rankingChartRowMeta': {
    'es': '{group} · {followers} seguidores · {votes} votos',
    'en': '{group} · {followers} followers · {votes} votes',
    'ko': '{group} · 팔로워 {followers} · 투표 {votes}',
  },
  'catalog.rankingScore': {'es': 'SCORE', 'en': 'SCORE', 'ko': 'SCORE'},
  'catalog.rankingLast': {'es': 'Last', 'en': 'Last', 'ko': '지난주'},
  'catalog.rankingEmptyTitle': {
    'es': 'RANKING POPULARITY EN PREPARACIÓN',
    'en': 'POPULARITY RANKING IN PREPARATION',
    'ko': '인기 랭킹 준비 중',
  },
  'catalog.rankingEmptyBody': {
    'es':
        'Cuando los artistas acumulen votos, seguidores y actividad, el ranking se ordenará automáticamente aquí.',
    'en':
        'When artists accumulate votes, followers and activity, the ranking will sort automatically here.',
    'ko': '아티스트가 투표, 팔로워, 활동을 쌓으면 랭킹이 여기에 자동으로 정렬됩니다.',
  },
  'catalog.rankingWeekLabel': {
    'es': '{year} · Semana {week}',
    'en': '{year} · Week {week}',
    'ko': '{year} · {week}주차',
  },

  // Tarjeta de artista (artist_card)
  'catalog.artistCardBioFallback': {
    'es': 'Perfil público con actividad, fans y popularidad.',
    'en': 'Public profile with activity, fans and popularity.',
    'ko': '활동, 팬, 인기도를 담은 공개 프로필입니다.',
  },
  'catalog.artistCardPopular': {
    'es': 'POPULAR',
    'en': 'POPULAR',
    'ko': '인기',
  },
  'catalog.artistCardViewProfile': {
    'es': 'VER PERFIL',
    'en': 'VIEW PROFILE',
    'ko': '프로필 보기',
  },

  // Salón de la fama (hall_of_fame_page)
  'catalog.hofTitle': {
    'es': 'Salón de la fama',
    'en': 'Hall of Fame',
    'ko': '명예의 전당',
  },
  'catalog.hofLoadError': {
    'es': 'No se pudo cargar el salón de la fama.',
    'en': 'Could not load the hall of fame.',
    'ko': '명예의 전당을 불러올 수 없습니다.',
  },
  'catalog.hofWinnersEyebrow': {
    'es': 'GANADORES',
    'en': 'WINNERS',
    'ko': '우승자',
  },
  'catalog.hofHeroSubtitle': {
    'es': 'Artistas que llegaron al primer lugar en votaciones finalizadas.',
    'en': 'Artists who reached first place in finished polls.',
    'ko': '종료된 투표에서 1위를 차지한 아티스트입니다.',
  },
  'catalog.hofHistory': {'es': 'Historial', 'en': 'History', 'ko': '기록'},
  'catalog.hofYear': {'es': 'AÑO', 'en': 'YEAR', 'ko': '연도'},
  'catalog.hofWinnersCount': {
    'es': '{count} GANADORES',
    'en': '{count} WINNERS',
    'ko': '우승자 {count}명',
  },
  'catalog.hofViewPoll': {
    'es': 'VER VOTACIÓN',
    'en': 'VIEW POLL',
    'ko': '투표 보기',
  },
  'catalog.hofEmptyTitle': {
    'es': 'SALÓN DE LA FAMA EN PREPARACIÓN',
    'en': 'HALL OF FAME IN PREPARATION',
    'ko': '명예의 전당 준비 중',
  },
  'catalog.hofEmptyBody': {
    'es':
        'Cuando una votación cerrada tenga ganador, aparecerá aquí como parte del historial oficial.',
    'en':
        'When a closed poll has a winner, it will appear here as part of the official history.',
    'ko': '종료된 투표에 우승자가 정해지면 공식 기록의 일부로 여기에 표시됩니다.',
  },
};
