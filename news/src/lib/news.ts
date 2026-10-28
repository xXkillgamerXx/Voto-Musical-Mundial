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
  authorUsername?: string
  authorHref?: string
  authorPhotoUrl?: string
  publishedAt?: string
  modifiedAt?: string
  href: string
  categories?: Array<{ slug: string; name: string }>
  tags?: Array<{ slug: string; name: string }>
  attachments?: Array<{ url: string; type?: string; name?: string }>
  commentCount?: number
  alternate?: { locale?: string; slug?: string; href?: string; id?: string } | null
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

export const largeNewsImage = (url?: string | null) => {
  const raw = String(url || '').trim()
  if (!raw) return raw
  return raw.replace(/-(?:scaled|[0-9]+x[0-9]+)(?=\.(?:jpe?g|png|webp|gif)(?:\?|#|$))/i, '')
}

export const coverOf = (post?: Partial<NewsCard> | null, fallback = '/images/jungkook-hero.jpg') =>
  largeNewsImage(post?.coverUrl) || fallback

export type NewsPage =
  | { name: 'home'; locale: 'es' | 'en' }
  | {
      name: 'admin'
      locale: 'es' | 'en'
      section?: 'dashboard' | 'posts' | 'categories' | 'post-form'
      postId?: string
      newsLocale?: 'es' | 'en'
    }
  | { name: 'profile'; locale: 'es' | 'en'; username?: string; edit?: boolean }
  | { name: 'categories'; locale: 'es' | 'en' }
  | { name: 'category'; locale: 'es' | 'en'; slug: string }
  | { name: 'article'; locale: 'es' | 'en'; slug: string }

export type CategoryCard = {
  href: string
  image: string
  title: string
  sub: string
  icon: string
  tone: string
}

export const CATEGORY_CARD_META: Record<string, { icon: string; tone: string; fallback: string }> = {
  noticias: { icon: 'news', tone: '1', fallback: '/images/stray-kids-grammy.jpg' },
  kpop: { icon: 'music', tone: '2', fallback: '/images/jungkook-hero.jpg' },
  peliculas: { icon: 'film', tone: '3', fallback: '/images/teach-you.jpg' },
  series: { icon: 'series', tone: '4', fallback: '/images/screen-euphoria.jpg' },
  celebridades: { icon: 'artist', tone: '2', fallback: '/images/jennie-tame.webp' },
  pop: { icon: 'note', tone: '1', fallback: '/images/jimin-tiktok.webp' },
  concierto: { icon: 'live', tone: '4', fallback: '/images/jungkook-peru.jpg' },
  viral: { icon: 'pop', tone: '3', fallback: '/images/katseye.jpg' },
  entrevista: { icon: 'mic', tone: '1', fallback: '/images/rm-museo.webp' },
  'redes-sociales': { icon: 'social', tone: '2', fallback: '/images/jimin-tiktok.webp' },
  latin: { icon: 'note', tone: '3', fallback: '/images/taylor-swift.jpg' },
  realeza: { icon: 'artist', tone: '4', fallback: '/images/jennie-tame.webp' },
}

export const toCategoryCard = (
  row: { slug: string; name: string; href?: string; coverUrl?: string | null; postCount?: number },
  index: number,
  locale: 'es' | 'en',
): CategoryCard => {
  const meta = CATEGORY_CARD_META[row.slug] || {
    icon: 'news',
    tone: String((index % 4) + 1),
    fallback: '/images/jungkook-hero.jpg',
  }
  return {
    href: row.href || (locale === 'es' ? `/es/categoria/${row.slug}` : `/categoria/${row.slug}`),
    image: row.coverUrl || meta.fallback,
    title: row.name,
    sub: `${Number(row.postCount || 0).toLocaleString(locale === 'en' ? 'en' : 'es')} ${t(locale, 'notesCount')}`,
    icon: meta.icon,
    tone: meta.tone,
  }
}

export const parseNewsPage = (pathname = window.location.pathname): NewsPage => {
  const decoded = decodeURIComponent(pathname).replace(/\/+$/, '') || '/'
  const parts = decoded.split('/').filter(Boolean)
  const locale = parts[0] === 'es' ? 'es' : 'en'
  if (parts[0] === 'es' || parts[0] === 'en') parts.shift()
  const path = parts.length ? `/${parts.join('/')}` : '/'
  if (path === '/') return { name: 'home', locale }
  if (path === '/admin') return { name: 'admin', locale, section: 'dashboard' }
  if (path === '/admin/noticias/nueva') return { name: 'admin', locale, section: 'post-form', newsLocale: 'es' }
  const editEn = path.match(/^\/admin\/noticias\/en\/(\d+)$/)
  if (editEn) return { name: 'admin', locale, section: 'post-form', postId: editEn[1], newsLocale: 'en' }
  const editNews = path.match(/^\/admin\/noticias\/(\d+)$/)
  if (editNews) return { name: 'admin', locale, section: 'post-form', postId: editNews[1], newsLocale: 'es' }
  if (path === '/admin/noticias') return { name: 'admin', locale, section: 'posts' }
  if (path === '/admin/categorias') return { name: 'admin', locale, section: 'categories' }
  if (path.startsWith('/admin/')) return { name: 'admin', locale, section: 'dashboard' }
  if (path === '/perfil/editar' || path === '/profile/edit') return { name: 'profile', locale, edit: true }
  if (path === '/perfil' || path === '/profile') return { name: 'profile', locale }
  const person = path.match(/^\/user\/([a-zA-Z0-9_]{3,32})$/)
  if (person) return { name: 'profile', locale, username: person[1].toLowerCase() }
  if (path === '/categorias' || path === '/categories') return { name: 'categories', locale }
  if (path.startsWith('/categoria/')) {
    return { name: 'category', locale, slug: path.slice('/categoria/'.length) }
  }
  const shortcut = CATEGORY_PATHS[path.replace(/^\//, '').toLowerCase()]
  if (shortcut) return { name: 'category', locale, slug: shortcut }
  return { name: 'article', locale, slug: path.replace(/^\//, '') }
}
