export const FAN_STORE_REDIS_KEY = 'app:settings:fan_store';

export type FanStoreVisibility = 'public' | 'admin' | 'hidden';

export type LocalizedText = Record<string, string>;
export type LocalizedList = Record<string, string[]>;

export type FanPlanConfig = {
  sku: string;
  enabled: boolean;
  name: string;
  icon: string;
  mark: string;
  accent: string;
  multiplier: number;
  maxArtists: number;
  welcomePts: number;
  usdM: number;
  usdY: number;
  usdYTotal: number;
  copM: number;
  copY: number;
  copYTotal: number;
  featured: boolean;
  mega: boolean;
  tagline: LocalizedText;
  desc: LocalizedText;
  descYear: LocalizedText;
  benefits: LocalizedList;
};

export type FanPackConfig = {
  sku: string;
  enabled: boolean;
  pts: number;
  usd: number;
  cop: number;
  note: LocalizedText;
};

export type FanStoreConfig = {
  visibility: FanStoreVisibility;
  headline: LocalizedText;
  subhead: LocalizedText;
  plans: FanPlanConfig[];
  packs: FanPackConfig[];
};

const text = (es: string, en: string): LocalizedText => ({ es, en });

export const DEFAULT_FAN_STORE: FanStoreConfig = {
  visibility: 'public',
  headline: text('Potencia tu voto', 'Boost your vote'),
  subhead: text(
    'Multiplica tus votos y aparece en el perfil del artista. Eliges a quién apoyar al pagar.',
    'Multiply your votes and appear on the artist profile. Pick the artist at checkout.',
  ),
  plans: [
    {
      sku: 'FAN',
      enabled: true,
      name: 'FAN',
      icon: 'fa-solid fa-star',
      mark: '★',
      accent: 'fan',
      multiplier: 2,
      maxArtists: 1,
      welcomePts: 80,
      usdM: 1.99,
      usdY: 1.59,
      usdYTotal: 19.08,
      copM: 6900,
      copY: 5500,
      copYTotal: 66000,
      featured: false,
      mega: false,
      tagline: text('Entras al muro del artista', 'You appear on the artist wall'),
      desc: text(
        'Mensual · votos ×2. La badge sale en tu perfil y en tus comentarios.',
        'Monthly · votes ×2. Badge on your profile and comments.',
      ),
      descYear: text(
        'Anual · votos ×2. La badge sale en tu perfil y en tus comentarios.',
        'Yearly · votes ×2. Badge on your profile and comments.',
      ),
      benefits: {
        es: [
          'Sales en Recientes del artista',
          'Badge FAN en su perfil',
          'Bono bienvenida: 80 pts ya',
          '20 pts extra cada mes',
          'Bono +80 pts a los 3 meses',
        ],
        en: [
          'You appear in the artist Recents',
          'FAN badge on their profile',
          'Welcome bonus: 80 pts now',
          '20 extra pts every month',
          '+80 pts bonus at 3 months',
        ],
      },
    },
    {
      sku: 'SUPER',
      enabled: true,
      name: 'SUPER FAN',
      icon: 'fa-solid fa-bolt',
      mark: '⚡',
      accent: 'super',
      multiplier: 4,
      maxArtists: 1,
      welcomePts: 200,
      usdM: 4.99,
      usdY: 3.99,
      usdYTotal: 47.88,
      copM: 15900,
      copY: 12700,
      copYTotal: 152400,
      featured: true,
      mega: false,
      tagline: text('Brillas en el ranking del artista', 'You shine in the artist ranking'),
      desc: text(
        'Mensual · votos ×4 · sin ads. La badge sale en tu perfil y en tus comentarios.',
        'Monthly · votes ×4 · no ads. Badge on your profile and comments.',
      ),
      descYear: text(
        'Anual · votos ×4 · sin ads. La badge sale en tu perfil y en tus comentarios.',
        'Yearly · votes ×4 · no ads. Badge on your profile and comments.',
      ),
      benefits: {
        es: [
          'Card magenta destacada en Supporters',
          'Sales en Recientes y Top apoyo',
          'Eliges 1 artista apoyado',
          '50 pts extra cada mes',
          '−10% en packs',
          'Sin anuncios',
          'Bono +200 pts a los 3 meses',
        ],
        en: [
          'Featured magenta card in Supporters',
          'You appear in Recents and Top support',
          'You pick 1 supported artist',
          '50 extra pts every month',
          '−10% on packs',
          'No ads',
          '+200 pts bonus at 3 months',
        ],
      },
    },
    {
      sku: 'MEGA',
      enabled: true,
      name: 'MEGA FAN',
      icon: 'fa-solid fa-crown',
      mark: '♛',
      accent: 'mega',
      multiplier: 8,
      maxArtists: 3,
      welcomePts: 400,
      usdM: 9.99,
      usdY: 7.99,
      usdYTotal: 95.88,
      copM: 31900,
      copY: 25500,
      copYTotal: 306000,
      featured: false,
      mega: true,
      tagline: text('Puedes pelear el #1 del artista', 'You can fight for #1 on the artist'),
      desc: text(
        'Mensual · votos ×8 · 3 artistas. Badge en tu perfil y comentarios. Puedes pelear el #1.',
        'Monthly · votes ×8 · 3 artists. Badge on your profile and comments. You can fight for #1.',
      ),
      descYear: text(
        'Anual · votos ×8 · 3 artistas. Badge en tu perfil y comentarios. Puedes pelear el #1.',
        'Yearly · votes ×8 · 3 artists. Badge on your profile and comments. You can fight for #1.',
      ),
      benefits: {
        es: [
          'Card gold + corona en Supporters',
          'Apoyas hasta 3 artistas a la vez',
          'Tu voto se ve dorado en el versus',
          'Quedas fijado 24h en Recientes',
          'Bono bienvenida: 400 pts ya',
          'Sin anuncios',
          'Bono +400 pts a los 3 meses',
        ],
        en: [
          'Gold card + crown in Supporters',
          'Support up to 3 artists at once',
          'Your vote looks gold in versus',
          'Pinned 24h in Recents',
          'Welcome bonus: 400 pts now',
          'No ads',
          '+400 pts bonus at 3 months',
        ],
      },
    },
  ],
  packs: [
    { sku: 'P100', enabled: true, pts: 100, usd: 0.99, cop: 3900, note: text('boost rápido', 'quick boost') },
    { sku: 'P350', enabled: true, pts: 350, usd: 2.99, cop: 9900, note: text('mejor pack chico', 'best small pack') },
    { sku: 'P1000', enabled: true, pts: 1000, usd: 7.99, cop: 24900, note: text('para cerrar la ronda', 'to close the round') },
  ],
};

