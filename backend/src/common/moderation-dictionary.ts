/**
 * Diccionario barato de moderación (sin IA / sin tokens).
 * Se usa para marcar alertas al admin, no para bloquear al usuario automáticamente.
 */

export type DictionaryMatch = {
  category: string;
  label: string;
};

const normalize = (value: string) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const compact = (value: string) => normalize(value).replace(/\s+/g, '');

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

export const PROMO_PHRASES: Array<{ id: string; phrase: string }> = [
  // --- ES: seguir / ir ---
  { id: 'promo_follow', phrase: 'sigueme en' },
  { id: 'promo_follow', phrase: 'sigueme' },
  { id: 'promo_follow', phrase: 'siguenos' },
  { id: 'promo_follow', phrase: 'siganme' },
  { id: 'promo_follow', phrase: 'seguime' },
  { id: 'promo_go', phrase: 'vengan a' },
  { id: 'promo_go', phrase: 'vayan a' },
  { id: 'promo_go', phrase: 'entren a' },
  { id: 'promo_go', phrase: 'entra a' },
  { id: 'promo_go', phrase: 'entra en' },
  { id: 'promo_go', phrase: 've a mi' },
  { id: 'promo_go', phrase: 'vean en' },
  { id: 'promo_go', phrase: 'miren en' },
  { id: 'promo_go', phrase: 'visita mi' },
  { id: 'promo_go', phrase: 'visiten mi' },
  { id: 'promo_go', phrase: 'unete a' },
  { id: 'promo_go', phrase: 'únete a' },
  { id: 'promo_go', phrase: 'sumate a' },
  { id: 'promo_go', phrase: 'súmate a' },
  // --- EN: follow / go ---
  { id: 'promo_follow', phrase: 'follow me' },
  { id: 'promo_follow', phrase: 'follow us' },
  { id: 'promo_follow', phrase: 'follow on' },
  { id: 'promo_follow', phrase: 'follow my' },
  { id: 'promo_follow', phrase: 'add me on' },
  { id: 'promo_follow', phrase: 'add us on' },
  { id: 'promo_follow', phrase: 'find me on' },
  { id: 'promo_follow', phrase: 'find us on' },
  { id: 'promo_follow', phrase: 'subscribe to' },
  { id: 'promo_follow', phrase: 'subscribe on' },
  { id: 'promo_go', phrase: 'go to' },
  { id: 'promo_go', phrase: 'go check' },
  { id: 'promo_go', phrase: 'check out' },
  { id: 'promo_go', phrase: 'check my' },
  { id: 'promo_go', phrase: 'visit my' },
  { id: 'promo_go', phrase: 'visit our' },
  { id: 'promo_go', phrase: 'join my' },
  { id: 'promo_go', phrase: 'join our' },
  { id: 'promo_go', phrase: 'join us on' },
  { id: 'promo_go', phrase: 'join me on' },
  { id: 'promo_go', phrase: 'see my' },
  { id: 'promo_go', phrase: 'watch on' },
  { id: 'promo_go', phrase: 'watch my' },
  { id: 'promo_go', phrase: 'dm me on' },
  { id: 'promo_go', phrase: 'message me on' },
  { id: 'promo_go', phrase: 'text me on' },
  { id: 'promo_go', phrase: 'hit me up on' },
  { id: 'promo_go', phrase: 'head to my' },
  { id: 'promo_go', phrase: 'head over to' },
  // --- ES: mi canal / página ---
  { id: 'promo_channel', phrase: 'mi canal' },
  { id: 'promo_channel', phrase: 'mi pagina' },
  { id: 'promo_channel', phrase: 'mi página' },
  { id: 'promo_channel', phrase: 'mi web' },
  { id: 'promo_channel', phrase: 'mi sitio' },
  { id: 'promo_channel', phrase: 'mi perfil' },
  { id: 'promo_channel', phrase: 'mi grupo' },
  { id: 'promo_channel', phrase: 'mi server' },
  { id: 'promo_channel', phrase: 'mi servidor' },
  { id: 'promo_channel', phrase: 'mi discord' },
  { id: 'promo_channel', phrase: 'mi telegram' },
  { id: 'promo_channel', phrase: 'mi whatsapp' },
  { id: 'promo_channel', phrase: 'mi instagram' },
  { id: 'promo_channel', phrase: 'mi tiktok' },
  { id: 'promo_channel', phrase: 'mi twitter' },
  { id: 'promo_channel', phrase: 'mi facebook' },
  { id: 'promo_channel', phrase: 'mi youtube' },
  { id: 'promo_channel', phrase: 'mi enlace' },
  { id: 'promo_channel', phrase: 'mi link' },
  // --- EN: my channel / page ---
  { id: 'promo_channel', phrase: 'my channel' },
  { id: 'promo_channel', phrase: 'my page' },
  { id: 'promo_channel', phrase: 'my site' },
  { id: 'promo_channel', phrase: 'my website' },
  { id: 'promo_channel', phrase: 'my profile' },
  { id: 'promo_channel', phrase: 'my group' },
  { id: 'promo_channel', phrase: 'my server' },
  { id: 'promo_channel', phrase: 'my discord' },
  { id: 'promo_channel', phrase: 'my telegram' },
  { id: 'promo_channel', phrase: 'my whatsapp' },
  { id: 'promo_channel', phrase: 'my instagram' },
  { id: 'promo_channel', phrase: 'my tiktok' },
  { id: 'promo_channel', phrase: 'my twitter' },
  { id: 'promo_channel', phrase: 'my facebook' },
  { id: 'promo_channel', phrase: 'my youtube' },
  { id: 'promo_channel', phrase: 'my link' },
  { id: 'promo_channel', phrase: 'my bio' },
  { id: 'promo_channel', phrase: 'link in bio' },
  { id: 'promo_channel', phrase: 'link in my bio' },
  { id: 'promo_channel', phrase: 'bio link' },
  { id: 'promo_channel', phrase: 'use my link' },
  { id: 'promo_channel', phrase: 'promo link' },
  // --- Redes / dominios (ES + EN) ---
  { id: 'promo_social', phrase: 'instagram.com' },
  { id: 'promo_social', phrase: 'tiktok.com' },
  { id: 'promo_social', phrase: 'telegram.me' },
  { id: 'promo_social', phrase: 'discord.gg' },
  { id: 'promo_social', phrase: 'discord.com' },
  { id: 'promo_social', phrase: 't.me/' },
  { id: 'promo_social', phrase: 'wa.me/' },
  { id: 'promo_social', phrase: 'whatsapp.com' },
  { id: 'promo_social', phrase: 'youtube.com' },
  { id: 'promo_social', phrase: 'youtu.be' },
  { id: 'promo_social', phrase: 'facebook.com' },
  { id: 'promo_social', phrase: 'fb.com' },
  { id: 'promo_social', phrase: 'twitter.com' },
  { id: 'promo_social', phrase: 'x.com/' },
  { id: 'promo_social', phrase: 'snapchat.com' },
  { id: 'promo_social', phrase: 'twitch.tv' },
  { id: 'promo_social', phrase: 'kick.com' },
  { id: 'promo_social', phrase: 'onlyfans.com' },
  { id: 'promo_social', phrase: 'patreon.com' },
  { id: 'promo_social', phrase: 'linktr.ee' },
  { id: 'promo_social', phrase: 'solo.to' },
  { id: 'promo_social', phrase: 'beacons.ai' },
  { id: 'promo_social', phrase: 'carrd.co' },
  { id: 'promo_social', phrase: 'threads.net' },
  { id: 'promo_social', phrase: 'weverse.io' },
  { id: 'promo_social', phrase: 'vlive.tv' },
];

