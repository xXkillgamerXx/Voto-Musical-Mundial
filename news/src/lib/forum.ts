export const fanLabel = (sku?: string | null) => {
  if (sku === 'MEGA') return 'MEGAFAN'
  if (sku === 'SUPER') return 'SUPER FAN'
  if (sku === 'FAN') return 'FAN'
  return ''
}

export const fanTone = (sku?: string | null) => {
  if (sku === 'MEGA') return 'mega'
  if (sku === 'SUPER') return 'super'
  if (sku === 'FAN') return 'fan'
  return ''
}

export const FORUM_BOARDS = [
  { slug: 'pop', icon: 'note', name: { es: 'POP', en: 'POP' } },
  { slug: 'kpop', icon: 'music', name: { es: 'KPOP', en: 'KPOP' } },
  { slug: 'hall-of-fame', icon: 'artist', name: { es: 'HALL OF FAME', en: 'HALL OF FAME' } },
  { slug: 'vip', icon: 'mic', name: { es: 'VIP & PREMIUM', en: 'VIP & PREMIUM' } },
  { slug: 'spaces', icon: 'pop', name: { es: 'SPACES', en: 'SPACES' } },
] as const

const FORUM_COVERS: Record<string, string> = {
  pop: '/images/taylor-swift.jpg',
  kpop: '/images/katseye.jpg',
  'hall-of-fame': '/images/jungkook-hero.jpg',
  vip: '/images/jennie-tame.webp',
  spaces: '/images/hoshi.jpg',
  bts: '/images/bts-colombia.jpg',
}

const FORUM_COVER_FALLBACKS = [
  '/images/taylor-swift.jpg',
  '/images/katseye.jpg',
  '/images/jungkook-hero.jpg',
  '/images/jennie-tame.webp',
  '/images/hoshi.jpg',
  '/images/stray-kids-grammy.jpg',
  '/images/bts-colombia.jpg',
]

export function forumCover(slug: string, index = 0) {
  return FORUM_COVERS[slug] || FORUM_COVER_FALLBACKS[Math.abs(index) % FORUM_COVER_FALLBACKS.length]
}
