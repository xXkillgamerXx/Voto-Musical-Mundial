import type { CommentLengthProfile } from './comment-bot-message.util';
import { AI_BOT_MESSAGE_DEFAULT_MEDIAN } from './comment-bot-message.util';

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

const lengthRules = (language: CommentBotLanguage, profile: CommentLengthProfile) => {
  const range = `${profile.minLength}-${profile.maxLength}`;
  const median = profile.median;
  switch (language) {
    case 'en':
      return (
        `LENGTH: match real feed comments. Typical median ~${median} chars. Each line ${range} characters. ` +
        'Mix short reactions AND longer casual sentences like the reference examples. No paragraphs. ZERO emojis.'
      );
    case 'pt':
      return (
        `TAMANHO: imite os comentários reais do feed. Mediana típica ~${median} caracteres. Cada linha ${range} caracteres. ` +
        'Misture reações curtas E frases mais longas como nos exemplos. Sem parágrafos. ZERO emojis.'
      );
    default:
      return (
        `LONGITUD: imita los comentarios reales del feed. Mediana típica ~${median} caracteres. Cada línea ${range} caracteres. ` +
        'Mezcla reacciones cortas Y frases más largas como en los ejemplos de referencia. Sin párrafos. CERO emojis.'
      );
  }
};

export const commentBotLengthPromptLine = (
  language: CommentBotLanguage,
  profile: CommentLengthProfile,
  sampleComments: string[] = [],
) => {
  const examples = sampleComments
    .slice(0, 6)
    .map((line, index) => `${index + 1}. (${line.length} chars) ${line}`);

  const stats =
    language === 'en'
      ? `Real comment stats: median ${profile.median} chars, average ${profile.average}, allowed ${profile.minLength}-${profile.maxLength}.`
      : language === 'pt'
        ? `Estatísticas reais: mediana ${profile.median} caracteres, média ${profile.average}, permitido ${profile.minLength}-${profile.maxLength}.`
        : `Estadísticas de comentarios reales: mediana ${profile.median} caracteres, promedio ${profile.average}, rango permitido ${profile.minLength}-${profile.maxLength}.`;

  const rule =
    language === 'en'
      ? `At least 70% of lines MUST be >= ${Math.max(35, Math.round(profile.targetLength * 0.75))} characters. Ultra-short lines like "lets go" are FORBIDDEN except 1-2 in the batch. Target length ~${profile.targetLength} chars.`
      : language === 'pt'
        ? `Pelo menos 70% das linhas DEVEM ter >= ${Math.max(35, Math.round(profile.targetLength * 0.75))} caracteres. Linhas ultra curtas são PROIBIDAS exceto 1-2 no lote. Tamanho alvo ~${profile.targetLength} caracteres.`
        : `Al menos 70% de los comentarios DEBEN tener >= ${Math.max(35, Math.round(profile.targetLength * 0.75))} caracteres. Frases ultra cortas tipo "vamos" están PROHIBIDAS salvo 1-2 en el lote. Longitud objetivo ~${profile.targetLength} caracteres.`;

  return [stats, rule, ...(examples.length ? ['Reference length examples:', ...examples] : [])].join('\n');
};

export const commentBotAiSystemPrompt = (
  language: CommentBotLanguage,
  profile: CommentLengthProfile = {
    minLength: 35,
    maxLength: 280,
    median: AI_BOT_MESSAGE_DEFAULT_MEDIAN,
    average: 80,
    targetLength: AI_BOT_MESSAGE_DEFAULT_MEDIAN,
  },
) => {
  const jsonRule =
    language === 'en'
      ? 'Reply ONLY with valid JSON: an array of strings. No markdown, no numbering, no explanations.'
      : language === 'pt'
        ? 'Responda SOMENTE com JSON válido: um array de strings. Sem markdown, sem numeração, sem explicações.'
        : 'Responde SOLO con JSON válido: un array de strings. Sin markdown, sin numeración, sin explicaciones.';

  const toneRule =
    language === 'en'
      ? 'Write like real fans in a live vote comment section: messy, informal, sometimes lowercase, varied openings. Never repeat the same phrase structure twice.'
      : language === 'pt'
        ? 'Escreva como fãs reais num feed de votação: informal, às vezes minúsculas, aberturas variadas. Nunca repita a mesma estrutura de frase.'
        : 'Escribe como fans reales en un feed de votación: informal, a veces minúsculas, aperturas variadas. Nunca repitas la misma estructura de frase.';

  const langLock =
    language === 'en'
      ? 'CRITICAL: every string MUST be in English. Reject your own output if any line is Spanish or Portuguese.'
      : language === 'pt'
        ? 'CRÍTICO: cada string DEVE estar em português. Rejeite sua saída se alguma linha estiver em espanhol ou inglês.'
        : 'CRÍTICO: cada string DEBE estar en español. Rechaza tu salida si alguna línea está en inglés o portugués.';

  return `${jsonRule} ${toneRule} ${lengthRules(language, profile)} ${langLock} No insults, spam, links, hashtags or emojis.`;
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
        'Style mix: ~20% short reactions, ~35% natural vote calls with context ("just voted and told my friends"), ' +
        '~30% artist support with small personal details, ~15% nervous/excited fan chat. Vary length like real comments.'
      );
    case 'pt':
      return (
        'Mix: ~20% reações curtas, ~35% pedidos de voto com contexto, ~30% apoio ao artista com detalhe pessoal, ' +
        '~15% papo de fã nervoso. Varie o tamanho como nos comentários reais.'
      );
    default:
      return (
        'Mix de estilos: ~20% reacciones cortas, ~35% pedir votos con contexto ("ya voté y le avisé al grupo"), ' +
        '~30% apoyo al artista con detalle personal, ~15% charla de fan nervioso. Varía la longitud como en los comentarios reales.'
      );
  }
};