const asRecord = (value: unknown) =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const asText = (value: unknown, fallback: LocalizedText): LocalizedText => {
  const row = asRecord(value);
  const keys = new Set([...Object.keys(fallback), ...Object.keys(row)]);
  const next: LocalizedText = { ...fallback };
  for (const key of keys) {
    const raw = row[key];
    if (typeof raw === 'string') {
      const text = raw.trim();
      if (text) next[key] = text;
    }
  }
  return next;
};

const asLocalizedList = (value: unknown, fallback: LocalizedList): LocalizedList => {
  const row = asRecord(value);
  const keys = new Set([...Object.keys(fallback), ...Object.keys(row)]);
  const next: LocalizedList = { ...fallback };
  for (const key of keys) {
    next[key] = asList(row[key], fallback[key] || fallback.es || []);
  }
  return next;
};

const asList = (value: unknown, fallback: string[]) => {
  if (typeof value === 'string') {
    return value
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  }
  if (Array.isArray(value)) {
    const lines = value.map((line) => String(line || '').trim()).filter(Boolean);
    return lines.length ? lines : fallback;
  }
  return fallback;
};

const money = (value: unknown, fallback: number) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : fallback;
};

const visibilityFor = (value: unknown): FanStoreVisibility => {
  const next = String(value || '').trim().toLowerCase();
  if (next === 'admin' || next === 'hidden') return next;
  return 'public';
};

const planBySku = (sku: string) => DEFAULT_FAN_STORE.plans.find((plan) => plan.sku === sku);

