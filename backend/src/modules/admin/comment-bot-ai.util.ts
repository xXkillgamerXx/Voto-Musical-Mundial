import {
  buildCommentBotMessages,
  MAX_BOT_MESSAGE_LENGTH,
  sanitizeCommentBotMessages,
} from './comment-bot-message.util';
import {
  commentBotAiLanguageLine,
  commentBotAiSystemPrompt,
  CommentBotLanguage,
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
      return sanitizeCommentBotMessages(parsed);
    }
    if (parsed && Array.isArray(parsed.messages)) {
      return sanitizeCommentBotMessages(parsed.messages);
    }
  } catch {
    // Fall through to line-based parsing.
  }

  return sanitizeCommentBotMessages(
    candidate
      .split('\n')
      .map((line) => line.replace(/^[\s\-*\d.)]+/, '').trim())
      .filter(Boolean),
  );
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
}): Promise<{ messages: string[]; source: 'ai' | 'template'; language: CommentBotLanguage }> {
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
    .map((line) => String(line || '').trim())
    .filter(Boolean)
    .slice(0, 20);
  const language = resolveCommentBotLanguage(params.language, sampleComments);

  const effectiveArtists = focusArtistName ? [focusArtistName] : artists;

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
    content:
      commentBotAiSystemPrompt(language) +
      ` Each comment must be between 8 and ${MAX_BOT_MESSAGE_LENGTH} characters.`,
  };

  const userLines = [
    `Genera exactamente ${target} comentarios distintos.`,
    commentBotAiLanguageLine(language),
  ];

  if (focusArtistName) {
    userLines.push(
      `Artista objetivo (OBLIGATORIO): ${focusArtistName}`,
      'TODOS los comentarios deben apoyar a ese artista: votos, talento, emoción, urgencia por votar.',
    );
    if (rivalArtistName) {
      userLines.push(
        `Contexto de duelo: compite contra ${rivalArtistName}.`,
        `Los fans apoyan a ${focusArtistName} para ganarle a ${rivalArtistName}. Puedes mencionar el duelo o la remonta, pero siempre desde el lado de ${focusArtistName}.`,
        `No escribas como fan de ${rivalArtistName}.`,
      );
    } else {
      userLines.push('No menciones a otros artistas ni cambies de tema.');
    }
  }

  if (topic) {
    userLines.push(`Enfoque adicional: ${topic}`);
  }
  if (pollTitle) {
    userLines.push(`Votación: ${pollTitle}`);
  }
  if (!focusArtistName && artists.length) {
    userLines.push(`Artistas en la votación: ${artists.join(', ')}`);
  }

  if (sampleComments.length) {
    userLines.push(
      'Comentarios reales que ya dejaron usuarios (imita el estilo, longitud y tono; NO copies literal):',
      ...sampleComments.map((line, index) => `${index + 1}. ${line}`),
    );
  }

  userLines.push(
    language === 'en'
      ? 'Vary the style: emotion, direct support, asking for votes, casual reactions, light fan slang.'
      : language === 'pt'
        ? 'Varie o estilo: emocao, apoio direto, pedir votos, reacoes casuais, gírias leves de fã.'
        : 'Varía el estilo: emoción, apoyo directo, pedir votos, reacciones casuales, slang latino suave.',
    language === 'en'
      ? 'Example format: ["Let\'s go!!", "Just voted for {artista}"]'
      : language === 'pt'
        ? 'Exemplo de formato: ["Vamos com tudo!!", "Ja votei no {artista}"]'
        : 'Ejemplo de formato: ["Vamos con todo!!", "Ya voté por {artista}"]',
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
        temperature: 0.85,
        max_tokens: 2500,
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
    let messages = parseJsonArray(content);

    const namePool = effectiveArtists.length ? effectiveArtists : artists;
    messages = messages.map((line) =>
      namePool.reduce((text, artist) => text.replace(/\{artista\}/gi, artist), line),
    );

    if (focusArtistName) {
      const focusLower = focusArtistName.toLowerCase();
      messages = messages.filter((line) => line.toLowerCase().includes(focusLower));
    }

    if (messages.length < Math.min(5, target)) {
      throw new Error('AI returned too few valid messages');
    }

    if (messages.length < target) {
      const filler = buildCommentBotMessages(target - messages.length, effectiveArtists, language);
      messages = [...new Set([...messages, ...filler])].slice(0, target);
    } else {
      messages = messages.slice(0, target);
    }

    return { messages, source: 'ai', language };
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
