/**
 * Anti-promo en comentarios (barato):
 * 1) URLs externas → bloqueo gratis (sin IA)
 * 2) Comentarios normales de fans → pasan gratis (sin IA)
 * 3) Solo si parece sospechoso (señales baratas) → 1 llamada corta de IA
 *
 * COMMENT_PROMO_AI=true|false
 * COMMENT_BOT_AI_* / OPENAI_API_KEY
 */

export const BLOCKED_PROMO_MESSAGE =
  'No se permiten enlaces ni inducir a ir o votar en otras páginas. Solo comentarios sobre esta votación.';

const OWN_HOSTS = [
  'vote.musicmundial.com',
  'musicmundial.com',
  'www.musicmundial.com',
  'www.vote.musicmundial.com',
];

const URL_PATTERN =
  /(?:https?:\/\/|www\.)[^\s<>"']+|(?:bit\.ly|t\.co|tinyurl\.com|goo\.gl|ow\.ly|rebrand\.ly|cutt\.ly|shorturl\.at|rb\.gy|is\.gd|buff\.ly|adf\.ly|linktr\.ee|biolink|solo\.to)\/[^\s<>"']*/gi;

const BARE_DOMAIN_PATTERN =
  /(?:^|[\s([{])((?:[a-z0-9-]+\.)+(?:com|net|org|io|co|me|app|tv|gg|ly|info|xyz|online|site|link|page|club|store|shop|blog|news|live|pro|dev|ai|to|cc|tk|ml|ga|cf|pw|top|fun|vip|icu|click|bio)(?:\/[^\s]*)?)/gi;

const isOwnHost = (value: string) => {
  const lower = value.toLowerCase();
  return OWN_HOSTS.some(
    (host) =>
      lower.includes(`://${host}`) ||
      lower.includes(`www.${host}`) ||
      lower.startsWith(host) ||
      lower.includes(`.${host}`),
  );
};

const extractUrls = (text: string): string[] => {
  const found: string[] = [...(text.match(URL_PATTERN) || [])];
  let match: RegExpExecArray | null;
  const bare = new RegExp(BARE_DOMAIN_PATTERN.source, 'gi');
  while ((match = bare.exec(text)) !== null) {
    found.push(match[1] || match[0]);
  }
  return found;
};

export const containsExternalLink = (text: string): boolean => {
  const raw = String(text || '').trim();
  if (!raw) return false;
  return extractUrls(raw).some((url) => !isOwnHost(url));
};

const normalize = (value: string) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Filtro barato: ¿vale la pena llamar a la IA?
 * No bloquea por sí solo; solo decide si revisar con IA.
 */
export const looksLikePossibleDiversion = (text: string): boolean => {
  const n = normalize(text);
  if (n.length < 18) return false;

  // Apoyo típico: "voten por X", "vamos X" → no gastar IA
  const looksLikeNormalSupport =
    /^(voten|vote|vota|vamos|go|team|fuerza|apoyo|love|amo|i love)\b/.test(n) &&
    !/\b(otra|otro|alla|ahi|elsewhere|another|other|pagina|web|sitio|plataforma|instagram|telegram|discord|tiktok|youtube|link)\b/.test(
      n,
    );
  if (looksLikeNormalSupport && n.length < 80) return false;

  // Señales de posible desvío (estructura, no "palabra mágica única")
  const signals = [
    /\b(otra|otro|otras|otros|elsewhere|another|other)\b.{0,30}\b(pagina|página|web|sitio|plataforma|votacion|votación|poll|app|link|enlace)\b/,
    /\b(pagina|página|web|sitio|plataforma|app|link|enlace)\b.{0,30}\b(otra|otro|elsewhere|another|other)\b/,
    /\b(voten|vote|vota|votar)\b.{0,40}\b(alla|ahi|elsewhere|another|other|otra|otro)\b/,
    /\b(no)\b.{0,12}\b(voten|vote|vota)\b.{0,20}\b(aqui|aquí|here|esta)\b/,
    /\b(falsa|fake|estafa|scam)\b/,
    /\b(instagram|tiktok|telegram|discord|whatsapp|youtube|linktree|facebook|twitter)\b/,
    /\b(sigueme|siguenos|follow me|follow us|mi canal|mi grupo|mi pagina|mi página)\b/,
    /\b(vengan|vayan|pasen|salgan|dejen)\b.{0,30}\b(votar|votacion|votación|pagina|página|alla|ahi)\b/,
    /\b(mejor)\b.{0,20}\b(voten|vote|vota|votar)\b/,
  ];

  return signals.some((re) => re.test(n));
};

const promoAiEnabled = () => {
  const flag = String(process.env.COMMENT_PROMO_AI || 'true')
    .trim()
    .toLowerCase();
  return !(flag === '0' || flag === 'false' || flag === 'off' || flag === 'no');
};

const resolveAiConfig = () => {
  const apiKey = String(
    process.env.COMMENT_BOT_AI_API_KEY || process.env.OPENAI_API_KEY || '',
  ).trim();
  if (!apiKey) return null;

  const baseUrl = String(
    process.env.COMMENT_BOT_AI_BASE_URL ||
      (process.env.COMMENT_BOT_AI_API_KEY
        ? 'https://api.deepseek.com/v1'
        : 'https://api.openai.com/v1'),
  )
    .trim()
    .replace(/\/$/, '');

  // Modelo barato por defecto
  const model = String(
    process.env.COMMENT_BOT_AI_MODEL ||
      (process.env.COMMENT_BOT_AI_API_KEY ? 'deepseek-chat' : 'gpt-4o-mini'),
  ).trim();

  return { apiKey, baseUrl, model };
};

async function classifyPromoIntentWithAi(text: string): Promise<boolean | null> {
  if (!promoAiEnabled()) return null;
  const config = resolveAiConfig();
  if (!config) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);

  // Prompt corto = pocos tokens
  const system =
    'Music Mundial VOTING moderator. divert=true only if comment tries to send people to another site/app/poll/social. divert=false for normal support on this poll. JSON only: {"divert":boolean}';

  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        temperature: 0,
        max_tokens: 20,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: text.slice(0, 400) },
        ],
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });

    if (!response.ok) return null;

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = String(payload.choices?.[0]?.message?.content || '').trim();
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]) as { divert?: boolean };
    return Boolean(parsed?.divert);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export const isCommentPromoBlocked = async (text: string): Promise<boolean> => {
  const value = String(text || '').trim();
  if (!value) return false;

  // 1) URL → bloqueo gratis
  if (containsExternalLink(value)) return true;

  // 2) No parece sospechoso → no gastar tokens
  if (!looksLikePossibleDiversion(value)) return false;

  // 3) Solo casos dudosos → IA corta
  const ai = await classifyPromoIntentWithAi(value);
  return ai === true;
};

export const containsExternalPromoOrLink = (text: string): boolean =>
  containsExternalLink(text);
