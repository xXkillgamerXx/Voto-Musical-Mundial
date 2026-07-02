import DOMPurify from 'dompurify'

const ALLOWED_TAGS = [
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'a',
  'ul',
  'ol',
  'li',
  'h1',
  'h2',
  'h3',
  'blockquote',
  'span',
]

const ALLOWED_ATTR = ['href', 'target', 'rel', 'class']

export const hasRichTextContent = (value) => {
  const text = String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return Boolean(text)
}

export const sanitizeHtml = (value) =>
  DOMPurify.sanitize(String(value || ''), {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
  })

export const richTextToHtml = (value) => {
  const raw = String(value || '').trim()
  if (!raw) {
    return ''
  }

  if (/<[a-z][\s\S]*>/i.test(raw)) {
    return sanitizeHtml(raw)
  }

  return sanitizeHtml(raw.replace(/\n/g, '<br>'))
}
