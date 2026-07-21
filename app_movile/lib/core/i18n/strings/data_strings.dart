/// Cadenas visibles al usuario provenientes de la capa de datos / red
/// (mensajes de error de fallback, etc.).
const Map<String, Map<String, String>> dataStrings = {
  'data.actionFailed': {
    'es': 'No se pudo completar la acción. Intenta otra vez.',
    'en': 'Could not complete the action. Please try again.',
    'ko': '작업을 완료할 수 없습니다. 다시 시도해 주세요.',
  },
  'data.requestFailed': {
    'es': 'No se pudo completar la solicitud.',
    'en': 'Could not complete the request.',
    'ko': '요청을 완료할 수 없습니다.',
  },
  'data.googleTokenFailed': {
    'es': 'No se pudo obtener el token de Google.',
    'en': 'Could not get the Google token.',
    'ko': 'Google 토큰을 가져올 수 없습니다.',
  },
  'data.newsLoadFailed': {
    'es': 'No se pudieron cargar las noticias.',
    'en': 'Could not load the news.',
    'ko': '뉴스를 불러올 수 없습니다.',
  },
  'data.newsInvalidResponse': {
    'es': 'Respuesta inválida del feed de noticias.',
    'en': 'Invalid response from the news feed.',
    'ko': '뉴스 피드의 응답이 잘못되었습니다.',
  },
};
