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

export const withPollLocaleFields = (poll) => {
  if (!poll) {
    return poll
  }

  const config = asRecord(poll.config)
  const metadata = asRecord(poll.metadata)

  return {
    ...poll,
    titleEs: pickText(poll.titleEs, poll.title),
    descriptionEs: pickText(poll.descriptionEs, poll.description),
    bodyEs: pickText(poll.bodyEs, poll.body, config.body, metadata.body),
    titleEn: pickText(poll.titleEn, config.titleEn, metadata.titleEn),
    descriptionEn: pickText(poll.descriptionEn, config.descriptionEn, metadata.descriptionEn),
    bodyEn: pickText(poll.bodyEn, config.bodyEn, metadata.bodyEn),
  }
}

export const applyPollLocale = (poll, locale = 'es') => {
  if (!poll) {
    return poll
  }

  const localized = withPollLocaleFields(poll)
  const useEn = resolvePollLocale(locale) === 'en'

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
  }
}
