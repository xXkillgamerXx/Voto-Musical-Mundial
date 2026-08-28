import {
  AI_BOT_MESSAGE_MAX_LENGTH,
  AI_BOT_MESSAGE_MIN_LENGTH,
  buildCommentBotMessages,
  normalizeBotCommentLine,
  sanitizeCommentBotMessages,
} from './comment-bot-message.util';
import {
  commentBotAiLanguageLine,
  commentBotAiSystemPrompt,
  commentBotStyleMixLine,
  CommentBotLanguage,
  filterCommentsByLanguage,
  resolveCommentBotLanguage,
} from './comment-bot-language.util';

type AiMessage = { role: 'system' | 'user'; content: string };

const aiConfig = () => {
  const apiKey = String(process.env.COMMENT_BOT_AI_API_KEY || process.env.OPENAI_API_KEY || '').trim();
  const baseUrl = String(process.env.COMMENT_BOT_AI_BASE_URL || 'https://api.deepseek.com/v1').replace(
    /\/+$/,
    '',
  );
  const model = String(process.env.COMMENT_BOT_AI_MODEL || 'deepseek-chat').trim();

  return { apiKey, baseUrl, model };
};

const parseJsonArray = (raw: string): string[] => {
  const trimmed = String(raw || '').trim();
  if (!trimmed) {
    return [];
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;

  try {
    const parsed = JSON.parse(candidate);
    if (Array.isArray(parsed)) {
      return sanitizeCommentBotMessages(parsed, { aiMode: true });
    }
    if (parsed && Array.isArray(parsed.messages)) {
      return sanitizeCommentBotMessages(parsed.messages, { aiMode: true });
    }
  } catch {
    // Fall through to line-based parsing.
  }

  return sanitizeCommentBotMessages(
    candidate
      .split('\n')
      .map((line) => line.replace(/^[\s\-*\d.)]+/, '').trim())
      .filter(Boolean),
    { aiMode: true },
  );
};

const applyArtistTokens = (messages: string[], artistNames: string[]) =>
  messages.map((line) =>
    artistNames.reduce((text, artist) => text.replace(/\{artista\}/gi, artist), line),
  );

const postProcessAiMessages = (
  messages: string[],
  language: CommentBotLanguage,
  focusArtistName: string,
) => {
  let processed = messages
    .map((line) => normalizeBotCommentLine(line))
    .filter((line) => line.length >= AI_BOT_MESSAGE_MIN_LENGTH && line.length <= AI_BOT_MESSAGE_MAX_LENGTH);

  const { kept } = filterCommentsByLanguage(processed, language);
  processed = kept;

  if (focusArtistName) {
    const focusLower = focusArtistName.toLowerCase();
    processed = processed.filter((line) => line.toLowerCase().includes(focusLower));
  }

  return [...new Set(processed)];
};

