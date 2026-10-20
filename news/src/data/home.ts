export interface Story {
  category: string
  title: string
  image: string
  alt: string
  meta: string
  lead?: string
  href?: string
  tags?: string[]
}

const fillers = ['Noticias', 'Pop', 'Viral', 'Redes sociales', 'Celebridades', 'Música', 'En vivo', 'Charts']

export function storyTags(story: Story, total?: number): string[] {
  if (story.tags?.length) return story.tags.slice(0, total ?? story.tags.length)
  const tags: string[] = []
  const add = (value: string) => {
    const clean = value.trim()
    if (clean && !tags.includes(clean)) tags.push(clean)
  }

  add(story.category === 'Artistas' || story.category === 'ARMY' ? 'Celebridades' : story.category)
  const title = story.title.toLowerCase()
  if (/bts|jungkook|jimin|j-hope|\brm\b/.test(title)) add('K-POP')
  if (/viral|tiktok/.test(title)) add('Viral')
  if (/spotify|billboard|hot 100|récord|record|ranking/.test(title)) add('Charts')
  if (/netflix|serie|teach you/.test(title)) add('Series')
  if (/concierto|grammy|escenario/.test(title)) add('En vivo')
  if (/selfie|cumpleaños|tiktok|fans/.test(title)) add('Redes sociales')
  if (/taylor|katseye|jennie|tame/.test(title)) add('Pop')
  if (/méxico|presidenta|dona|cirug|hoshi/.test(title)) add('Noticias')

  const count = total ?? 2 + (story.title.length % 3)
  for (const filler of fillers) {
    if (tags.length >= count) break
    add(filler)
  }
  return tags.slice(0, count)
}

export const latest: Story[] = [
  {
    category: 'K-POP',
    title: 'Stray Kids se suma al boicot de BTS contra los Grammy',
    image: '/images/stray-kids-grammy.jpg',
    alt: 'Stray Kids en el escenario',
    meta: 'K-POP · 2 horas',
  },
  {
    category: 'BTS',
    title: 'Jungkook, V, Jimin y J-Hope comparten una selfie tras el concierto en Colombia',
    image: '/images/bts-colombia.jpg',
    alt: 'Jungkook, V, Jimin y J-Hope de BTS',
    meta: 'BTS · 4 horas',
  },
  {
    category: 'Pop',
    title: 'Taylor Swift bate récords en Spotify con la edición Encore de su último álbum',
    image: '/images/taylor-swift.jpg',
    alt: 'Taylor Swift',
    meta: 'Pop · Hoy',
  },
]

export const entertainment: Story[] = [
  {
    category: 'Música',
    title: 'Jennie y Tame Impala extienden su récord de K-pop con 18 semanas en el top 10 del Billboard Hot 100',
    image: '/images/jennie-tame.webp',
    alt: 'Jennie y Kevin Parker de Tame Impala',
    meta: 'Redacción · 15 oct 2026',
  },
  {
    category: 'K-POP',
    title: 'Presidenta de México sobre Stray Kids: «Son como BTS, pero más jóvenes»',
    image: '/images/stray-kids-mexico.webp',
    alt: 'Stray Kids junto a la presidenta de México',
    meta: 'Redacción · 15 oct 2026',
  },
  {
    category: 'Artistas',
    title: 'Jimin de BTS encabeza el ranking de reputación de marca de miembros de boy groups',
    image: '/images/jimin-reputacion.jpg',
    alt: 'Jimin de BTS en concierto',
    meta: 'Redacción · 15 oct 2026',
  },
  {
    category: 'Noticias',
    title: 'Hoshi de SEVENTEEN se somete a una cirugía de rodilla',
    image: '/images/hoshi.jpg',
    alt: 'Hoshi de SEVENTEEN',
    meta: 'Redacción · 15 oct 2026',
  },
]

