export type CommentBotLanguage = 'es' | 'en' | 'pt';

export const COMMENT_BOT_LANGUAGE_OPTIONS = [
  { code: 'es', label: 'Español' },
  { code: 'en', label: 'English' },
  { code: 'pt', label: 'Português' },
  { code: 'auto', label: 'Auto (según comentarios reales)' },
] as const;

const ENGLISH_HINTS = /\b(the|and|you|vote|voting|love|this|that|with|for|from|please|let's|go|best|fan|song|artist)\b/i;
const PORTUGUESE_HINTS = /\b(voto|votar|vamos|muito|obrigad|amo|essa|esse|pra|por favor|artista|musica|gente)\b/i;
const SPANISH_HINTS = /\b(voto|votar|vamos|mucho|gracias|amo|esta|este|por favor|artista|musica|gente|tambien|estoy)\b/i;

export const normalizeCommentBotLanguageInput = (value?: string | null) =>
  String(value || 'es')
    .trim()
    .toLowerCase();

export const detectCommentBotLanguageFromSamples = (samples: string[] = []): CommentBotLanguage => {
  let en = 0;
  let pt = 0;
  let es = 0;

  for (const sample of samples) {
    const text = String(sample || '').trim();
    if (!text) {
      continue;
    }
    if (ENGLISH_HINTS.test(text)) {
      en += 1;
    }
    if (PORTUGUESE_HINTS.test(text)) {
      pt += 1;
    }
    if (SPANISH_HINTS.test(text)) {
      es += 1;
    }
  }

  if (en >= pt && en >= es && en > 0) {
    return 'en';
  }
  if (pt >= es && pt > 0) {
    return 'pt';
  }
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

export const commentBotAiSystemPrompt = (language: CommentBotLanguage) => {
  switch (language) {
    case 'en':
      return (
        'You write short fan comments for an online music voting site. ' +
        'Reply ONLY with valid JSON: an array of strings. No markdown, no explanations. ' +
        'Every comment MUST be in English. Natural fan tone, no insults, no spam, no links, no excessive hashtags.'
      );
    case 'pt':
      return (
        'Você escreve comentários curtos de fãs em uma votação musical online. ' +
        'Responda SOMENTE com JSON válido: um array de strings. Sem markdown, sem explicações. ' +
        'Todos os comentários devem estar em português. Tom natural de fã real, sem insultos, sem spam, sem links.'
      );
    default:
      return (
        'Eres un asistente que escribe comentarios cortos de fans en una votación musical online. ' +
        'Responde SOLO con JSON válido: un array de strings. Sin markdown, sin explicaciones. ' +
        'Todos los comentarios deben estar en español. Tono natural de fan real, sin insultos, sin spam, sin links.'
      );
  }
};

export const commentBotAiLanguageLine = (language: CommentBotLanguage) => {
  switch (language) {
    case 'en':
      return 'Language: write ALL comments in English.';
    case 'pt':
      return 'Idioma: escreva TODOS os comentários em português.';
    default:
      return 'Idioma: escribe TODOS los comentarios en español.';
  }
};