export async function generateCommentBotMessagesWithAi(params: {
  topic: string;
  count: number;
  pollTitle?: string;
  artistNames?: string[];
  focusArtistName?: string;
  rivalArtistName?: string;
  sampleComments?: string[];
  language?: string;
}): Promise<{
  messages: string[];
  source: 'ai' | 'template';
  language: CommentBotLanguage;
  languageRejectedCount?: number;
}> {
  const target = Math.max(5, Math.min(80, Math.floor(Number(params.count) || 20)));
  const topic = String(params.topic || '').trim();
  const pollTitle = String(params.pollTitle || '').trim();
  const focusArtistName = String(params.focusArtistName || '').trim();
  const rivalArtistName = String(params.rivalArtistName || '').trim();
  const artists = (params.artistNames || [])
    .map((name) => String(name || '').trim())
    .filter(Boolean)
    .slice(0, 20);
  const sampleComments = (params.sampleComments || [])
    .map((line) => normalizeBotCommentLine(line))
    .filter(Boolean)
    .slice(0, 20);
  const language = resolveCommentBotLanguage(params.language, sampleComments);

  const effectiveArtists = focusArtistName ? [focusArtistName] : artists;
  let languageRejectedCount = 0;

  if (!topic && !focusArtistName) {
    return {
      messages: buildCommentBotMessages(target, effectiveArtists, language),
      source: 'template',
      language,
    };
  }

  const { apiKey, baseUrl, model } = aiConfig();
  if (!apiKey) {
    return {
      messages: buildCommentBotMessages(target, effectiveArtists, language),
      source: 'template',
      language,
    };
  }

  const system: AiMessage = {
    role: 'system',
    content: commentBotAiSystemPrompt(language),
  };

  const userLines = [
    `Genera exactamente ${target} comentarios DISTINTOS para publicar en una votación musical en vivo.`,
    commentBotAiLanguageLine(language),
    commentBotStyleMixLine(language),
    `Cada comentario: ${AI_BOT_MESSAGE_MIN_LENGTH}-${AI_BOT_MESSAGE_MAX_LENGTH} caracteres, UNA sola frase, estilo fan real.`,
  ];

  if (focusArtistName) {
    userLines.push(
      `Artista a apoyar (OBLIGATORIO en ~70% de los comentarios): ${focusArtistName}`,
      'Perspectiva: fan emocionado de ese artista. Pide votos, celebra, sufre si va perdiendo, comparte hype.',
    );
    if (rivalArtistName) {
      userLines.push(
        `Contexto duelo VS: ${focusArtistName} compite contra ${rivalArtistName}.`,
        `Puedes mencionar la remonta o el duelo, pero SIEMPRE desde el lado de ${focusArtistName}.`,
        `Nunca escribas como fan de ${rivalArtistName}.`,
      );
    }
  }

  if (topic) {
    userLines.push(`Contexto / brief del admin: ${topic}`);
  }
  if (pollTitle) {
    userLines.push(`Nombre de la votación: ${pollTitle}`);
  }
  if (!focusArtistName && artists.length) {
    userLines.push(`Artistas en la votación: ${artists.join(', ')}`);
  }

  if (sampleComments.length) {
    userLines.push(
      'Comentarios REALES que ya dejaron usuarios (copia el tono, longitud y naturalidad; NO copies literal):',
      ...sampleComments.slice(0, 12).map((line, index) => `${index + 1}. ${line}`),
    );
  }

  userLines.push(
    language === 'en'
      ? 'Before returning JSON, verify EVERY line is English, short, and sounds like a real fan.'
      : language === 'pt'
        ? 'Antes de devolver o JSON, verifique se CADA linha está em português, curta e parece fã real.'
        : 'Antes de devolver el JSON, verifica que CADA línea esté en español, sea corta y suene a fan real.',
    language === 'en'
      ? 'Output example: ["lets go {artista}!!", "just voted again", "this is so close omg"]'
      : language === 'pt'
        ? 'Exemplo: ["vamos {artista}!!", "acabei de votar de novo", "ta muito apertado"]'
        : 'Ejemplo: ["vamos {artista}!!", "acabo de votar otra vez", "esta reñidísimo"]',
  );

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.78,
        max_tokens: 2200,
        messages: [system, { role: 'user', content: userLines.join('\n') }],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`AI request failed (${response.status})`);
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content || '';
    const rawMessages = parseJsonArray(content);
    const namePool = effectiveArtists.length ? effectiveArtists : artists;

    const beforeLangFilter = applyArtistTokens(rawMessages, namePool);
    const { kept, rejected } = filterCommentsByLanguage(beforeLangFilter, language);
    languageRejectedCount = rejected.length;

    let messages = postProcessAiMessages(kept, language, focusArtistName);

    if (messages.length < Math.min(5, target)) {
      throw new Error('AI returned too few valid messages');
    }

    if (messages.length < target) {
      const filler = buildCommentBotMessages(target - messages.length, effectiveArtists, language);
      messages = [...new Set([...messages, ...filler])].slice(0, target);
    } else {
      messages = messages.slice(0, target);
    }

    return { messages, source: 'ai', language, languageRejectedCount };
  } catch {
    return {
      messages: buildCommentBotMessages(target, effectiveArtists, language),
      source: 'template',
      language,
    };
  } finally {
    clearTimeout(timer);
  }
}