export const DIVERSION_PHRASES: Array<{ id: string; phrase: string }> = [
  // --- ES: votar en otro lado ---
  { id: 'divert_vote', phrase: 'voten en otra' },
  { id: 'divert_vote', phrase: 'voten en otro' },
  { id: 'divert_vote', phrase: 'voten en una' },
  { id: 'divert_vote', phrase: 'voten en un' },
  { id: 'divert_vote', phrase: 'vota en otra' },
  { id: 'divert_vote', phrase: 'vota en otro' },
  { id: 'divert_vote', phrase: 'vote en otro' },
  { id: 'divert_vote', phrase: 'votar en otra' },
  { id: 'divert_vote', phrase: 'votar en otro' },
  { id: 'divert_vote', phrase: 'votar en una' },
  { id: 'divert_vote', phrase: 'vayan a votar' },
  { id: 'divert_vote', phrase: 'vengan a votar' },
  { id: 'divert_vote', phrase: 'vamos a votar en' },
  { id: 'divert_vote', phrase: 'mejor voten en' },
  { id: 'divert_vote', phrase: 'mejor vote en' },
  { id: 'divert_vote', phrase: 'mejor vota en' },
  { id: 'divert_vote', phrase: 'voten mejor en' },
  { id: 'divert_vote', phrase: 'voten alla' },
  { id: 'divert_vote', phrase: 'voten allá' },
  { id: 'divert_vote', phrase: 'voten ahi' },
  { id: 'divert_vote', phrase: 'voten ahí' },
  { id: 'divert_vote', phrase: 'vota alla' },
  { id: 'divert_vote', phrase: 'vota allá' },
  { id: 'divert_vote', phrase: 'voten en mi' },
  { id: 'divert_vote', phrase: 'vota en mi' },
  { id: 'divert_vote', phrase: 'otra pagina' },
  { id: 'divert_vote', phrase: 'otra página' },
  { id: 'divert_vote', phrase: 'otra web' },
  { id: 'divert_vote', phrase: 'otra votacion' },
  { id: 'divert_vote', phrase: 'otra votación' },
  { id: 'divert_vote', phrase: 'otra plataforma' },
  { id: 'divert_vote', phrase: 'otro sitio' },
  { id: 'divert_vote', phrase: 'otro link' },
  { id: 'divert_vote', phrase: 'otro enlace' },
  { id: 'divert_vote', phrase: 'otra app' },
  { id: 'divert_vote', phrase: 'pasen a votar' },
  { id: 'divert_vote', phrase: 'pasen a la otra' },
  { id: 'divert_vote', phrase: 'voten en el link' },
  { id: 'divert_vote', phrase: 'voten en el enlace' },
  // --- EN: vote elsewhere ---
  { id: 'divert_vote', phrase: 'vote elsewhere' },
  { id: 'divert_vote', phrase: 'vote somewhere else' },
  { id: 'divert_vote', phrase: 'vote on another' },
  { id: 'divert_vote', phrase: 'vote on other' },
  { id: 'divert_vote', phrase: 'vote on a different' },
  { id: 'divert_vote', phrase: 'vote at another' },
  { id: 'divert_vote', phrase: 'vote at other' },
  { id: 'divert_vote', phrase: 'go vote on' },
  { id: 'divert_vote', phrase: 'go vote at' },
  { id: 'divert_vote', phrase: 'go vote elsewhere' },
  { id: 'divert_vote', phrase: 'come vote on' },
  { id: 'divert_vote', phrase: 'come vote at' },
  { id: 'divert_vote', phrase: 'better vote on' },
  { id: 'divert_vote', phrase: 'better vote at' },
  { id: 'divert_vote', phrase: 'better voting on' },
  { id: 'divert_vote', phrase: 'cast your vote on' },
  { id: 'divert_vote', phrase: 'cast vote on' },
  { id: 'divert_vote', phrase: 'cast your vote at' },
  { id: 'divert_vote', phrase: 'voting on another' },
  { id: 'divert_vote', phrase: 'voting elsewhere' },
  { id: 'divert_vote', phrase: 'voting on other' },
  { id: 'divert_vote', phrase: 'another site' },
  { id: 'divert_vote', phrase: 'another page' },
  { id: 'divert_vote', phrase: 'another website' },
  { id: 'divert_vote', phrase: 'another platform' },
  { id: 'divert_vote', phrase: 'another poll' },
  { id: 'divert_vote', phrase: 'other site' },
  { id: 'divert_vote', phrase: 'other page' },
  { id: 'divert_vote', phrase: 'other website' },
  { id: 'divert_vote', phrase: 'other platform' },
  { id: 'divert_vote', phrase: 'other poll' },
  { id: 'divert_vote', phrase: 'different site' },
  { id: 'divert_vote', phrase: 'different poll' },
  { id: 'divert_vote', phrase: 'different page' },
  { id: 'divert_vote', phrase: 'real poll is' },
  { id: 'divert_vote', phrase: 'real vote is' },
  { id: 'divert_vote', phrase: 'official poll is' },
  { id: 'divert_vote', phrase: 'official vote is' },
  { id: 'divert_vote', phrase: 'the real voting' },
  { id: 'divert_vote', phrase: 'real voting site' },
  { id: 'divert_vote', phrase: 'vote instead on' },
  { id: 'divert_vote', phrase: 'vote instead at' },
  { id: 'divert_vote', phrase: 'vote on the real' },
  { id: 'divert_vote', phrase: 'vote on the official' },
  // --- ES: fake / no votar aquí ---
  { id: 'divert_fake', phrase: 'no voten aqui' },
  { id: 'divert_fake', phrase: 'no voten aquí' },
  { id: 'divert_fake', phrase: 'no voten en esta' },
  { id: 'divert_fake', phrase: 'no votes aqui' },
  { id: 'divert_fake', phrase: 'no votes aquí' },
  { id: 'divert_fake', phrase: 'esta es falsa' },
  { id: 'divert_fake', phrase: 'esta votacion es falsa' },
  { id: 'divert_fake', phrase: 'esta votación es falsa' },
  { id: 'divert_fake', phrase: 'esta pagina es falsa' },
  { id: 'divert_fake', phrase: 'esta página es falsa' },
  { id: 'divert_fake', phrase: 'es una estafa' },
  { id: 'divert_fake', phrase: 'es estafa' },
  { id: 'divert_fake', phrase: 'salgan de aqui' },
  { id: 'divert_fake', phrase: 'salgan de aquí' },
  { id: 'divert_fake', phrase: 'dejen esta pagina' },
  { id: 'divert_fake', phrase: 'dejen esta página' },
  { id: 'divert_fake', phrase: 'ignoren esta' },
  { id: 'divert_fake', phrase: 'ignoren esta votacion' },
  { id: 'divert_fake', phrase: 'ignoren esta votación' },
  // --- EN: fake / don't vote here ---
  { id: 'divert_fake', phrase: 'dont vote here' },
  { id: 'divert_fake', phrase: "don't vote here" },
  { id: 'divert_fake', phrase: 'do not vote here' },
  { id: 'divert_fake', phrase: 'stop voting here' },
  { id: 'divert_fake', phrase: 'dont vote on this' },
  { id: 'divert_fake', phrase: "don't vote on this" },
  { id: 'divert_fake', phrase: 'do not vote on this' },
  { id: 'divert_fake', phrase: 'this is fake' },
  { id: 'divert_fake', phrase: 'this poll is fake' },
  { id: 'divert_fake', phrase: 'this vote is fake' },
  { id: 'divert_fake', phrase: 'fake poll' },
  { id: 'divert_fake', phrase: 'fake voting' },
  { id: 'divert_fake', phrase: 'scam poll' },
  { id: 'divert_fake', phrase: 'scam site' },
  { id: 'divert_fake', phrase: 'leave this site' },
  { id: 'divert_fake', phrase: 'leave this page' },
  { id: 'divert_fake', phrase: 'ignore this poll' },
  { id: 'divert_fake', phrase: 'ignore this vote' },
  { id: 'divert_fake', phrase: 'not the real poll' },
  { id: 'divert_fake', phrase: 'not the real vote' },
  // --- Links de votación ---
  { id: 'divert_link', phrase: 'link para votar' },
  { id: 'divert_link', phrase: 'enlace para votar' },
  { id: 'divert_link', phrase: 'pagina para votar' },
  { id: 'divert_link', phrase: 'página para votar' },
  { id: 'divert_link', phrase: 'link de la votacion' },
  { id: 'divert_link', phrase: 'link de la votación' },
  { id: 'divert_link', phrase: 'busquen la votacion' },
  { id: 'divert_link', phrase: 'busquen la votación' },
  { id: 'divert_link', phrase: 'vote link' },
  { id: 'divert_link', phrase: 'voting link' },
  { id: 'divert_link', phrase: 'poll link' },
  { id: 'divert_link', phrase: 'link to vote' },
  { id: 'divert_link', phrase: 'link to voting' },
  { id: 'divert_link', phrase: 'voting page' },
  { id: 'divert_link', phrase: 'vote page' },
  { id: 'divert_link', phrase: 'poll page' },
  { id: 'divert_link', phrase: 'where to vote' },
  { id: 'divert_link', phrase: 'where you can vote' },
];