export const normalizeFanPlan = (input: unknown, fallback: FanPlanConfig): FanPlanConfig => {
  const row = asRecord(input);
  const sku = String(row.sku || fallback.sku).trim().toUpperCase() || fallback.sku;
  const base = planBySku(sku) || fallback;
  return {
    ...base,
    enabled: row.enabled !== false,
    name: String(row.name || base.name).trim() || base.name,
    icon: String(row.icon || base.icon).trim() || base.icon,
    mark: String(row.mark || base.mark).trim() || base.mark,
    accent: String(row.accent || base.accent).trim() || base.accent,
    multiplier: Math.max(1, Math.floor(money(row.multiplier, base.multiplier))),
    maxArtists: Math.max(0, Math.floor(money(row.maxArtists, base.maxArtists))),
    welcomePts: Math.max(0, Math.floor(money(row.welcomePts, base.welcomePts))),
    usdM: money(row.usdM, base.usdM),
    usdY: money(row.usdY, base.usdY),
    usdYTotal: money(row.usdYTotal, base.usdYTotal),
    copM: Math.round(money(row.copM, base.copM)),
    copY: Math.round(money(row.copY, base.copY)),
    copYTotal: Math.round(money(row.copYTotal, base.copYTotal)),
    featured: Boolean(row.featured ?? base.featured),
    mega: Boolean(row.mega ?? base.mega),
    tagline: asText(row.tagline, base.tagline),
    desc: asText(row.desc, base.desc),
    descYear: asText(row.descYear, base.descYear),
    benefits: asLocalizedList(row.benefits, base.benefits),
  };
};

export const normalizeFanPack = (input: unknown, fallback: FanPackConfig): FanPackConfig => {
  const row = asRecord(input);
  return {
    sku: String(row.sku || fallback.sku).trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 20) || fallback.sku,
    enabled: row.enabled !== false,
    pts: Math.max(1, Math.floor(money(row.pts, fallback.pts))),
    usd: money(row.usd, fallback.usd),
    cop: Math.round(money(row.cop, fallback.cop)),
    note: asText(row.note, fallback.note),
  };
};

const blankPack = (sku: string): FanPackConfig => ({
  sku,
  enabled: true,
  pts: 100,
  usd: 0.99,
  cop: 3900,
  note: text('', ''),
});

const uniquePackSku = (sku: string, used: Set<string>, pts: number) => {
  const base = (sku || `P${Math.max(1, pts || 100)}`).replace(/[^A-Z0-9_-]/g, '').slice(0, 16) || `P${pts || 100}`;
  if (!used.has(base)) return base;
  let n = 2;
  while (used.has(`${base}-${n}`) && n < 99) n += 1;
  return `${base}-${n}`.slice(0, 20);
};

export const normalizeFanStoreConfig = (input: unknown): FanStoreConfig => {
  const row = asRecord(input);
  const savedPlans = Array.isArray(row.plans) ? row.plans : [];
  const savedPacks = Array.isArray(row.packs) ? row.packs : DEFAULT_FAN_STORE.packs;
  const usedSkus = new Set<string>();
  return {
    visibility: visibilityFor(row.visibility),
    headline: asText(row.headline, DEFAULT_FAN_STORE.headline),
    subhead: asText(row.subhead, DEFAULT_FAN_STORE.subhead),
    plans: DEFAULT_FAN_STORE.plans.map((plan) => {
      const match = savedPlans.find((item) => String(asRecord(item).sku || '').toUpperCase() === plan.sku);
      return normalizeFanPlan(match || plan, plan);
    }),
    packs: savedPacks.map((item, index) => {
      const rawSku = String(asRecord(item).sku || '').trim().toUpperCase();
      const fallback =
        DEFAULT_FAN_STORE.packs.find((pack) => pack.sku === rawSku) ||
        DEFAULT_FAN_STORE.packs[index] ||
        blankPack(`P${index + 1}`);
      const normalized = normalizeFanPack(item, fallback);
      const sku = uniquePackSku(normalized.sku, usedSkus, normalized.pts);
      usedSkus.add(sku);
      return { ...normalized, sku };
    }),
  };
};

export const buildFanStorePayload = (config: FanStoreConfig, { publicOnly = false } = {}) => ({
  visibility: config.visibility,
  headline: config.headline,
  subhead: config.subhead,
  plans: publicOnly ? config.plans.filter((plan) => plan.enabled) : config.plans,
  packs: publicOnly ? config.packs.filter((pack) => pack.enabled) : config.packs,
});
