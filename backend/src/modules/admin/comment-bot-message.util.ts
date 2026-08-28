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
      'Acabo de votar otra vez y le mande el link a todo mi grupo de whatsapp',
      'No entiendo como van tan apretados los numeros, hay que seguir votando',
      'Llevo rato mirando el resultado y cada vez se pone mas reñido',
      'Ya vote por mi artista favorito, ojala mucha gente haga lo mismo hoy',
      'Estoy compartiendo la votacion en mis historias para que entren mas votos',
      'Se nota que la gente esta votando fuerte, falta remontar un poquito nomas',
      'Vengo cada rato a dejar mis votos porque no quiero que se quede atras',
      'Si tienen un rato libre pasen a votar, esto se define al final',
      'Me emociona ver tanta gente apoyando, hay que mantener la energia',
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
      'Le acabo de pasar el link de la votacion a todos mis amigos fans de {artista}',
      'No paro de votar por {artista} porque se lo merece de verdad',
      'Ojala mucha gente entre hoy a votar por {artista}, va muy apretado',
      'Sigo apoyando a {artista} aunque vaya perdiendo, hay que remontar juntos',
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

const TAIL = ['', '', '', '', '!!', '...', ''];

const pick = <T>(items: T[]) => items[Math.floor(Math.random() * items.length)];

export const MAX_BOT_MESSAGE_LENGTH = 500;
export const AI_BOT_MESSAGE_MIN_LENGTH = 12;
export const AI_BOT_MESSAGE_MAX_LENGTH = 280;
export const AI_BOT_MESSAGE_DEFAULT_MEDIAN = 72;

