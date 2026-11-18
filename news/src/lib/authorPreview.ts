export type AuthorPreview = {
  authorId: string
  authorName: string
  authorSlug?: string
  linkedUserId: string
  locale: 'es' | 'en'
  accountLabel?: string
}

const KEY = 'nmm-author-preview'

export const readAuthorPreview = (): AuthorPreview | null => {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as AuthorPreview
    if (!parsed?.authorId || !parsed?.authorName) return null
    return parsed
  } catch {
    return null
  }
}

export const writeAuthorPreview = (preview: AuthorPreview) => {
  sessionStorage.setItem(KEY, JSON.stringify(preview))
}

export const clearAuthorPreview = () => {
  sessionStorage.removeItem(KEY)
}