export const kpopFeatures: Story[] = [
  {
    category: 'K-POP',
    title: 'Jungkook se vuelve viral en Colombia tras el concierto de BTS',
    image: '/images/jungkook-colombia.jpg',
    alt: 'Jungkook durante un concierto de BTS',
    meta: 'Redacción · 5 min',
  },
  {
    category: 'ARMY',
    title: 'Los fans celebraron el cumpleaños de Jungkook con proyectos caritativos en todo el mundo',
    image: '/images/jungkook-cumple.jpg',
    alt: 'Jungkook de BTS',
    meta: 'Redacción · 3 min',
  },
  {
    category: 'En vivo',
    title: 'Stray Kids se suma al boicot de BTS contra los Grammy',
    image: '/images/stray-kids-grammy.jpg',
    alt: 'Stray Kids en el escenario',
    meta: 'Redacción · 4 min',
  },
]

export const screenLead: Story = {
  category: 'Series',
  title: '«Teach You a Lesson»: el mayor fenómeno de Netflix desde «El juego del calamar»',
  image: '/images/teach-you.jpg',
  alt: 'Protagonistas de Teach You a Lesson',
  meta: 'julio 30, 2026',
}

export const screenSide: Story[] = [
  {
    category: 'Series',
    title: '6 razones por las que THE WONDERfools es la serie más popular de Netflix con Cha Eunwoo',
    image: '/images/screen-wonder.jpg',
    alt: 'Elenco de The Wonderfools',
    meta: 'mayo 31, 2026',
  },
  {
    category: 'Series',
    title: 'HBO desata el caos tras dar una pista sobre una posible 4ta temporada de Euphoria',
    image: '/images/screen-euphoria.jpg',
    alt: 'Protagonistas de Euphoria',
    meta: 'mayo 27, 2026',
  },
  {
    category: 'Series',
    title: 'Sydney Sweeney no está satisfecha con el final de Cassie en la 3era temporada de Euphoria',
    image: '/images/screen-sweeney.jpg',
    alt: 'Sydney Sweeney',
    meta: 'mayo 12, 2026',
  },
  {
    category: 'Series',
    title: 'Erin Moriarty de The Boys critica la película de Michael Jackson por omitir acusaciones de abuso',
    image: '/images/screen-boys.jpg',
    alt: 'Erin Moriarty y Michael Jackson',
    meta: 'mayo 12, 2026',
  },
]

export const kpopMore: Story[] = [
  {
    category: 'K-POP',
    title: 'Jimin encabeza el ranking de reputación de marca',
    image: '/images/jimin-reputacion.jpg',
    alt: 'Jimin en el escenario',
    meta: '19 de septiembre, 2026',
  },
  {
    category: 'K-POP',
    title: 'Hoshi de SEVENTEEN se somete a una cirugía de rodilla',
    image: '/images/hoshi.jpg',
    alt: 'Hoshi de SEVENTEEN',
    meta: '19 de septiembre, 2026',
  },
  {
    category: 'Música',
    title: 'Jennie y Tame Impala suman 18 semanas en el top 10 del Billboard Hot 100',
    image: '/images/jennie-tame.webp',
    alt: 'Jennie y Tame Impala',
    meta: '19 de septiembre, 2026',
  },
]

