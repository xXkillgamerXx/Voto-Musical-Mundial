const asRecord = (value) =>
  value && typeof value === 'object' && !Array.isArray(value) ? value : {}

const pickText = (...candidates) => {
  for (const candidate of candidates) {
    const text = String(candidate || '').trim()
    if (text) {
      return text
    }
  }

  return ''
}

export const resolvePollLocale = (locale = 'es') =>
  String(locale || 'es').toLowerCase().startsWith('en') ? 'en' : 'es'

export const applyCategoryLocale = (category, locale = 'es') => {
  if (!category) {
    return category
  }

  if (typeof category === 'string') {
    return category
  }

  const metadata = asRecord(category.metadata)
  const nameEs = pickText(category.nameEs, category.name)
  const nameEn = pickText(category.nameEn, metadata.nameEn)
  const useEn = resolvePollLocale(locale) === 'en'

  return {
    ...category,
    nameEs,
    nameEn,
    name: useEn ? pickText(nameEn, nameEs) : nameEs,
  }
}

export const applyRoundLocale = (round, locale = 'es') => {
  if (!round) {
    return round
  }

  const config = asRecord(round.config)
  const metadata = asRecord(round.metadata)
  const titleEs = pickText(round.titleEs, round.title, config.title, metadata.title)
  const titleEn = pickText(round.titleEn, config.titleEn, metadata.titleEn)
  const useEn = resolvePollLocale(locale) === 'en'

  return {
    ...round,
    titleEs,
    titleEn,
    title: useEn ? pickText(titleEn, titleEs) : titleEs,
  }
}

export const applyArtistLocale = (artist, locale = 'es') => {
  if (!artist) {
    return artist
  }

  const metadata = asRecord(artist.metadata)
  const bioEs = pickText(artist.bioEs, artist.bio, metadata.bio)
  const bioEn = pickText(artist.bioEn, metadata.bioEn)
  const slugEs = pickText(artist.slugEs, artist.slug, metadata.slug)
  const slugEn = pickText(artist.slugEn, metadata.slugEn)
  const useEn = resolvePollLocale(locale) === 'en'

  return {
    ...artist,
    bioEs,
    bioEn,
    slugEs,
    slugEn,
    bio: useEn ? pickText(bioEn, bioEs) : bioEs,
    slug: useEn ? pickText(slugEn, slugEs, artist.id) : pickText(slugEs, slugEn, artist.id),
  }
}

export const resolveArtistSlug = (artist, locale = 'es') => {
  if (!artist) return ''
  const localized = applyArtistLocale(artist, locale)
  return pickText(localized.slug, artist.id)
}

export const artistUrl = (artist, locale = 'es') => {
  if (!artist) return resolvePollLocale(locale) === 'en' ? '/artists' : '/artistas'
  const slug = resolveArtistSlug(artist, locale)
  const prefix = resolvePollLocale(locale) === 'en' ? '/artist' : '/artista'
  return `${prefix}/${slug}`
}

export const withPollLocaleFields = (poll) => {
  if (!poll) {
    return poll
  }

  const config = asRecord(poll.config)
  const metadata = asRecord(poll.metadata)
  const category = typeof poll.category === 'object' && poll.category
    ? poll.category
    : null
  const categoryMeta = asRecord(category?.metadata)

  return {
    ...poll,
    titleEs: pickText(poll.titleEs, poll.title),
    descriptionEs: pickText(poll.descriptionEs, poll.description),
    bodyEs: pickText(poll.bodyEs, poll.body, config.body, metadata.body),
    titleEn: pickText(poll.titleEn, config.titleEn, metadata.titleEn),
    descriptionEn: pickText(poll.descriptionEn, config.descriptionEn, metadata.descriptionEn),
    bodyEn: pickText(poll.bodyEn, config.bodyEn, metadata.bodyEn),
    slugEs: pickText(poll.slugEs, poll.slug, config.slug),
    slugEn: pickText(poll.slugEn, config.slugEn, metadata.slugEn),
    categoryNameEs: pickText(
      poll.categoryNameEs,
      category?.name,
      poll.categoryName,
      typeof poll.category === 'string' ? poll.category : '',
      metadata.categoryName,
      metadata.category,
    ),
    categoryNameEn: pickText(
      poll.categoryNameEn,
      category?.nameEn,
      categoryMeta.nameEn,
      metadata.categoryNameEn,
    ),
  }
}

/** Slug según idioma (EN usa slugEn; si no hay, cae al ES / id). */
export const resolvePollSlug = (poll, locale = 'es') => {
  if (!poll) return ''
  const localized = withPollLocaleFields(poll)
  const useEn = resolvePollLocale(locale) === 'en'
  return useEn
    ? pickText(localized.slugEn, localized.slugEs, poll.id)
    : pickText(localized.slugEs, localized.slugEn, poll.id)
}

/** URL pública localizada: `/votacion|poll/{year}/{slug}`. */
export const pollUrl = (poll, locale = 'es') => {
  if (!poll) return resolvePollLocale(locale) === 'en' ? '/polls' : '/votaciones'
  const year =
    Number(poll.year) ||
    Number(asRecord(poll.config).year) ||
    Number(asRecord(poll.metadata).year) ||
    new Date().getFullYear()
  const slug = resolvePollSlug(poll, locale)
  const prefix = resolvePollLocale(locale) === 'en' ? '/poll' : '/votacion'
  return `${prefix}/${year}/${slug}`
}

export const applyPollLocale = (poll, locale = 'es') => {
  if (!poll) {
    return poll
  }

  const localized = withPollLocaleFields(poll)
  const useEn = resolvePollLocale(locale) === 'en'
  const categoryName = useEn
    ? pickText(localized.categoryNameEn, localized.categoryNameEs)
    : pickText(localized.categoryNameEs, localized.categoryName)
  const localizedCategory = typeof localized.category === 'object' && localized.category
    ? applyCategoryLocale(localized.category, locale)
    : localized.category

  return {
    ...localized,
    title: useEn
      ? pickText(localized.titleEn, localized.titleEs)
      : pickText(localized.titleEs, localized.title),
    description: useEn
      ? pickText(localized.descriptionEn, localized.descriptionEs)
      : pickText(localized.descriptionEs, localized.description),
    body: useEn
      ? pickText(localized.bodyEn, localized.bodyEs)
      : pickText(localized.bodyEs, localized.body),
    slug: useEn
      ? pickText(localized.slugEn, localized.slugEs, poll.id)
      : pickText(localized.slugEs, localized.slugEn, poll.id),
    categoryName,
    category: typeof localizedCategory === 'object' && localizedCategory
      ? localizedCategory
      : (categoryName || localized.category),
    rounds: Array.isArray(localized.rounds)
      ? localized.rounds.map((round) => applyRoundLocale(round, locale))
      : localized.rounds,
  }
}