export type CommentLengthProfile = {
  minLength: number;
  maxLength: number;
  median: number;
  average: number;
  targetLength: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function buildCommentLengthProfile(samples: string[] = []): CommentLengthProfile {
  const lengths = samples
    .map((line) => normalizeBotCommentLine(line).length)
    .filter((length) => length >= 3)
    .sort((a, b) => a - b);

  if (!lengths.length) {
    return {
      minLength: 35,
      maxLength: AI_BOT_MESSAGE_MAX_LENGTH,
      median: AI_BOT_MESSAGE_DEFAULT_MEDIAN,
      average: 80,
      targetLength: AI_BOT_MESSAGE_DEFAULT_MEDIAN,
    };
  }

  const median = lengths[Math.floor(lengths.length / 2)] || AI_BOT_MESSAGE_DEFAULT_MEDIAN;
  const average = Math.round(lengths.reduce((sum, length) => sum + length, 0) / lengths.length);
  const p25 = lengths[Math.floor(lengths.length * 0.25)] || median;
  const p75 = lengths[Math.floor(lengths.length * 0.75)] || median;
  const sampleMax = lengths[lengths.length - 1] || median;
  const targetLength = Math.round(median * 0.95);

  return {
    minLength: clamp(Math.max(Math.round(median * 0.5), p25, 35), 35, 90),
    maxLength: clamp(Math.max(p75, Math.round(median * 1.4), sampleMax, 100), 120, AI_BOT_MESSAGE_MAX_LENGTH),
    median,
    average,
    targetLength,
  };
}

const EMOJI_REGEX =
  /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu;

export function stripBotCommentEmoji(text: string) {
  return normalizeBotCommentLine(String(text || '').replace(EMOJI_REGEX, ''));
}

export function normalizeBotCommentLine(text: string) {
  return String(text || '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function isNaturalBotCommentLength(
  text: string,
  maxLength = AI_BOT_MESSAGE_MAX_LENGTH,
  minLength = AI_BOT_MESSAGE_MIN_LENGTH,
) {
  const normalized = normalizeBotCommentLine(text);
  if (normalized.length < minLength || normalized.length > maxLength) {
    return false;
  }

  const sentenceBreaks = (normalized.match(/[.!?…]+/g) || []).length;
  if (sentenceBreaks > 3) {
    return false;
  }

  return true;
}

const mutateSampleComment = (text: string, artistName = '') => {
  let out = normalizeBotCommentLine(text);
  const focus = String(artistName || '').trim();
  const mutations = [
    () => out,
    () => (out.charAt(0) === out.charAt(0).toUpperCase() ? out.charAt(0).toLowerCase() + out.slice(1) : out),
    () => out.replace(/[!.…]+$/u, '').trim(),
    () => `${out.replace(/[!.…]+$/u, '').trim()} la verdad`,
    () => `yo ${out.charAt(0).toLowerCase()}${out.slice(1)}`,
    () => `uff ${out.charAt(0).toLowerCase()}${out.slice(1)}`,
    () => (focus && !out.toLowerCase().includes(focus.toLowerCase()) ? `${out}, hay que votar por ${focus}` : out),
    () => (focus && !out.toLowerCase().includes(focus.toLowerCase()) ? `vamos ${focus}, ${out.charAt(0).toLowerCase()}${out.slice(1)}` : out),
  ];

  return stripBotCommentEmoji(pick(mutations)());
};

export function buildCommentBotMessagesFromSamples(
  samples: string[],
  count: number,
  artistNames: string[] = [],
  minLength = 35,
): string[] {
  const cleaned = samples.map((line) => normalizeBotCommentLine(line)).filter((line) => line.length >= 12);
  const target = Math.max(1, Math.min(200, Math.floor(count) || 1));
  const artist = artistNames.length === 1 ? artistNames[0] : pick(artistNames.filter(Boolean));

  if (!cleaned.length) {
    return buildCommentBotMessages(target, artistNames, 'es', minLength);
  }

  const ordered = [...cleaned].sort((a, b) => b.length - a.length);
  const messages = new Set<string>();
  let guard = 0;

  while (messages.size < target && guard < target * 30) {
    guard += 1;
    const base = ordered[messages.size % ordered.length] || pick(ordered);
    const candidate = mutateSampleComment(base, artist);
    if (candidate.length >= Math.min(minLength, 12) && candidate.length <= MAX_BOT_MESSAGE_LENGTH) {
      messages.add(candidate);
    }
  }

  if (messages.size < target) {
    for (const filler of buildCommentBotMessages(target - messages.size, artistNames, 'es', minLength)) {
      messages.add(filler);
    }
  }

  return [...messages].slice(0, target);
}

export function buildCommentBotMessages(
  count: number,
  artistNames: string[] = [],
  language: CommentBotLanguage = 'es',
  minLength = 35,
): string[] {
  const pool = TEMPLATES[language] || TEMPLATES.es;
  const target = Math.max(1, Math.min(200, Math.floor(count) || 1));
  const artists = artistNames.map((name) => String(name || '').trim()).filter(Boolean);
  const messages = new Set<string>();
  let guard = 0;

  const longGeneric = pool.generic.filter((line) => line.length >= minLength);
  const longWithArtist = pool.withArtist.filter((line) => line.length >= minLength);
  const genericPool = longGeneric.length ? longGeneric : pool.generic;
  const artistPool = longWithArtist.length ? longWithArtist : pool.withArtist;

  while (messages.size < target && guard < target * 40) {
    guard += 1;
    const useArtist = artists.length > 0 && (artists.length === 1 || Math.random() < 0.55);
    const template = useArtist ? pick(artistPool) : pick(genericPool);
    const text = `${template.replace('{artista}', useArtist ? pick(artists) : '')}${pick(TAIL)}`.trim();
    if (text.length >= minLength && text.length <= MAX_BOT_MESSAGE_LENGTH) {
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
  options: { aiMode?: boolean; minLength?: number; maxLength?: number } = {},
): string[] {
  const maxLen = options.maxLength ?? (options.aiMode ? AI_BOT_MESSAGE_MAX_LENGTH : MAX_BOT_MESSAGE_LENGTH);
  const minLen = options.minLength ?? (options.aiMode ? AI_BOT_MESSAGE_MIN_LENGTH : 3);

  const raw = Array.isArray(input)
    ? input
    : String(input || '')
        .split('\n')
        .map((line) => line.trim());

  const cleaned = raw
    .map((line) => stripBotCommentEmoji(line))
    .filter((line) => {
      if (line.length < minLen || line.length > maxLen) {
        return false;
      }
      if (options.aiMode && !isNaturalBotCommentLength(line, maxLen, minLen)) {
        return false;
      }
      return true;
    });

  return [...new Set(cleaned)].slice(0, 200);
}
