/// Cadenas de la pantalla de detalle de votación (`poll_detail_page.dart`).
const Map<String, Map<String, String>> pollDetailStrings = {
  // Mensajes (SnackBars) y errores
  'pollDetail.roundNotOpen': {
    'es': 'Esta ronda no está abierta para votar.',
    'en': 'This round is not open for voting.',
    'ko': '이 라운드는 아직 투표할 수 없습니다.',
  },
  'pollDetail.loginToVote': {
    'es': 'Inicia sesión para votar.',
    'en': 'Log in to vote.',
    'ko': '투표하려면 로그인하세요.',
  },
  'pollDetail.notEnoughPoints': {
    'es': 'No tienes puntos suficientes para votar.',
    'en': "You don't have enough points to vote.",
    'ko': '투표할 포인트가 부족합니다.',
  },
  'pollDetail.freeVoteTitle': {
    'es': 'VOTO GRATIS',
    'en': 'FREE VOTE',
    'ko': '무료 투표',
  },
  'pollDetail.freeVoteDescription': {
    'es': 'No tienes puntos. Puedes usar 1 voto gratis con el tiempo configurado en la votación.',
    'en': "You're out of points. You can use 1 free vote with the poll cooldown.",
    'ko': '포인트가 없습니다. 투표 대기 시간에 맞춰 무료 1표를 사용할 수 있습니다.',
  },
  'pollDetail.freeVoteCooldownHint': {
    'es': 'Luego deberás esperar {minutes} min para otro voto gratis.',
    'en': 'Then wait {minutes} min for another free vote.',
    'ko': '이후 {minutes}분 후에 다시 무료 투표할 수 있습니다.',
  },
  'pollDetail.freeVoteConfirm': {
    'es': 'USAR VOTO GRATIS',
    'en': 'USE FREE VOTE',
    'ko': '무료 투표하기',
  },
  'pollDetail.freeVoteWait': {
    'es': 'Tu próximo voto gratis estará listo en {time}.',
    'en': 'Your next free vote will be ready in {time}.',
    'ko': '{time} 후에 무료 투표를 다시 할 수 있습니다.',
  },
  'pollDetail.freeVoteSuccess': {
    'es': '¡Voto gratis registrado!',
    'en': 'Free vote counted!',
    'ko': '무료 투표가 반영되었습니다!',
  },
  'pollDetail.freeVoteSuccessWait': {
    'es': '¡Voto gratis registrado! Próximo en {time}.',
    'en': 'Free vote counted! Next in {time}.',
    'ko': '무료 투표 완료! 다음까지 {time}.',
  },
  'pollDetail.freeVoteWaitLabel': {
    'es': 'PRÓXIMO VOTO GRATIS',
    'en': 'NEXT FREE VOTE',
    'ko': '다음 무료 투표',
  },
  'pollDetail.freeVoteMissionsShare': {
    'es': 'Comparte para ayudar a subir',
    'en': 'Share to help them climb',
    'ko': '공유해서 순위를 올려주세요',
  },
  'pollDetail.freeVoteMissionsTitle': {
    'es': 'CONSIGUE MÁS VOTOS',
    'en': 'GET MORE VOTES',
    'ko': '더 많은 표 받기',
  },
  'pollDetail.freeVoteMissionsBody': {
    'es': 'Completa tus misiones para ganar puntos y seguir votando sin esperar.',
    'en': 'Complete your missions to earn points and keep voting without waiting.',
    'ko': '미션을 완료해 포인트를 얻고 기다림 없이 계속 투표하세요.',
  },
  'pollDetail.freeVoteMissionsPending': {
    'es': 'Te quedan {count} misiones por completar.',
    'en': 'You have {count} missions left.',
    'ko': '남은 미션 {count}개.',
  },
  'pollDetail.freeVoteMissionsGo': {
    'es': 'IR A MISIONES',
    'en': 'GO TO MISSIONS',
    'ko': '미션으로 가기',
  },
  'pollDetail.freeVoteMissionsLater': {
    'es': 'Ahora no',
    'en': 'Not now',
    'ko': '나중에',
  },
  'pollDetail.watchAdMissionTitle': {
    'es': 'Ver video',
    'en': 'Watch video',
    'ko': '영상 보기',
  },
  'pollDetail.watchAdMissionDescription': {
    'es': 'Mira un anuncio corto y gana puntos extra.',
    'en': 'Watch a short ad and earn extra points.',
    'ko': '짧은 광고를 보고 추가 포인트를 받으세요.',
  },
  'pollDetail.watchAdForPoints': {
    'es': 'Ver video (+{points} pts)',
    'en': 'Watch video (+{points} pts)',
    'ko': '영상 보기 (+{points} pts)',
  },
  'pollDetail.watchAdHint': {
    'es': 'Mira un anuncio corto y gana puntos para seguir votando.',
    'en': 'Watch a short ad and earn points to keep voting.',
    'ko': '짧은 광고를 보고 포인트를 받아 계속 투표하세요.',
  },
  'pollDetail.watchAdLoading': {
    'es': 'Cargando anuncio...',
    'en': 'Loading ad...',
    'ko': '광고 로딩 중...',
  },
  'pollDetail.watchAdEarned': {
    'es': '¡Listo! Sumaste +{points} pts.',
    'en': 'Done! You earned +{points} pts.',
    'ko': '완료! +{points} pts를 받았어요.',
  },
  'pollDetail.watchAdGiftSender': {
    'es': 'Recompensa del anuncio',
    'en': 'Ad reward',
    'ko': '광고 보상',
  },
  'pollDetail.watchAdGiftMessage': {
    'es': 'Miraste un video y ganaste {points} puntos de regalo.',
    'en': 'You watched a video and earned {points} gift points.',
    'ko': '영상을 보고 {points} 포인트 선물을 받았어요.',
  },
  'pollDetail.watchAdFailed': {
    'es': 'No se pudo mostrar el anuncio. Intenta de nuevo.',
    'en': "Couldn't show the ad. Try again.",
    'ko': '광고를 표시하지 못했습니다. 다시 시도하세요.',
  },
  'pollDetail.freeVoteMissionsBanner': {
    'es': 'Haz misiones y gana puntos para votar sin esperar',
    'en': 'Do missions and earn points to vote without waiting',
    'ko': '미션으로 포인트를 모아 기다림 없이 투표하세요',
  },
  'pollDetail.requestFailed': {
    'es': 'No se pudo completar la solicitud.',
    'en': 'The request could not be completed.',
    'ko': '요청을 완료할 수 없습니다.',
  },

  // Hoja de confirmación de voto
  'pollDetail.confirmVotes': {
    'es': 'CONFIRMAR VOTOS',
    'en': 'CONFIRM VOTES',
    'ko': '투표 확인',
  },
  'pollDetail.artist': {'es': 'Artista', 'en': 'Artist', 'ko': '아티스트'},
  'pollDetail.pointsAvailable': {
    'es': 'Tienes {points} pts disponibles',
    'en': 'You have {points} pts available',
    'ko': '{points} 포인트 사용 가능',
  },
  'pollDetail.howManyVotes': {
    'es': '¿CUÁNTOS VOTOS QUIERES DAR?',
    'en': 'HOW MANY VOTES DO YOU WANT TO GIVE?',
    'ko': '몇 표를 주시겠어요?',
  },
  'pollDetail.maxVotes': {
    'es': 'Máximo: {count} votos',
    'en': 'Maximum: {count} votes',
    'ko': '최대: {count}표',
  },
  'pollDetail.voteSingular': {
    'es': '{count} voto',
    'en': '{count} vote',
    'ko': '{count}표',
  },
  'pollDetail.votePlural': {
    'es': '{count} votos',
    'en': '{count} votes',
    'ko': '{count}표',
  },

  // Botones de voto
  'pollDetail.vote': {'es': 'VOTAR', 'en': 'VOTE', 'ko': '투표'},
  'pollDetail.freeVote': {
    'es': 'VOTO GRATIS',
    'en': 'FREE VOTE',
    'ko': '무료 투표',
  },
  'pollDetail.freeVoteCountdown': {
    'es': 'GRATIS EN {time}',
    'en': 'FREE IN {time}',
    'ko': '{time} 후 무료',
  },
  'pollDetail.votingClosed': {
    'es': 'VOTACIÓN CERRADA',
    'en': 'VOTING CLOSED',
    'ko': '투표 마감',
  },
  'pollDetail.closed': {'es': 'CERRADA', 'en': 'CLOSED', 'ko': '마감'},

  // Cabecera / título
  'pollDetail.defaultTitle': {'es': 'Votación', 'en': 'Voting', 'ko': '투표'},
  'pollDetail.share': {
    'es': 'Compartir',
    'en': 'Share',
    'ko': '공유',
  },
  'pollDetail.shareCardHint': {
    'es': 'Comparte esta votación con tus amigos',
    'en': 'Share this poll with your friends',
    'ko': '친구들과 이 투표를 공유하세요',
  },
  'pollDetail.shareBannerTitle': {
    'es': 'Comparte esta votación',
    'en': 'Share this poll',
    'ko': '이 투표 공유하기',
  },
  'pollDetail.shareBannerHint': {
    'es': 'Resultados, actualizaciones y más apoyo para tu artista',
    'en': 'Results, updates and more support for your artist',
    'ko': '결과, 업데이트, 그리고 아티스트를 위한 더 많은 지지',
  },
  'pollDetail.shareBannerCta': {
    'es': 'Compartir',
    'en': 'Share',
    'ko': '공유',
  },
  'pollDetail.followInstagramTitle': {
    'es': 'Sigue a Music Mundial',
    'en': 'Follow Music Mundial',
    'ko': 'Music Mundial 팔로우',
  },
  'pollDetail.followInstagramHint': {
    'es': 'Actualizaciones de votaciones, resultados y contenido exclusivo',
    'en': 'Poll updates, results and exclusive content',
    'ko': '투표 업데이트, 결과와 독점 콘텐츠',
  },
  'pollDetail.followInstagramCta': {
    'es': 'Seguir',
    'en': 'Follow',
    'ko': '팔로우',
  },
  'pollDetail.followUsTitle': {
    'es': 'Sigue a Music Mundial',
    'en': 'Follow Music Mundial',
    'ko': 'Music Mundial 팔로우',
  },
  'pollDetail.followUsSubtitle': {
    'es': 'Nuevas votaciones, resultados en vivo y ganadores — primero en tus redes.',
    'en': 'New polls, live results and winners — first on your feed.',
    'ko': '새 투표, 실시간 결과와 우승자 — 피드에서 가장 먼저.',
  },
  'pollDetail.liveVoting': {
    'es': 'VOTACIÓN EN VIVO',
    'en': 'LIVE VOTING',
    'ko': '실시간 투표',
  },
  'pollDetail.noParticipants': {
    'es': 'Esta ronda todavía no tiene participantes.',
    'en': 'This round has no participants yet.',
    'ko': '이 라운드에는 아직 참가자가 없습니다.',
  },

  // Cuenta regresiva
  'pollDetail.timeRemaining': {
    'es': 'TIEMPO RESTANTE',
    'en': 'TIME REMAINING',
    'ko': '남은 시간',
  },
  'pollDetail.days': {'es': 'DÍAS', 'en': 'DAYS', 'ko': '일'},
  'pollDetail.hours': {'es': 'HORAS', 'en': 'HOURS', 'ko': '시간'},
  'pollDetail.min': {'es': 'MIN', 'en': 'MIN', 'ko': '분'},
  'pollDetail.sec': {'es': 'SEG', 'en': 'SEC', 'ko': '초'},

  // Pestañas de rondas
  'pollDetail.round': {
    'es': 'Ronda {number}',
    'en': 'Round {number}',
    'ko': '{number} 라운드',
  },
  'pollDetail.live': {'es': 'EN VIVO', 'en': 'LIVE', 'ko': '실시간'},
  'pollDetail.upcoming': {'es': 'PRÓXIMA', 'en': 'UPCOMING', 'ko': '예정'},

  // Panel de conteo de votos
  'pollDetail.countingInProgress': {
    'es': 'CONTEO EN PROCESO',
    'en': 'COUNTING IN PROGRESS',
    'ko': '집계 진행 중',
  },
  'pollDetail.countingVotes': {
    'es': 'Estamos contando los votos',
    'en': 'We are counting the votes',
    'ko': '투표를 집계하고 있습니다',
  },
  'pollDetail.countingDescription': {
    'es':
        'La votación terminó. Estamos revisando los resultados en tiempo real y eligiendo a los ganadores. Espera un momento.',
    'en':
        'Voting has ended. We are reviewing the results in real time and choosing the winners. Please wait a moment.',
    'ko':
        '투표가 종료되었습니다. 실시간으로 결과를 확인하고 우승자를 선정하고 있습니다. 잠시만 기다려 주세요.',
  },
  'pollDetail.processingResults': {
    'es': 'PROCESANDO RESULTADOS EN VIVO',
    'en': 'PROCESSING RESULTS LIVE',
    'ko': '실시간 결과 처리 중',
  },

  // Tarjetas de participantes
  'pollDetail.votesUppercase': {
    'es': '{count} VOTOS',
    'en': '{count} VOTES',
    'ko': '{count}표',
  },
  'pollDetail.votesLower': {
    'es': '{count} votos',
    'en': '{count} votes',
    'ko': '{count}표',
  },
  'pollDetail.votesLabel': {
    'es': 'Votos',
    'en': 'Votes',
    'ko': '표',
  },

  // Insignia de feedback de voto
  'pollDetail.plusVoteSingular': {
    'es': '+{count} VOTO',
    'en': '+{count} VOTE',
    'ko': '+{count}표',
  },
  'pollDetail.plusVotePlural': {
    'es': '+{count} VOTOS',
    'en': '+{count} VOTES',
    'ko': '+{count}표',
  },

  // Modo versus / duelo
  'pollDetail.duel': {
    'es': 'DUELO {number}',
    'en': 'DUEL {number}',
    'ko': '{number} 대결',
  },
  'pollDetail.option': {'es': 'OPCIÓN', 'en': 'OPTION', 'ko': '옵션'},

  // Estado de error
  'pollDetail.retry': {'es': 'REINTENTAR', 'en': 'RETRY', 'ko': '다시 시도'},

  // Comentarios
  'pollDetail.commentsEyebrow': {
    'es': 'COMUNIDAD',
    'en': 'COMMUNITY',
    'ko': '커뮤니티',
  },
  'pollDetail.commentsTitle': {
    'es': 'Comentarios',
    'en': 'Comments',
    'ko': '댓글',
  },
  'pollDetail.commentsChatTitle': {
    'es': 'Chat',
    'en': 'Chat',
    'ko': '채팅',
  },
  'pollDetail.commentsOpenHint': {
    'es': 'Ver y escribir comentarios',
    'en': 'View and write comments',
    'ko': '댓글 보기 및 작성',
  },
  'pollDetail.commentsPlaceholder': {
    'es': 'Escribe tu comentario...',
    'en': 'Write your comment...',
    'ko': '댓글을 작성하세요...',
  },
  'pollDetail.commentsCount': {
    'es': '{count} COMENTARIOS',
    'en': '{count} COMMENTS',
    'ko': '댓글 {count}개',
  },
  'pollDetail.commentsPublish': {
    'es': 'PUBLICAR',
    'en': 'POST',
    'ko': '게시',
  },
  'pollDetail.commentsPublishing': {
    'es': 'PUBLICANDO...',
    'en': 'POSTING...',
    'ko': '게시 중...',
  },
  'pollDetail.commentsLoginHint': {
    'es': 'Inicia sesión para comentar.',
    'en': 'Log in to comment.',
    'ko': '댓글을 쓰려면 로그인하세요.',
  },
  'pollDetail.commentsMinChars': {
    'es': 'Mínimo {count} caracteres.',
    'en': 'At least {count} characters.',
    'ko': '최소 {count}자.',
  },
  'pollDetail.commentsCooldown': {
    'es': 'Espera {time} para comentar de nuevo.',
    'en': 'Wait {time} before commenting again.',
    'ko': '{time} 후에 다시 댓글을 쓸 수 있습니다.',
  },
  'pollDetail.commentsEmptyTitle': {
    'es': 'Aún no hay comentarios',
    'en': 'No comments yet',
    'ko': '아직 댓글이 없습니다',
  },
  'pollDetail.commentsEmptyBody': {
    'es': 'Sé el primero en opinar sobre esta votación.',
    'en': 'Be the first to comment on this poll.',
    'ko': '이 투표에 첫 댓글을 남겨보세요.',
  },
  'pollDetail.commentsLoadError': {
    'es': 'No se pudieron cargar los comentarios.',
    'en': 'Comments could not be loaded.',
    'ko': '댓글을 불러올 수 없습니다.',
  },
  'pollDetail.commentsPublishError': {
    'es': 'No se pudo publicar el comentario.',
    'en': 'The comment could not be posted.',
    'ko': '댓글을 게시할 수 없습니다.',
  },
  'pollDetail.commentsDeleteTitle': {
    'es': 'Eliminar comentario',
    'en': 'Delete comment',
    'ko': '댓글 삭제',
  },
  'pollDetail.commentsDeleteBody': {
    'es': '¿Seguro que quieres borrar este comentario?',
    'en': 'Are you sure you want to delete this comment?',
    'ko': '이 댓글을 삭제할까요?',
  },
  'pollDetail.commentsDelete': {
    'es': 'Eliminar',
    'en': 'Delete',
    'ko': '삭제',
  },
  'pollDetail.commentsCancel': {
    'es': 'Cancelar',
    'en': 'Cancel',
    'ko': '취소',
  },
  'pollDetail.commentsDeleteError': {
    'es': 'No se pudo eliminar el comentario.',
    'en': 'The comment could not be deleted.',
    'ko': '댓글을 삭제할 수 없습니다.',
  },
  'pollDetail.commentsJustNow': {
    'es': 'ahora',
    'en': 'now',
    'ko': '방금',
  },
  'pollDetail.commentsMinutesAgo': {
    'es': 'hace {count} min',
    'en': '{count} min ago',
    'ko': '{count}분 전',
  },
  'pollDetail.commentsHoursAgo': {
    'es': 'hace {count} h',
    'en': '{count}h ago',
    'ko': '{count}시간 전',
  },
  'pollDetail.commentsDaysAgo': {
    'es': 'hace {count} d',
    'en': '{count}d ago',
    'ko': '{count}일 전',
  },
  'pollDetail.commentsGifSearchTitle': {
    'es': 'Buscar GIF',
    'en': 'Search GIF',
    'ko': 'GIF 검색',
  },
  'pollDetail.commentsGifSearchHint': {
    'es': 'Buscar GIF en GIPHY...',
    'en': 'Search GIF on GIPHY...',
    'ko': 'GIPHY에서 GIF 검색...',
  },
  'pollDetail.commentsGifSearch': {
    'es': 'Buscar',
    'en': 'Search',
    'ko': '검색',
  },
  'pollDetail.commentsGifByGiphy': {
    'es': 'GIF POR GIPHY',
    'en': 'GIF BY GIPHY',
    'ko': 'GIPHY GIF',
  },
  'pollDetail.commentsGifLoadError': {
    'es': 'No se pudieron cargar GIFs de GIPHY.',
    'en': 'Could not load GIFs from GIPHY.',
    'ko': 'GIPHY GIF를 불러올 수 없습니다.',
  },
  'pollDetail.commentsGifMissingKey': {
    'es': 'Falta configurar GIPHY_API_KEY para buscar GIFs.',
    'en': 'GIPHY_API_KEY is missing for GIF search.',
    'ko': 'GIF 검색을 위해 GIPHY_API_KEY가 필요합니다.',
  },
  'pollDetail.commentsSeeMore': {
    'es': 'VER MÁS (+{count})',
    'en': 'SEE MORE (+{count})',
    'ko': '더보기 (+{count})',
  },
  'pollDetail.commentsWrite': {
    'es': 'ESCRIBIR',
    'en': 'WRITE',
    'ko': '작성',
  },

  // Resultado final / ganadores
  'pollDetail.finalTab': {
    'es': 'Final',
    'en': 'Final',
    'ko': '결승',
  },
  'pollDetail.winnerTab': {
    'es': 'GANADOR',
    'en': 'WINNER',
    'ko': '우승',
  },
  'pollDetail.finalResultEyebrow': {
    'es': 'RESULTADO FINAL',
    'en': 'FINAL RESULT',
    'ko': '최종 결과',
  },
  'pollDetail.finalResultTitle': {
    'es': 'Ganador',
    'en': 'Winner',
    'ko': '우승자',
  },
  'pollDetail.finalResultDescription': {
    'es': 'La votación terminó. Este es el artista ganador.',
    'en': 'The poll has ended. This is the winning artist.',
    'ko': '투표가 종료되었습니다. 우승 아티스트입니다.',
  },
  'pollDetail.winningArtist': {
    'es': 'ARTISTA GANADOR',
    'en': 'WINNING ARTIST',
    'ko': '우승 아티스트',
  },
  'pollDetail.wonWith': {
    'es': 'GANÓ CON',
    'en': 'WON WITH',
    'ko': '득표',
  },
  'pollDetail.percentage': {
    'es': 'PORCENTAJE',
    'en': 'PERCENTAGE',
    'ko': '비율',
  },
  'pollDetail.winnerBadge': {
    'es': 'Ganador #{rank}',
    'en': 'Winner #{rank}',
    'ko': '우승 #{rank}',
  },
  'pollDetail.duelWinner': {
    'es': 'Ganador del duelo',
    'en': 'Duel winner',
    'ko': '대결 승자',
  },
  'pollDetail.didNotWin': {
    'es': 'No ganó',
    'en': 'Did not win',
    'ko': '탈락',
  },
  'pollDetail.viewHallOfFame': {
    'es': 'Ver Salón de la fama',
    'en': 'View Hall of Fame',
    'ko': '명예의 전당 보기',
  },
  'pollDetail.viewCertificate': {
    'es': 'Ver certificado',
    'en': 'View certificate',
    'ko': '인증서 보기',
  },
  'pollDetail.certificateEyebrow': {
    'es': 'Certificado oficial',
    'en': 'Official certificate',
    'ko': '공식 인증서',
  },
  'pollDetail.certificateTitle': {
    'es': 'Certificado de ganador',
    'en': 'Winner certificate',
    'ko': '우승 인증서',
  },
  'pollDetail.certificateDownload': {
    'es': 'Descargar',
    'en': 'Download',
    'ko': '다운로드',
  },
  'pollDetail.certificateShare': {
    'es': 'Compartir',
    'en': 'Share',
    'ko': '공유',
  },
  'pollDetail.certificateSaved': {
    'es': 'Certificado guardado en tu galería.',
    'en': 'Certificate saved to your gallery.',
    'ko': '인증서가 갤러리에 저장되었습니다.',
  },
  'pollDetail.certificateDownloadError': {
    'es': 'No se pudo descargar el certificado.',
    'en': 'Could not download the certificate.',
    'ko': '인증서를 다운로드하지 못했습니다.',
  },
  'pollDetail.certificateShareError': {
    'es': 'No se pudo compartir la imagen del certificado.',
    'en': 'Could not share the certificate image.',
    'ko': '인증서 이미지를 공유하지 못했습니다.',
  },
  'pollDetail.shareWinner': {
    'es': 'Compartir ganador',
    'en': 'Share winner',
    'ko': '우승자 공유',
  },
  'pollDetail.shareWinnerText': {
    'es': 'El ganador final es {name}.',
    'en': 'The final winner is {name}.',
    'ko': '최종 우승자는 {name}입니다.',
  },
  'pollDetail.pollFinished': {
    'es': 'VOTACIÓN FINALIZADA',
    'en': 'POLL FINISHED',
    'ko': '투표 종료',
  },
  'pollDetail.winnersPending': {
    'es': 'Ganadores pendientes',
    'en': 'Winners pending',
    'ko': '우승자 대기 중',
  },
  'pollDetail.winnersPendingDescription': {
    'es': 'El equipo todavía no publicó los ganadores finales.',
    'en': 'The team has not published the final winners yet.',
    'ko': '아직 최종 우승자가 공개되지 않았습니다.',
  },
  'pollDetail.wonBy': {
    'es': 'Ganó: {name}',
    'en': 'Won by: {name}',
    'ko': '우승: {name}',
  },
  'pollDetail.finalPlaces': {
    'es': 'Lugares finales',
    'en': 'Final places',
    'ko': '최종 순위',
  },
  'pollDetail.secondPlace': {
    'es': '2.º lugar',
    'en': '2nd place',
    'ko': '2위',
  },
  'pollDetail.thirdPlace': {
    'es': '3.º lugar',
    'en': '3rd place',
    'ko': '3위',
  },
};
