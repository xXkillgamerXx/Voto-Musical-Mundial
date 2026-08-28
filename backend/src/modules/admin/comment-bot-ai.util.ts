import {
  buildCommentBotMessages,
  buildCommentBotMessagesFromSamples,
  buildCommentLengthProfile,
  CommentLengthProfile,
  normalizeBotCommentLine,
  sanitizeCommentBotMessages,
  stripBotCommentEmoji,
} from './comment-bot-message.util';
import {
  commentBotAiLanguageLine,
  commentBotAiSystemPrompt,
  commentBotLengthPromptLine,
  commentBotStyleMixLine,
  CommentBotLanguage,
  filterCommentsByLanguage,
  resolveCommentBotLanguage,
} from './comment-bot-language.util';

type AiMessage = { role: 'system' | 'user'; content: string };

type AiConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
  provider: 'deepseek' | 'openai';
};

const aiConfig = (): AiConfig | null => {
  const deepseekKey = String(process.env.COMMENT_BOT_AI_API_KEY || '').trim();
  const openaiKey = String(process.env.OPENAI_API_KEY || process.env.COMMENT_BOT_OPENAI_API_KEY || '').trim();

  if (deepseekKey) {
    return {
      apiKey: deepseekKey,
      baseUrl: String(process.env.COMMENT_BOT_AI_BASE_URL || 'https://api.deepseek.com/v1').replace(/\/+$/, ''),
      model: String(process.env.COMMENT_BOT_AI_MODEL || 'deepseek-chat').trim(),
      provider: 'deepseek',
    };
  }

  if (openaiKey) {
    return {
      apiKey: openaiKey,
      baseUrl: String(process.env.COMMENT_BOT_OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, ''),
      model: String(process.env.COMMENT_BOT_OPENAI_MODEL || 'gpt-4o-mini').trim(),
      provider: 'openai',
    };
  }

  return null;
};

const requestAiMessages = async (
  config: AiConfig,
  system: AiMessage,
  userContent: string,
): Promise<string> => {
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 0.88,
      max_tokens: 2800,
      messages: [system, { role: 'user', content: userContent }],
    }),
  });

  if (!response.ok) {
    throw new Error(`${config.provider} request failed (${response.status})`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return payload.choices?.[0]?.message?.content || '';
};

const parseJsonArray = (raw: string, lengthProfile: CommentLengthProfile): string[] => {
  const trimmed = String(raw || '').trim();
  if (!trimmed) {
    return [];
  }

  const sanitizeOptions = {
    aiMode: true,
    minLength: lengthProfile.minLength,
    maxLength: lengthProfile.maxLength,
  };

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;

  try {
    const parsed = JSON.parse(candidate);
    if (Array.isArray(parsed)) {
      return sanitizeCommentBotMessages(parsed, sanitizeOptions);
    }
    if (parsed && Array.isArray(parsed.messages)) {
      return sanitizeCommentBotMessages(parsed.messages, sanitizeOptions);
    }
  } catch {
    // Fall through to line-based parsing.
  }

  return sanitizeCommentBotMessages(
    candidate
      .split('\n')
      .map((line) => line.replace(/^[\s\-*\d.)]+/, '').trim())
      .filter(Boolean),
    sanitizeOptions,
  );
};

const applyArtistTokens = (messages: string[], artistNames: string[]) =>
  messages.map((line) =>
    artistNames.reduce((text, artist) => text.replace(/\{artista\}/gi, artist), line),
  );

const dedupeSimilarMessages = (messages: string[]) => {
  const kept: string[] = [];
  const seenStarts = new Set<string>();

  for (const line of messages) {
    const key = line
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, '')
      .split(/\s+/)
      .slice(0, 3)
      .join(' ');
    if (!key || seenStarts.has(key)) {
      continue;
    }
    seenStarts.add(key);
    kept.push(line);
  }

  return kept;
};