export const moreNews: Story[] = [
  {
    category: 'K-POP',
    title: 'KATSEYE estrena «Unloveu» sin Manon ni Sophia y los fans se preguntan si es el fin del sexteto',
    image: '/images/katseye.jpg',
    alt: 'Integrantes de KATSEYE',
    meta: '14 oct 2026 · Redacción',
    lead: 'El estreno abrió el debate entre los fans sobre el futuro del grupo y el rumbo de su nueva etapa.',
  },
  {
    category: 'BTS',
    title: 'Jungkook enloquece al ARMY con el concierto de BTS en Perú',
    image: '/images/jungkook-peru.jpg',
    alt: 'Jungkook en el concierto de BTS en Perú',
    meta: '11 oct 2026 · Redacción',
    lead: 'El idol se volvió tendencia mundial tras su aparición en el escenario del concierto en Perú.',
  },
  {
    category: 'K-POP',
    title: 'Stray Kids se suma al boicot de BTS contra los Grammy',
    image: '/images/stray-kids-grammy.jpg',
    alt: 'Stray Kids en concierto',
    meta: '11 oct 2026 · Redacción',
    lead: 'El grupo expresó su apoyo al ARMY y generó un gran debate en la industria musical.',
  },
  {
    category: 'BTS',
    title: 'Jungkook, V, Jimin y J-Hope comparten una selfie tras el histórico concierto en Colombia',
    image: '/images/bts-colombia.jpg',
    alt: 'Selfie de Jungkook, V, Jimin y J-Hope',
    meta: '4 oct 2026 · Redacción',
    lead: 'Jungkook, V, Jimin y J-Hope compartieron una selfie tras el concierto de BTS en Colombia.',
  },
  {
    category: 'Pop',
    title: 'Taylor Swift bate récords en Spotify tras el lanzamiento de la edición Encore',
    image: '/images/taylor-swift.jpg',
    alt: 'Taylor Swift',
    meta: '4 oct 2026 · Redacción',
    lead: 'La edición Encore de su último álbum batió récords de reproducción en Spotify.',
  },
  {
    category: 'Música',
    title: 'Jennie y Tame Impala suman 18 semanas en el top 10 del Billboard Hot 100',
    image: '/images/jennie-tame.webp',
    alt: 'Jennie y Tame Impala',
    meta: '5 oct 2026 · Redacción',
    lead: 'El tema con Tame Impala sigue dentro del top 10 del Billboard Hot 100.',
  },
  {
    category: 'K-POP',
    title: 'Hoshi de SEVENTEEN se somete a una cirugía de rodilla',
    image: '/images/hoshi.jpg',
    alt: 'Hoshi de SEVENTEEN',
    meta: '19 sep 2026 · Redacción',
    lead: 'El integrante de SEVENTEEN se somete a una cirugía de rodilla.',
  },
  {
    category: 'BTS',
    title: 'Jimin de BTS finalmente publica su primer TikTok',
    image: '/images/jimin-tiktok.webp',
    alt: 'Jimin de BTS',
    meta: '3 oct 2026 · Redacción',
    lead: 'El idol publicó su primer TikTok y la publicación se volvió tendencia entre el ARMY.',
  },
]

export const mostRead: Story[] = [
  {
    category: 'BTS',
    title: 'RM dona 100 millones de wones al Museo Nacional de Corea',
    image: '/images/rm-museo.webp',
    alt: 'RM de BTS',
    meta: 'Redacción · 3 min',
  },
  {
    category: 'BTS',
    title: 'Jimin finalmente publica su primer TikTok',
    image: '/images/jimin-tiktok.webp',
    alt: 'Jimin de BTS',
    meta: 'Redacción · 2 min',
  },
  {
    category: 'K-POP',
    title: 'Jimin encabeza el ranking de reputación de marca',
    image: '/images/jimin-reputacion.jpg',
    alt: 'Jimin en el escenario',
    meta: 'Redacción · 3 min',
  },
  {
    category: 'K-POP',
    title: 'Stray Kids, «como BTS, pero más jóvenes», dice la presidenta de México',
    image: '/images/stray-kids-mexico.webp',
    alt: 'Stray Kids en un acto oficial',
    meta: 'Redacción · 4 min',
  },
  {
    category: 'Series',
    title: '«Teach You a Lesson» se convierte en el fenómeno de Netflix',
    image: '/images/teach-you.jpg',
    alt: 'Protagonistas de Teach You a Lesson',
    meta: 'Redacción · 3 min',
  },
]

export const socialNews: Story[] = [
  {
    category: 'Redes sociales',
    title: 'KATSEYE estrena «Unloveu» sin Manon ni Sophia y los fans se preguntan si es el fin del sexteto',
    image: '/images/katseye.jpg',
    alt: 'Integrantes de KATSEYE',
    meta: 'octubre 14, 2026 · 6 min',
  },
  {
    category: 'Redes sociales',
    title: 'Jimin de BTS finalmente publica su primer TikTok',
    image: '/images/jimin-tiktok.webp',
    alt: 'Jimin de BTS',
    meta: 'octubre 3, 2026 · 2 min',
  },
  {
    category: 'Redes sociales',
    title: 'Jungkook, V, Jimin y J-Hope comparten una selfie tras el concierto en Colombia',
    image: '/images/bts-colombia.jpg',
    alt: 'Selfie de Jungkook, V, Jimin y J-Hope',
    meta: 'octubre 4, 2026 · 3 min',
  },
  {
    category: 'Redes sociales',
    title: 'Los fans celebraron el cumpleaños de Jungkook con proyectos caritativos',
    image: '/images/jungkook-cumple.jpg',
    alt: 'Jungkook de BTS',
    meta: 'octubre 15, 2026 · 4 min',
  },
]

