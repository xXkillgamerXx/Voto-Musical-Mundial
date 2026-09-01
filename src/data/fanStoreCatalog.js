export const FAN_PLANS = [
  {
    sku: 'FAN',
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
    enabled: true,
    tagline: {
      es: 'Entras al muro del artista',
      en: 'You appear on the artist wall',
    },
    desc: {
      es: 'Mensual · votos ×2. La badge sale en tu perfil y en tus comentarios.',
      en: 'Monthly · votes ×2. Badge on your profile and comments.',
    },
    descYear: {
      es: 'Anual · votos ×2. La badge sale en tu perfil y en tus comentarios.',
      en: 'Yearly · votes ×2. Badge on your profile and comments.',
    },
    benefits: {
      es: [
        'Sales en Recientes del artista',
        'Badge azul ★ FAN en su perfil',
        'Bono bienvenida: 80 pts ya',
        '20 pts extra cada mes',
        'Bono +80 pts a los 3 meses',
      ],
      en: [
        'You appear in the artist Recents',
        'Blue ★ FAN badge on their profile',
        'Welcome bonus: 80 pts now',
        '20 extra pts every month',
        '+80 pts bonus at 3 months',
      ],
    },
  },
  {
    sku: 'SUPER',
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
    enabled: true,
    tagline: {
      es: 'Brillas en el ranking del artista',
      en: 'You shine in the artist ranking',
    },
    desc: {
      es: 'Mensual · votos ×4 · sin ads. La badge sale en tu perfil y en tus comentarios.',
      en: 'Monthly · votes ×4 · no ads. Badge on your profile and comments.',
    },
    descYear: {
      es: 'Anual · votos ×4 · sin ads. La badge sale en tu perfil y en tus comentarios.',
      en: 'Yearly · votes ×4 · no ads. Badge on your profile and comments.',
    },
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
    enabled: true,
    tagline: {
      es: 'Puedes pelear el #1 del artista',
      en: 'You can fight for #1 on the artist',
    },
    desc: {
      es: 'Mensual · votos ×8 · 3 artistas. Badge en tu perfil y comentarios. Puedes pelear el #1.',
      en: 'Monthly · votes ×8 · 3 artists. Badge on your profile and comments. You can fight for #1.',
    },
    descYear: {
      es: 'Anual · votos ×8 · 3 artistas. Badge en tu perfil y comentarios. Puedes pelear el #1.',
      en: 'Yearly · votes ×8 · 3 artists. Badge on your profile and comments. You can fight for #1.',
    },
    benefits: {
      es: [
        'Card gold + corona · slot #1 con trofeos',
        'Apoyas hasta 3 artistas a la vez',
        'Tu voto se ve dorado en el versus',
        'Quedas fijado 24h en Recientes',
        'Bono bienvenida: 400 pts ya',
        'Sin anuncios',
        'Bono +400 pts a los 3 meses',
      ],
      en: [
        'Gold card + crown · #1 slot with trophies',
        'Support up to 3 artists at once',
        'Your vote looks gold in versus',
        'Pinned 24h in Recents',
        'Welcome bonus: 400 pts now',
        'No ads',
        '+400 pts bonus at 3 months',
      ],
    },
  },
]

export const POINT_PACKS = [
  { sku: 'P100', pts: 100, usd: 0.99, cop: 3900, enabled: true, note: { es: 'boost rápido', en: 'quick boost' } },
  { sku: 'P350', pts: 350, usd: 2.99, cop: 9900, enabled: true, note: { es: 'mejor pack chico', en: 'best small pack' } },
  { sku: 'P1000', pts: 1000, usd: 7.99, cop: 24900, enabled: true, note: { es: 'para cerrar la ronda', en: 'to close the round' } },
]

export const CHECKOUT_COUNTRIES = [
  { code: 'CO', name: 'Colombia', dial: '+57' },
  { code: 'DO', name: 'República Dominicana', dial: '+1' },
  { code: 'MX', name: 'México', dial: '+52' },
  { code: 'US', name: 'Estados Unidos', dial: '+1' },
  { code: 'ES', name: 'España', dial: '+34' },
  { code: 'KR', name: 'Corea del Sur', dial: '+82' },
  { code: 'AR', name: 'Argentina', dial: '+54' },
]

export const planDurationDays = (yearly = false) => (yearly ? 365 : 30)

export const IVA_CO = 0.19

export const formatStoreMoney = (amount, currency = 'USD') => {
  if (currency === 'COP') {
    return `$${Math.round(Number(amount || 0)).toLocaleString('es-CO')}`
  }
  return `$${Number(amount || 0).toFixed(2)}`
}

export const findStoreItem = (sku) => {
  const key = String(sku || '').trim().toUpperCase()
  const plan = FAN_PLANS.find((item) => item.sku === key)
  if (plan) return { type: 'plan', ...plan }
  const pack = POINT_PACKS.find((item) => item.sku === key)
  if (pack) return { type: 'pack', ...pack, name: `${pack.pts.toLocaleString('es')} puntos`, mark: '◆', maxArtists: 0, welcomePts: pack.pts }
  return { type: 'plan', ...FAN_PLANS[0] }
}

export const storeItemPrice = (item, { currency = 'USD', yearly = false } = {}) => {
  if (item.type === 'pack') {
    return currency === 'COP' ? item.cop : item.usd
  }
  if (yearly) {
    return currency === 'COP' ? item.copYTotal : item.usdYTotal
  }
  return currency === 'COP' ? item.copM : item.usdM
}

export const storeDisplayPrice = (item, { currency = 'USD', yearly = false } = {}) => {
  if (item.type === 'pack') {
    return currency === 'COP' ? item.cop : item.usd
  }
  if (yearly) {
    return currency === 'COP' ? item.copY : item.usdY
  }
  return currency === 'COP' ? item.copM : item.usdM
}

export const checkoutTotals = (item, { currency = 'USD', yearly = false, country = 'CO', packDiscount = 0 } = {}) => {
  let base = Number(storeItemPrice(item, { currency, yearly }) || 0)
  if (item?.type === 'pack' && Number(packDiscount) > 0) {
    base = Number((base * (1 - Number(packDiscount))).toFixed(2))
  }
  const tax = country === 'CO' ? Number((base * IVA_CO).toFixed(2)) : 0
  return { base, tax, total: Number((base + tax).toFixed(2)) }
}

export const checkoutPath = (sku, { currency = 'USD', yearly = false, locale = 'es' } = {}) => {
  const path = locale === 'en' ? '/checkout' : '/pago'
  const params = new URLSearchParams({
    sku: String(sku || 'FAN').toUpperCase(),
    cur: currency === 'COP' ? 'COP' : 'USD',
    cycle: yearly ? 'year' : 'month',
  })
  return `${path}?${params.toString()}`
}