const postProcessAiMessages = (
  messages: string[],
  language: CommentBotLanguage,
  focusArtistName: string,
  lengthProfile: CommentLengthProfile,
) => {
  let processed = messages
    .map((line) => stripBotCommentEmoji(line))
    .filter(
      (line) =>
        line.length >= lengthProfile.minLength && line.length <= lengthProfile.maxLength,
    );

  const { kept } = filterCommentsByLanguage(processed, language);
  processed = dedupeSimilarMessages(kept);

  if (focusArtistName) {
    const focusLower = focusArtistName.toLowerCase();
    const withArtist = processed.filter((line) => line.toLowerCase().includes(focusLower));
    const withoutArtist = processed.filter((line) => !line.toLowerCase().includes(focusLower));
    processed = [...withArtist, ...withoutArtist].filter(
      (line, index, arr) => arr.findIndex((item) => item.toLowerCase() === line.toLowerCase()) === index,
    );
    if (withArtist.length >= Math.min(5, Math.ceil(processed.length * 0.5))) {
      processed = processed.filter(
        (line, index) =>
          line.toLowerCase().includes(focusLower) || index < Math.max(withArtist.length, processed.length * 0.35),
      );
    }
  } else {
    processed = [...new Set(processed)];
  }

  return processed;
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
  source: 'ai' | 'template' | 'reference';
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
  const lengthProfile = buildCommentLengthProfile(sampleComments);

  const effectiveArtists = focusArtistName ? [focusArtistName] : artists;
  let languageRejectedCount = 0;

  const buildFallback = () => ({
    messages: sampleComments.length
      ? buildCommentBotMessagesFromSamples(sampleComments, target, effectiveArtists, lengthProfile.minLength)
      : buildCommentBotMessages(target, effectiveArtists, language, lengthProfile.minLength),
    source: (sampleComments.length ? 'reference' : 'template') as 'reference' | 'template',
    language,
  });

  if (!topic && !focusArtistName) {
    return buildFallback();
  }

  const primaryConfig = aiConfig();
  const openaiKey = String(process.env.OPENAI_API_KEY || process.env.COMMENT_BOT_OPENAI_API_KEY || '').trim();
  const fallbackConfig: AiConfig | null =
    primaryConfig?.provider === 'deepseek' && openaiKey
      ? {
          apiKey: openaiKey,
          baseUrl: String(process.env.COMMENT_BOT_OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, ''),
          model: String(process.env.COMMENT_BOT_OPENAI_MODEL || 'gpt-4o-mini').trim(),
          provider: 'openai',
        }
      : null;

  if (!primaryConfig) {
    return buildFallback();
  }

  const system: AiMessage = {
    role: 'system',
    content: commentBotAiSystemPrompt(language, lengthProfile),
  };

  const userContent = (() => {
    const userLines = [
      `Genera exactamente ${target} comentarios DISTINTOS para publicar en una votación musical en vivo.`,
      commentBotAiLanguageLine(language),
      commentBotStyleMixLine(language),
      commentBotLengthPromptLine(language, lengthProfile, sampleComments),
      `Longitud objetivo ~${lengthProfile.targetLength} caracteres (rango ${lengthProfile.minLength}-${lengthProfile.maxLength}). Frases naturales como en el feed, sin emojis. NO escribas comentarios telegráficos de 2-4 palabras.`,
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
      const sortedSamples = [...sampleComments].sort((a, b) => b.length - a.length);
      userLines.push(
        'Comentarios REALES del feed (COPIA su longitud y tono; NO copies literal ni repitas frases):',
        ...sortedSamples.slice(0, 18).map((line, index) => `${index + 1}. (${line.length} chars) ${line}`),
        `PROHIBIDO devolver comentarios mucho más cortos que estos. La mediana real es ~${lengthProfile.median} caracteres.`,
      );
    }

    const sampleExamples = [...sampleComments].sort((a, b) => b.length - a.length).slice(0, 4);
    userLines.push(
      language === 'en'
        ? 'Before returning JSON, verify EVERY line matches reference length and sounds like a real fan.'
        : language === 'pt'
          ? 'Antes de devolver o JSON, verifique se CADA linha tem comprimento parecido com os exemplos e parece fã real.'
          : 'Antes de devolver el JSON, verifica que CADA línea tenga longitud parecida a los ejemplos y suene a fan real.',
      language === 'en'
        ? sampleExamples.length
          ? `Output style example (match this length): ${JSON.stringify(sampleExamples)}`
          : 'Output example: ["just voted again and told my group to vote too", "this is so close I cant stop refreshing"]'
        : language === 'pt'
          ? sampleExamples.length
            ? `Exemplo de estilo (copie este tamanho): ${JSON.stringify(sampleExamples)}`
            : 'Exemplo: ["acabei de votar de novo e avisei meu grupo", "ta muito apertado nao paro de atualizar"]'
          : sampleExamples.length
            ? `Ejemplo de estilo (copia este largo): ${JSON.stringify(sampleExamples)}`
            : 'Ejemplo: ["ya vote otra vez y le avise al grupo para que voten", "esta tan reñido que no paro de mirar el resultado"]',
    );

    return userLines.join('\n');
  })();

  const configsToTry = [primaryConfig, ...(fallbackConfig ? [fallbackConfig] : [])];

  for (const config of configsToTry) {
    try {
      const content = await requestAiMessages(config, system, userContent);
      const rawMessages = parseJsonArray(content, lengthProfile);
      const namePool = effectiveArtists.length ? effectiveArtists : artists;

      const beforeLangFilter = applyArtistTokens(rawMessages, namePool);
      const { kept, rejected } = filterCommentsByLanguage(beforeLangFilter, language);
      languageRejectedCount = rejected.length;

      let messages = postProcessAiMessages(kept, language, focusArtistName, lengthProfile);

      if (messages.length < Math.min(5, target)) {
        throw new Error('AI returned too few valid messages');
      }

      if (messages.length < target) {
        const filler = buildCommentBotMessages(
          target - messages.length,
          effectiveArtists,
          language,
          lengthProfile.minLength,
        );
        messages = [...new Set([...messages, ...filler])].slice(0, target);
      } else {
        messages = messages.slice(0, target);
      }

      return { messages, source: 'ai', language, languageRejectedCount };
    } catch {
      // Try next provider if available.
    }
  }

  return buildFallback();
}