export const interviews: Story[] = [
  {
    category: 'Entrevistas',
    title: 'RM de BTS dona 100 millones de wones al Museo Nacional de Corea',
    image: '/images/rm-museo.webp',
    alt: 'RM de BTS',
    meta: 'octubre 15, 2026 · 5 min',
  },
  {
    category: 'Entrevistas',
    title: 'Presidenta de México sobre Stray Kids: «Son como BTS, pero más jóvenes»',
    image: '/images/stray-kids-mexico.webp',
    alt: 'Stray Kids junto a la presidenta de México',
    meta: 'octubre 7, 2026 · 4 min',
  },
  {
    category: 'Entrevistas',
    title: 'Jennie y Tame Impala suman 18 semanas en el top 10 del Billboard Hot 100',
    image: '/images/jennie-tame.webp',
    alt: 'Jennie y Tame Impala',
    meta: 'octubre 5, 2026 · 3 min',
  },
  {
    category: 'Entrevistas',
    title: 'Hoshi de SEVENTEEN se somete a una cirugía de rodilla',
    image: '/images/hoshi.jpg',
    alt: 'Hoshi de SEVENTEEN',
    meta: 'septiembre 19, 2026 · 2 min',
  },
]

export const celebrities: Story[] = [
  {
    category: 'Celebridades',
    title: 'Los fans celebraron el cumpleaños de Jungkook con proyectos caritativos',
    image: '/images/jungkook-cumple.jpg',
    alt: 'Jungkook de BTS',
    meta: 'Redacción · 15 oct 2026',
  },
  {
    category: 'BTS',
    title: 'Jimin de BTS finalmente publica su primer TikTok',
    image: '/images/jimin-tiktok.webp',
    alt: 'Jimin de BTS saludando',
    meta: 'Redacción · 15 oct 2026',
  },
  {
    category: 'BTS',
    title: 'RM de BTS dona 100 millones de wones al Museo Nacional de Corea',
    image: '/images/rm-museo.webp',
    alt: 'RM de BTS',
    meta: 'Redacción · 15 oct 2026',
  },
  {
    category: 'Pop',
    title: 'Taylor Swift bate récords en Spotify con la edición Encore',
    image: '/images/taylor-swift.jpg',
    alt: 'Taylor Swift',
    meta: 'Redacción · 15 oct 2026',
  },
]

export const popBoard: Story[] = [
  {
    category: 'Pop',
    title: 'Taylor Swift bate récords en Spotify tras el lanzamiento de la edición Encore',
    image: '/images/taylor-swift.jpg',
    alt: 'Taylor Swift',
    meta: 'Redacción · 15 oct 2026',
  },
  {
    category: 'K-POP',
    title: 'KATSEYE estrena «Unloveu» sin Manon ni Sophia y los fans se preguntan si es el fin del sexteto',
    image: '/images/katseye.jpg',
    alt: 'Integrantes de KATSEYE',
    meta: 'Redacción · 14 oct 2026',
  },
  {
    category: 'Series',
    title: '«Teach You a Lesson», el mayor fenómeno de Netflix desde «El juego del calamar»',
    image: '/images/teach-you.jpg',
    alt: 'Escena de la serie Teach You a Lesson',
    meta: 'Redacción · 15 oct 2026',
  },
  {
    category: 'Música',
    title: 'Jennie y Tame Impala siguen dentro del top 10 del Hot 100',
    image: '/images/jennie-tame.webp',
    alt: 'Jennie y Tame Impala',
    meta: 'Redacción · 15 oct 2026',
  },
  {
    category: 'En vivo',
    title: 'Stray Kids se suma al boicot de BTS contra los Grammy',
    image: '/images/stray-kids-grammy.jpg',
    alt: 'Stray Kids en concierto',
    meta: 'Redacción · 15 oct 2026',
  },
  {
    category: 'BTS',
    title: 'Jimin de BTS finalmente publica su primer TikTok',
    image: '/images/jimin-tiktok.webp',
    alt: 'Jimin de BTS',
    meta: 'Redacción · 15 oct 2026',
  },
]
