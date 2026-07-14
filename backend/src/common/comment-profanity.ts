/**
 * Moderación de comentarios:
 * 1) OpenAI Moderation API (gratis con OPENAI_API_KEY)
 * 2) Fallback local si no hay key o falla la API
 *
 * Env:
 *   OPENAI_API_KEY=sk-...
 *   COMMENT_MODERATION_MODE=openai|local|both   (default: openai)
 *   COMMENTS_BLOCKED_WORDS=extra1,extra2
 */

export const BLOCKED_LANGUAGE_MESSAGE =
  'Tu comentario contiene palabras o expresiones no permitidas. Edítalo e inténtalo de nuevo.';

type ModerationMode = 'openai' | 'local' | 'both';

const LOCAL_BLOCKED_WORDS = [
  'puta',
  'puto',
  'putas',
  'putos',
  'mierda',
  'carajo',
  'coño',
  'joder',
  'cabron',
  'cabrona',
  'hijueputa',
  'hijoeputa',
  'hijo de puta',
  'hija de puta',
  'hp',
  'hdp',
  'hpta',
  'malparido',
  'malparida',
  'gonorrea',
  'marica',
  'maricon',
  'pendejo',
  'pendeja',
  'verga',
  'varga',
  'pinga',
  'polla',
  'chingar',
  'chingada',
  'pinche',
  'culero',
  'zorra',
  'ptm',
  'ctm',
  'lpm',
  'conchetumare',
  'qliao',
  'culiao',
  'weon',
  'fuck',
  'fucking',
  'motherfucker',
  'shit',
  'bitch',
  'asshole',
  'cunt',
  'slut',
  'whore',
  'nigger',
  'nigga',
  'kill yourself',
  'kys',
];

const LEET_MAP: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '@': 'a',
  $: 's',
  '!': 'i',
};

const normalizeForModeration = (value: string) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[0-9@$!]/g, (char) => LEET_MAP[char] || char)
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/(.)\1{2,}/g, '$1$1')
    .replace(/\s+/g, ' ')
    .trim();

const loadExtraWords = () =>
  String(process.env.COMMENTS_BLOCKED_WORDS || '')
    .split(',')
    .map((word) => normalizeForModeration(word))
    .filter((word) => word.length >= 2);

let tokenSet: Set<string> | null = null;
let phraseList: string[] | null = null;

const buildLocalIndex = () => {
  const all = [
    ...LOCAL_BLOCKED_WORDS.map(normalizeForModeration),
    ...loadExtraWords(),
  ].filter(Boolean);
  const unique = [...new Set(all)];
  tokenSet = new Set(unique.filter((word) => !word.includes(' ')));
  phraseList = unique
    .filter((word) => word.includes(' '))
    .sort((a, b) => b.length - a.length);
};

export const containsBlockedLanguageLocal = (text: string): boolean => {
  const normalized = normalizeForModeration(text);
  if (!normalized) {
    return false;
  }

  if (!tokenSet || !phraseList) {
    buildLocalIndex();
  }

  for (const token of normalized.split(' ').filter(Boolean)) {
    if (tokenSet!.has(token)) {
      return true;
    }
  }

  const haystack = ` ${normalized} `;
  return phraseList!.some(
    (phrase) => haystack.includes(` ${phrase} `) || haystack.includes(phrase),
  );
};

const getModerationMode = (): ModerationMode => {
  const mode = String(process.env.COMMENT_MODERATION_MODE || 'openai')
    .trim()
    .toLowerCase();
  if (mode === 'local' || mode === 'both' || mode === 'openai') {
    return mode;
  }
  return 'openai';
};

type OpenAiModerationResult = {
  results?: Array<{
    flagged?: boolean;
    categories?: Record<string, boolean>;
    category_scores?: Record<string, number>;
  }>;
};

const OPENAI_BLOCK_CATEGORIES = new Set([
  'hate',
  'hate/threatening',
  'harassment',
  'harassment/threatening',
  'self-harm',
  'self-harm/intent',
  'self-harm/instructions',
  'sexual',
  'sexual/minors',
  'violence',
  'violence/graphic',
]);

async function moderateWithOpenAi(text: string): Promise<boolean | null> {
  const apiKey = String(process.env.OPENAI_API_KEY || '').trim();
  if (!apiKey) {
    return null;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);

  try {
    const response = await fetch('https://api.openai.com/v1/moderations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODERATION_MODEL || 'omni-moderation-latest',
        input: text,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as OpenAiModerationResult;
    const result = payload.results?.[0];
    if (!result) {
      return null;
    }

    if (result.flagged) {
      return true;
    }

    const categories = result.categories || {};
    return Object.entries(categories).some(
      ([category, active]) => active && OPENAI_BLOCK_CATEGORIES.has(category),
    );
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Compat: sync local check (tests / fallback). */
export const containsBlockedLanguage = containsBlockedLanguageLocal;

export const isCommentLanguageBlocked = async (text: string): Promise<boolean> => {
  const value = String(text || '').trim();
  if (!value) {
    return false;
  }

  const mode = getModerationMode();

  if (mode === 'local') {
    return containsBlockedLanguageLocal(value);
  }

  if (mode === 'both' && containsBlockedLanguageLocal(value)) {
    return true;
  }

  const apiFlagged = await moderateWithOpenAi(value);
  if (apiFlagged === true) {
    return true;
  }

  // Sin key / error de API → fallback local para no dejar el chat sin filtro.
  if (apiFlagged === null) {
    return containsBlockedLanguageLocal(value);
  }

  return false;
};
