const GENERIC = [
  'Vamos con todo!!',
  'Ya vote, no se olviden de votar ustedes tambien',
  'Esto esta muy reñido',
  'No puedo creer lo cerca que va',
  'Voten voten voten',
  'Cada voto cuenta gente',
  'Acabo de dejar mis puntos aca',
  'Que emocion esta votacion',
  'Estamos remontando',
  'Vengo todos los dias a votar',
  'Ya avise a todo el grupo para que voten',
  'Falta poco, no aflojen',
  'Se puede se puede',
  'Que nervios mirar los resultados',
  'Comparti el link con mis amigos',
  'Buenisima esta votacion',
  'Vamos a ganar esto',
  'Estoy pegado a la pantalla',
  'Voten que se cierra pronto',
  'Nadie se queda sin votar',
  'Ya vote desde mis dos cuentas jaja',
  'Que nivel tienen todos',
  'Esto se define por poquito',
  'Volvi a votar otra vez',
  'Suban esos numeros',
  'Amo esta comunidad',
  'Muy dificil elegir la verdad',
  'Ya somos varios votando',
  'Estamos subiendo, sigan asi',
  'La emocion es total',
];

const WITH_ARTIST = [
  'Vamos {artista}!!',
  '{artista} se lo merece',
  'Todo mi apoyo para {artista}',
  'Ya vote por {artista}',
  '{artista} numero uno siempre',
  'Nadie como {artista}',
  'Voten por {artista} por favor',
  '{artista} tiene que ganar esto',
  'Fan de {artista} desde el primer dia',
  '{artista} la rompe',
  'Le acabo de dar todos mis puntos a {artista}',
  '{artista} merece el primer puesto',
  'Arriba {artista}',
  'Team {artista} presente',
  '{artista} va a remontar, ya veran',
  'Escuchando a {artista} mientras voto',
  'No hay comparacion, {artista} aparte',
  '{artista} se viene con todo',
];

const TAIL = ['', '', '', '', ' 🔥', ' ❤️', '!!', ' 👏', ' 💪', ' 🎶'];

const pick = <T>(items: T[]) => items[Math.floor(Math.random() * items.length)];

export const MAX_BOT_MESSAGE_LENGTH = 500;

/**
 * Los mensajes se resuelven al crear la campaña para que el admin pueda
 * revisar exactamente qué se va a publicar antes de que arranque el goteo.
 */
export function buildCommentBotMessages(count: number, artistNames: string[] = []): string[] {
  const target = Math.max(1, Math.min(200, Math.floor(count) || 1));
  const artists = artistNames.map((name) => String(name || '').trim()).filter(Boolean);
  const messages = new Set<string>();
  let guard = 0;

  while (messages.size < target && guard < target * 40) {
    guard += 1;
    const useArtist = artists.length > 0 && (artists.length === 1 || Math.random() < 0.55);
    const template = useArtist ? pick(WITH_ARTIST) : pick(GENERIC);
    const text = `${template.replace('{artista}', useArtist ? pick(artists) : '')}${pick(TAIL)}`.trim();
    if (text.length >= 3 && text.length <= MAX_BOT_MESSAGE_LENGTH) {
      messages.add(text);
    }
  }

  if (messages.size === 0) {
    messages.add('Vamos con todo!!');
  }

  return [...messages];
}

export function sanitizeCommentBotMessages(input: unknown): string[] {
  const raw = Array.isArray(input)
    ? input
    : String(input || '')
        .split('\n')
        .map((line) => line.trim());

  const cleaned = raw
    .map((line) => String(line || '').trim())
    .filter((line) => line.length >= 3 && line.length <= MAX_BOT_MESSAGE_LENGTH);

  return [...new Set(cleaned)].slice(0, 200);
}
