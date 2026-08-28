import type { CommentBotLanguage } from './comment-bot-language.util';

const TEMPLATES: Record<
  CommentBotLanguage,
  { generic: string[]; withArtist: string[]; fallback: string }
> = {
  es: {
    generic: [
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
    ],
    withArtist: [
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
    ],
    fallback: 'Vamos con todo!!',
  },
  en: {
    generic: [
      "Let's go!!",
      'Just voted, you should vote too',
      'This is so close',
      "I can't believe how tight this is",
      'Vote vote vote',
      'Every vote counts',
      'Just dropped all my points here',
      'This voting is so exciting',
      "We're catching up",
      'I come back every day to vote',
      'Told my whole group to vote',
      'Almost over, keep pushing',
      'We can do this',
      'So nervous watching the results',
      'Shared the link with my friends',
      'Love this voting',
      "We're gonna win this",
      "Can't stop refreshing",
      'Vote before it closes',
      'Nobody should miss a vote',
      'Voted from both accounts lol',
      'Everyone is so good',
      'This will be decided by a little',
      'Voted again just now',
      'Push those numbers up',
      'Love this community',
      'Hard to pick honestly',
      'Several of us voting already',
      'We are climbing, keep going',
      'The hype is real',
    ],
    withArtist: [
      "Let's go {artista}!!",
      '{artista} deserves this',
      'All my support for {artista}',
      'Just voted for {artista}',
      '{artista} number one always',
      'Nobody like {artista}',
      'Please vote for {artista}',
      '{artista} has to win this',
      'Fan of {artista} since day one',
      '{artista} is killing it',
      'Gave all my points to {artista}',
      '{artista} deserves first place',
      'Up {artista}',
      'Team {artista} here',
      '{artista} is coming back, watch',
      'Listening to {artista} while I vote',
      'No comparison, {artista} is on another level',
      '{artista} is bringing it',
    ],
    fallback: "Let's go!!",
  },
  pt: {
    generic: [
      'Vamos com tudo!!',
      'Ja votei, nao esquecam de votar tambem',
      'Isso esta muito apertado',
      'Nao acredito o quao perto esta',
      'Votem votem votem',
      'Cada voto conta',
      'Acabei de deixar meus pontos aqui',
      'Que emocao essa votacao',
      'Estamos remontando',
      'Venho todo dia votar',
      'Avisei todo o grupo pra votar',
      'Falta pouco, nao afrouxem',
      'Da pra conseguir',
      'Que nervoso ver o resultado',
      'Compartilhei o link com meus amigos',
      'Muito boa essa votacao',
      'Vamos ganhar isso',
      'Estou grudado na tela',
      'Votem que fecha logo',
      'Ninguem fica sem votar',
      'Votei das duas contas kkk',
      'Que nivel todo mundo',
      'Isso vai ser por pouco',
      'Voltei a votar de novo',
      'Subam esses numeros',
      'Amo essa comunidade',
      'Dificil escolher a verdade',
      'Ja somos varios votando',
      'Estamos subindo, continuem',
      'A emocao e total',
    ],
    withArtist: [
      'Vamos {artista}!!',
      '{artista} merece',
      'Todo meu apoio pra {artista}',
      'Ja votei no {artista}',
      '{artista} numero um sempre',
      'Ninguem como {artista}',
      'Votem no {artista} por favor',
      '{artista} tem que ganhar isso',
      'Fa de {artista} desde o primeiro dia',
      '{artista} manda bem demais',
      'Dei todos os meus pontos pro {artista}',
      '{artista} merece o primeiro lugar',
      'Forca {artista}',
      'Team {artista} presente',
      '{artista} vai remontar, voces vao ver',
      'Ouvindo {artista} enquanto voto',
      'Nao tem comparacao, {artista} e outro nivel',
      '{artista} vem com tudo',
    ],
    fallback: 'Vamos com tudo!!',
  },
};

const TAIL = ['', '', '', '', ' 🔥', ' ❤️', '!!', ' 👏', ' 💪', ' 🎶'];

const pick = <T>(items: T[]) => items[Math.floor(Math.random() * items.length)];

export const MAX_BOT_MESSAGE_LENGTH = 500;
export const AI_BOT_MESSAGE_MIN_LENGTH = 8;
export const AI_BOT_MESSAGE_MAX_LENGTH = 120;

export function normalizeBotCommentLine(text: string) {
  return String(text || '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function isNaturalBotCommentLength(text: string, maxLength = AI_BOT_MESSAGE_MAX_LENGTH) {
  const normalized = normalizeBotCommentLine(text);
  if (normalized.length < AI_BOT_MESSAGE_MIN_LENGTH || normalized.length > maxLength) {
    return false;
  }

  const sentenceBreaks = (normalized.match(/[.!?…]+/g) || []).length;
  if (sentenceBreaks > 2) {
    return false;
  }

  return true;
}

/**
 * Los mensajes se resuelven al crear la campaña para que el admin pueda
 * revisar exactamente qué se va a publicar antes de que arranque el goteo.
 */
export function buildCommentBotMessages(
  count: number,
  artistNames: string[] = [],
  language: CommentBotLanguage = 'es',
): string[] {
  const pool = TEMPLATES[language] || TEMPLATES.es;
  const target = Math.max(1, Math.min(200, Math.floor(count) || 1));
  const artists = artistNames.map((name) => String(name || '').trim()).filter(Boolean);
  const messages = new Set<string>();
  let guard = 0;

  while (messages.size < target && guard < target * 40) {
    guard += 1;
    const useArtist = artists.length > 0 && (artists.length === 1 || Math.random() < 0.55);
    const template = useArtist ? pick(pool.withArtist) : pick(pool.generic);
    const text = `${template.replace('{artista}', useArtist ? pick(artists) : '')}${pick(TAIL)}`.trim();
    if (text.length >= 3 && text.length <= MAX_BOT_MESSAGE_LENGTH) {
      messages.add(text);
    }
  }

  if (messages.size === 0) {
    messages.add(pool.fallback);
  }

  return [...messages];
}

export function sanitizeCommentBotMessages(
  input: unknown,
  options: { aiMode?: boolean } = {},
): string[] {
  const maxLen = options.aiMode ? AI_BOT_MESSAGE_MAX_LENGTH : MAX_BOT_MESSAGE_LENGTH;
  const minLen = options.aiMode ? AI_BOT_MESSAGE_MIN_LENGTH : 3;

  const raw = Array.isArray(input)
    ? input
    : String(input || '')
        .split('\n')
        .map((line) => line.trim());

  const cleaned = raw
    .map((line) => normalizeBotCommentLine(line))
    .filter((line) => {
      if (line.length < minLen || line.length > maxLen) {
        return false;
      }
      if (options.aiMode && !isNaturalBotCommentLength(line, maxLen)) {
        return false;
      }
      return true;
    });

  return [...new Set(cleaned)].slice(0, 200);
}