export const DIVERSION_REGEXES: Array<{ id: string; pattern: RegExp; label: string }> = [
  {
    id: 'divert_pattern',
    pattern: /\b(voten|vote|vota|votar|voting)\b.{0,40}\b(otra|otro|elsewhere|another|other|different)\b/i,
    label: 'voto + destino externo',
  },
  {
    id: 'divert_pattern',
    pattern: /\b(no|dont|don't|do not)\b.{0,12}\b(voten|vote|vota|voting)\b.{0,20}\b(aqui|aquí|here|this|esta)\b/i,
    label: 'no votar aquí',
  },
  {
    id: 'divert_pattern',
    pattern: /\b(vengan|vayan|pasen|salgan|go|come|head)\b.{0,30}\b(votar|votacion|votación|vote|voting|poll|otra|otro|alla|ahí|ahi|there)\b/i,
    label: 'ir a votar afuera',
  },
  {
    id: 'divert_pattern',
    pattern: /\b(mejor|better)\b.{0,20}\b(voten|vote|vota|votar|voting)\b.{0,30}\b(en|on|at|a)\b/i,
    label: 'mejor votar en otro sitio',
  },
  {
    id: 'divert_pattern',
    pattern: /\b(this|esta|este)\b.{0,15}\b(poll|votacion|votación|vote|voting|site|page|pagina|página)\b.{0,25}\b(fake|falsa|scam|estafa|fraud)\b/i,
    label: 'poll/vote falso',
  },
  {
    id: 'divert_pattern',
    pattern: /\b(real|official|verdadera|oficial)\b.{0,20}\b(poll|vote|voting|votacion|votación|site|page)\b.{0,25}\b(is|esta|está|on|at|en)\b/i,
    label: 'poll/vote real en otro lado',
  },
  {
    id: 'divert_pattern',
    pattern: /\b(dejen|dejan|leave|ignore|salgan)\b.{0,20}\b(esta|this)\b.{0,15}\b(votacion|votación|poll|page|pagina|página|site)\b/i,
    label: 'abandonar esta votación',
  },
];

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

const extractExternalUrls = (text: string) => {
  const found: string[] = [...(text.match(URL_PATTERN) || [])];
  let match: RegExpExecArray | null;
  const bare = new RegExp(BARE_DOMAIN_PATTERN.source, 'gi');
  while ((match = bare.exec(text)) !== null) {
    found.push(match[1] || match[0]);
  }
  return found.filter((url) => !isOwnHost(url));
};

export type DictionaryOverrides = {
  customPromo?: Array<{ id: string; phrase: string }>;
  customDiversion?: Array<{ id: string; phrase: string }>;
  disabledKeys?: Set<string>;
};

export const dictionaryPhraseKey = (category: string, phrase: string) =>
  `${category}|${normalize(phrase)}`;

export const CATEGORY_LABELS: Record<string, string> = {
  promo_follow: 'Promo · seguir',
  promo_go: 'Promo · ir / visitar',
  promo_channel: 'Promo · canal / página',
  promo_social: 'Promo · red social / dominio',
  divert_vote: 'Diversion · votar en otro sitio',
  divert_fake: 'Diversion · votación falsa',
  divert_link: 'Diversion · link de votación',
  divert_pattern: 'Diversion · patrón regex',
  external_link: 'Enlace externo (bloqueo duro)',
};

const filterPhraseList = (
  entries: Array<{ id: string; phrase: string }>,
  disabledKeys?: Set<string>,
) =>
  entries.filter((entry) => !disabledKeys?.has(dictionaryPhraseKey(entry.id, entry.phrase)));

const matchPhraseList = (
  normalized: string,
  compacted: string,
  entries: Array<{ id: string; phrase: string }>,
  disabledKeys?: Set<string>,
) => {
  const matches: DictionaryMatch[] = [];
  for (const entry of filterPhraseList(entries, disabledKeys)) {
    const phrase = normalize(entry.phrase);
    const phraseCompact = phrase.replace(/\s+/g, '');
    if (normalized.includes(phrase) || compacted.includes(phraseCompact)) {
      matches.push({ category: entry.id, label: entry.phrase });
    }
  }
  return matches;
};

export type CommentDictionaryScan = {
  suspicious: boolean;
  matches: DictionaryMatch[];
  externalUrls: string[];
  primaryType: 'none' | 'external_link' | 'promo' | 'diversion';
};

export const listBuiltinDictionaryEntries = () => {
  const promo = PROMO_PHRASES.map((entry) => ({
    ...entry,
    type: 'promo' as const,
    key: dictionaryPhraseKey(entry.id, entry.phrase),
    categoryLabel: CATEGORY_LABELS[entry.id] || entry.id,
    source: 'builtin' as const,
  }));
  const diversion = DIVERSION_PHRASES.map((entry) => ({
    ...entry,
    type: 'diversion' as const,
    key: dictionaryPhraseKey(entry.id, entry.phrase),
    categoryLabel: CATEGORY_LABELS[entry.id] || entry.id,
    source: 'builtin' as const,
  }));
  const regexes = DIVERSION_REGEXES.map((entry) => ({
    id: entry.id,
    label: entry.label,
    pattern: entry.pattern.source,
    categoryLabel: CATEGORY_LABELS[entry.id] || entry.id,
    source: 'regex' as const,
  }));
  return { promo, diversion, regexes };
};

export const scanCommentDictionary = (
  text: string,
  overrides?: DictionaryOverrides,
): CommentDictionaryScan => {
  const raw = String(text || '').trim();
  if (!raw) {
    return { suspicious: false, matches: [], externalUrls: [], primaryType: 'none' };
  }

  const normalized = normalize(raw);
  const compacted = compact(raw);
  const externalUrls = extractExternalUrls(raw);
  const matches: DictionaryMatch[] = [];

  if (externalUrls.length) {
    matches.push({ category: 'external_link', label: 'enlace externo' });
  }

  const disabledKeys = overrides?.disabledKeys;
  const promoPhrases = [
    ...filterPhraseList(PROMO_PHRASES, disabledKeys),
    ...filterPhraseList(overrides?.customPromo || [], disabledKeys),
  ];
  const diversionPhrases = [
    ...filterPhraseList(DIVERSION_PHRASES, disabledKeys),
    ...filterPhraseList(overrides?.customDiversion || [], disabledKeys),
  ];

  matches.push(...matchPhraseList(normalized, compacted, promoPhrases, disabledKeys));
  matches.push(...matchPhraseList(normalized, compacted, diversionPhrases, disabledKeys));

  for (const entry of DIVERSION_REGEXES) {
    if (entry.pattern.test(normalized) || entry.pattern.test(raw)) {
      matches.push({ category: entry.id, label: entry.label });
    }
  }

  const unique = matches.filter(
    (item, index, list) =>
      list.findIndex((other) => other.category === item.category && other.label === item.label) ===
      index,
  );

  let primaryType: CommentDictionaryScan['primaryType'] = 'none';
  if (externalUrls.length) primaryType = 'external_link';
  else if (unique.some((m) => m.category.startsWith('divert'))) primaryType = 'diversion';
  else if (unique.some((m) => m.category.startsWith('promo'))) primaryType = 'promo';

  return {
    suspicious: unique.length > 0,
    matches: unique,
    externalUrls,
    primaryType,
  };
};

export const SPAWN_SIGNUP_ALERT_THRESHOLD = 2;

export const buildSpawnSignupReason = (ipShort: string, accountCount: number) =>
  `Posible spawn: ${accountCount} cuentas desde la misma IP (${ipShort}).`;

export const buildCommentAlertReason = (scan: CommentDictionaryScan) => {
  if (scan.primaryType === 'external_link') {
    return 'Comentario con enlace externo';
  }
  if (scan.primaryType === 'diversion') {
    return 'Posible intento de llevar votos a otra página';
  }
  if (scan.primaryType === 'promo') {
    return 'Posible promoción de otra página o red social';
  }
  return 'Comentario sospechoso';
};
