export type CommentBotLanguage = 'es' | 'en' | 'pt';

export const COMMENT_BOT_LANGUAGE_OPTIONS = [
  { code: 'es', label: 'Español' },
  { code: 'en', label: 'English' },
  { code: 'pt', label: 'Português' },
  { code: 'auto', label: 'Auto (según comentarios reales)' },
] as const;

const ENGLISH_HINTS =
  /\b(the|and|you|your|vote|voting|love|this|that|with|for|from|please|let's|lets|go|best|fan|song|artist|just|already|team|win|amazing|so|good|my|our|we|they|them|here|now|again|everyone|everybody)\b/i;
const PORTUGUESE_HINTS =
  /\b(voto|votar|vamos|muito|obrigad|amo|essa|esse|pra|por favor|artista|musica|gente|ja|aqui|agora|de novo|todo|todos|equipe|ganhar|demais|meu|nossa|estou|estamos)\b/i;
const SPANISH_HINTS =
  /\b(voto|votar|vamos|mucho|gracias|amo|esta|este|por favor|artista|musica|gente|tambien|estoy|estamos|ya|aqui|ahora|otra vez|todos|equipo|ganar|demasiado|mio|nuestro|tienen|sigan|falta|reñido|remontando)\b/i;

export const normalizeCommentBotLanguageInput = (value?: string | null) =>
  String(value || 'es')
    .trim()
    .toLowerCase();

export const detectCommentLanguage = (text: string): CommentBotLanguage | 'unknown' => {
  const sample = String(text || '').trim();
  if (!sample) {
    return 'unknown';
  }

  let en = 0;
  let pt = 0;
  let es = 0;

  const words = sample.toLowerCase().split(/\s+/).filter(Boolean);
  for (const word of words) {
    if (ENGLISH_HINTS.test(word)) en += 1;
    if (PORTUGUESE_HINTS.test(word)) pt += 1;
    if (SPANISH_HINTS.test(word)) es += 1;
  }

  if (ENGLISH_HINTS.test(sample)) en += 2;
  if (PORTUGUESE_HINTS.test(sample)) pt += 2;
  if (SPANISH_HINTS.test(sample)) es += 2;

  // Spanish-specific markers
  if (/[¿¡]|ñ|á|é|í|ó|ú|ü/i.test(sample)) es += 2;
  if (/\b(que|como|donde|porque|también|está|están|voté|está)\b/i.test(sample)) es += 1;
  if (/\b(já|não|você|também|está|estão|música)\b/i.test(sample)) pt += 2;

  const max = Math.max(en, pt, es);
  if (max <= 0) {
    return 'unknown';
  }
  if (en >= pt && en >= es) return 'en';
  if (pt >= es) return 'pt';
  return 'es';
};

export const detectCommentBotLanguageFromSamples = (samples: string[] = []): CommentBotLanguage => {
  let en = 0;
  let pt = 0;
  let es = 0;

  for (const sample of samples) {
    const detected = detectCommentLanguage(sample);
    if (detected === 'en') en += 1;
    else if (detected === 'pt') pt += 1;
    else if (detected === 'es') es += 1;
  }

  if (en >= pt && en >= es && en > 0) return 'en';
  if (pt >= es && pt > 0) return 'pt';
  return 'es';
};

export const resolveCommentBotLanguage = (
  input?: string | null,
  sampleComments: string[] = [],
): CommentBotLanguage => {
  const normalized = normalizeCommentBotLanguageInput(input);

  if (normalized === 'en' || normalized === 'pt' || normalized === 'es') {
    return normalized;
  }

  if (normalized === 'auto') {
    return detectCommentBotLanguageFromSamples(sampleComments);
  }

  return 'es';
};

export const commentBotLanguageLabel = (language: CommentBotLanguage) => {
  switch (language) {
    case 'en':
      return 'English';
    case 'pt':
      return 'Português';
    default:
      return 'Español';
  }
};

export const commentMatchesLanguage = (text: string, language: CommentBotLanguage) => {
  const detected = detectCommentLanguage(text);
  if (detected === 'unknown') {
    return true;
  }
  return detected === language;
};

export const filterCommentsByLanguage = (
  messages: string[],
  language: CommentBotLanguage,
): { kept: string[]; rejected: string[] } => {
  const kept: string[] = [];
  const rejected: string[] = [];

  for (const message of messages) {
    if (commentMatchesLanguage(message, language)) {
      kept.push(message);
    } else {
      rejected.push(message);
    }
  }

  return { kept, rejected };
};

const lengthRules = (language: CommentBotLanguage) => {
  switch (language) {
    case 'en':
      return (
        'LENGTH: one short line only, 8-120 characters. No paragraphs, no line breaks, max 1 emoji. ' +
        'Mix: quick reactions, vote nudges, fan hype, casual slang. Sound like a real person on social media, not a blog post.'
      );
    case 'pt':
      return (
        'TAMANHO: uma linha curta, 8-120 caracteres. Sem parágrafos, sem quebras, no máximo 1 emoji. ' +
        'Misture reações rápidas, pedidos de voto, hype de fã e gírias leves. Pareça pessoa real nas redes, não texto formal.'
      );
    default:
      return (
        'LONGITUD: una sola línea corta, 8-120 caracteres. Sin párrafos, sin saltos de línea, máximo 1 emoji. ' +
        'Mezcla reacciones rápidas, pedir votos, hype de fan y slang suave. Suena a persona real en redes, no a texto largo ni formal.'
      );
  }
};

export const commentBotAiSystemPrompt = (language: CommentBotLanguage) => {
  const jsonRule =
    language === 'en'
      ? 'Reply ONLY with valid JSON: an array of strings. No markdown, no numbering, no explanations.'
      : language === 'pt'
        ? 'Responda SOMENTE com JSON válido: um array de strings. Sem markdown, sem numeração, sem explicações.'
        : 'Responde SOLO con JSON válido: un array de strings. Sin markdown, sin numeración, sin explicaciones.';

  const toneRule =
    language === 'en'
      ? 'Write like real music fans commenting during a live vote: spontaneous, informal, sometimes lowercase, varied punctuation.'
      : language === 'pt'
        ? 'Escreva como fãs reais comentando numa votação ao vivo: espontâneo, informal, às vezes minúsculas, pontuação variada.'
        : 'Escribe como fans reales comentando en una votación en vivo: espontáneo, informal, a veces minúsculas, puntuación variada.';

  const langLock =
    language === 'en'
      ? 'CRITICAL: every string MUST be in English. Reject your own output if any line is Spanish or Portuguese.'
      : language === 'pt'
        ? 'CRÍTICO: cada string DEVE estar em português. Rejeite sua saída se alguma linha estiver em espanhol ou inglês.'
        : 'CRÍTICO: cada string DEBE estar en español. Rechaza tu salida si alguna línea está en inglés o portugués.';

  return `${jsonRule} ${toneRule} ${lengthRules(language)} ${langLock} No insults, spam, links or hashtags.`;
};

export const commentBotAiLanguageLine = (language: CommentBotLanguage) => {
  switch (language) {
    case 'en':
      return 'TARGET LANGUAGE: English only. Verify each line before returning JSON.';
    case 'pt':
      return 'IDIOMA OBRIGATÓRIO: português apenas. Verifique cada linha antes de devolver o JSON.';
    default:
      return 'IDIOMA OBLIGATORIO: español solamente. Verifica cada línea antes de devolver el JSON.';
  }
};

export const commentBotStyleMixLine = (language: CommentBotLanguage) => {
  switch (language) {
    case 'en':
      return (
        'Style mix per batch: ~30% ultra-short reactions ("lets go", "so close"), ~30% vote calls, ' +
        '~25% artist support, ~15% casual fan chat. Never write more than one sentence per comment.'
      );
    case 'pt':
      return (
        'Mix de estilo: ~30% reações ultra curtas, ~30% pedidos de voto, ~25% apoio ao artista, ~15% papo de fã. ' +
        'Nunca mais de uma frase por comentário.'
      );
    default:
      return (
        'Mix de estilos: ~30% reacciones ultra cortas, ~30% pedir votos, ~25% apoyo al artista, ~15% charla de fan. ' +
        'Nunca más de una oración por comentario.'
      );
  }
};
