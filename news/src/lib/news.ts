import { t, type CopyKey } from './copy'

export type NewsCard = {
  id: string
  slug: string
  title: string
  excerpt: string
  coverUrl?: string | null
  category: string
  categorySlug: string
  authorName?: string
  publishedAt?: string
  href: string
  categories?: Array<{ slug: string; name: string }>
}

export const CATEGORY_PATHS: Record<string, string> = {
  kpop: 'kpop',
  'k-pop': 'kpop',
  noticias: 'noticias',
  viral: 'viral',
  pop: 'pop',
  series: 'series',
  celebridades: 'celebridades',
  entretenimiento: 'viral',
  peliculas: 'peliculas',
  'k-drama': 'k-drama',
}

export const CATEGORY_TITLES: Record<string, { es: string; en: string }> = {
  kpop: { es: 'KPOP', en: 'KPOP' },
  viral: { es: 'Viral', en: 'Viral' },
  celebridades: { es: 'Popular', en: 'Popular' },
  series: { es: 'Series', en: 'Series' },
  pop: { es: 'Pop y cultura', en: 'Pop & culture' },
  peliculas: { es: 'Películas y series', en: 'Movies & series' },
  noticias: { es: 'Noticias', en: 'News' },
  entrevista: { es: 'Entrevistas', en: 'Interviews' },
  'redes-sociales': { es: 'Redes sociales', en: 'Social' },
  'k-drama': { es: 'K-Drama', en: 'K-Drama' },
}

const CATEGORY_HERO_DARK: Record<string, 'kpop' | 'screen' | false> = {
  kpop: 'kpop',
  viral: false,
  celebridades: false,
  series: 'screen',
  peliculas: 'screen',
  pop: false,
}

const CATEGORY_HERO_COPY: Record<string, { lead: CopyKey; accent: CopyKey; blurb: CopyKey }> = {
  kpop: { lead: 'kpopLead', accent: 'kpopAccent', blurb: 'kpopBlurb' },
  viral: { lead: 'viralLead', accent: 'viralAccent', blurb: 'viralBlurb' },
  celebridades: { lead: 'popularLead', accent: 'popularAccent', blurb: 'popularBlurb' },
  series: { lead: 'screenLead', accent: 'screenAccent', blurb: 'screenBlurb' },
  peliculas: { lead: 'screenLead', accent: 'screenAccent', blurb: 'screenBlurb' },
  pop: { lead: 'popLead', accent: 'popAccent', blurb: 'popBlurb' },
}

export const categoryHero = (slug: string, locale: 'es' | 'en' = 'es') => {
  const keys = CATEGORY_HERO_COPY[slug]
  if (!keys) {
    return { lead: '', accent: categoryTitle(slug, locale), blurb: '', dark: false as const }
  }
  return {
    lead: t(locale, keys.lead),
    accent: t(locale, keys.accent),
    blurb: t(locale, keys.blurb),
    dark: CATEGORY_HERO_DARK[slug] || false,
  }
}

export const categoryTitle = (
  slug: string,
  locale: 'es' | 'en' = 'es',
  fallback?: string,
) => CATEGORY_TITLES[slug]?.[locale] || fallback || slug.replace(/-/g, ' ')

export const formatNewsDate = (value?: string | Date | null, locale: 'es' | 'en' = 'es') => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString(locale === 'en' ? 'en' : 'es', { day: 'numeric', month: 'long', year: 'numeric' })
}

export const coverOf = (post?: Partial<NewsCard> | null, fallback = '/images/jungkook-hero.jpg') =>
  post?.coverUrl || fallback

export type NewsPage =
  | { name: 'home'; locale: 'es' | 'en' }
  | { name: 'category'; locale: 'es' | 'en'; slug: string }
  | { name: 'article'; locale: 'es' | 'en'; slug: string }

export const parseNewsPage = (pathname = window.location.pathname): NewsPage => {
  const decoded = decodeURIComponent(pathname).replace(/\/+$/, '') || '/'
  const parts = decoded.split('/').filter(Boolean)
  const locale = parts[0] === 'en' ? 'en' : 'es'
  if (parts[0] === 'es' || parts[0] === 'en') parts.shift()
  const path = parts.length ? `/${parts.join('/')}` : '/'
  if (path === '/') return { name: 'home', locale }
  if (path.startsWith('/categoria/')) {
    return { name: 'category', locale, slug: path.slice('/categoria/'.length) }
  }
  const shortcut = CATEGORY_PATHS[path.replace(/^\//, '').toLowerCase()]
  if (shortcut) return { name: 'category', locale, slug: shortcut }
  return { name: 'article', locale, slug: path.replace(/^\//, '') }
}
