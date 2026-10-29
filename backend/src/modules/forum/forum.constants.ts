export const FORUM_ICONS = ['note', 'music', 'artist', 'mic', 'pop', 'news', 'film', 'series', 'live', 'social'] as const;

export const FORUM_RESERVED_SLUGS = new Set(['all', 'new', 'admin', 'search']);

export const FORUM_CATEGORY_SEED = [
  {
    slug: 'pop',
    nameEs: 'POP',
    nameEn: 'POP',
    blurbEs: 'Pop, artistas y las últimas novedades.',
    blurbEn: 'Pop music, artists and the latest updates.',
    icon: 'note',
    sortOrder: 1,
    isVip: false,
  },
  {
    slug: 'kpop',
    nameEs: 'KPOP',
    nameEn: 'KPOP',
    blurbEs: 'Grupos, comebacks y fandom.',
    blurbEn: 'K-pop groups, comebacks and fandom.',
    icon: 'music',
    sortOrder: 2,
    isVip: false,
  },
  {
    slug: 'hall-of-fame',
    nameEs: 'HALL OF FAME',
    nameEn: 'HALL OF FAME',
    blurbEs: 'Leyendas y los momentos que no se olvidan.',
    blurbEn: 'Celebrate the legends and unforgettable moments.',
    icon: 'artist',
    sortOrder: 3,
    isVip: false,
  },
  {
    slug: 'vip',
    nameEs: 'VIP & PREMIUM',
    nameEn: 'VIP & PREMIUM',
    blurbEs: 'Espacio exclusivo para miembros FAN.',
    blurbEn: 'Exclusive space for FAN members.',
    icon: 'mic',
    sortOrder: 4,
    isVip: true,
  },
  {
    slug: 'spaces',
    nameEs: 'SPACES',
    nameEn: 'SPACES',
    blurbEs: 'Clubs de fans y espacios de cada fandom.',
    blurbEn: 'Fan clubs and a space for every fandom.',
    icon: 'pop',
    sortOrder: 5,
    isVip: false,
  },
] as const;
