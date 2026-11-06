/** Pretty-print HTML so the Texto editor is readable for news/page writing. */

const BLOCK = new Set([
  'address',
  'article',
  'aside',
  'blockquote',
  'div',
  'dl',
  'dt',
  'dd',
  'fieldset',
  'figcaption',
  'figure',
  'footer',
  'form',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'header',
  'hr',
  'li',
  'main',
  'nav',
  'ol',
  'p',
  'pre',
  'section',
  'table',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'td',
  'th',
  'ul',
])

const VOID = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
])

type Piece =
  | { kind: 'open' | 'close' | 'void'; name: string; raw: string }
  | { kind: 'text'; raw: string }

const piecesFrom = (html: string): Piece[] => {
  const out: Piece[] = []
  const re = /<!--[\s\S]*?-->|<\/?([a-zA-Z][\w:-]*)\b[^>]*\/?>|[^<]+/g
  let match: RegExpExecArray | null
  while ((match = re.exec(html))) {
    const raw = match[0]
    if (raw.startsWith('<!--') || !raw.startsWith('<')) {
      out.push({ kind: 'text', raw })
      continue
    }
    const name = String(match[1] || '').toLowerCase()
    if (raw.startsWith('</')) {
      out.push({ kind: 'close', name, raw })
      continue
    }
    if (VOID.has(name) || /\/\s*>$/.test(raw)) {
      out.push({ kind: 'void', name, raw })
      continue
    }
    out.push({ kind: 'open', name, raw })
  }
  return out
}

/** Keep label lines readable: insert <br> between consecutive bold labels in one paragraph. */
export const normalizeLabelBreaks = (input: string) =>
  String(input || '').replace(/(<\/(?:strong|b)>)\s*(<(?:strong|b)\b)/gi, '$1<br>$2')

/**
 * Writer-facing cleanup: bold label rows become real paragraphs so Visual
 * and the published post show proper spacing (no jammed "S.A.STax ID").
 */
export const normalizeEditorHtml = (input: string) => {
  let html = normalizeLabelBreaks(String(input || ''))
  html = html.replace(/<p(\s[^>]*)?>([\s\S]*?)<\/p>/gi, (full, attrs = '', inner) => {
    const strongCount = (inner.match(/<(?:strong|b)\b/gi) || []).length
    if (strongCount < 2 || !/<br\s*\/?>/i.test(inner)) return full
    const parts = inner
      .split(/<br\s*\/?>/i)
      .map((part) => part.trim())
      .filter(Boolean)
    if (parts.length < 2) return full
    const open = `<p${attrs || ''}>`
    return parts.map((part) => `${open}${part}</p>`).join('')
  })
  return html
}

export const formatHtmlForEdit = (input: string) => {
  const html = String(input || '').trim()
  if (!html) return ''

  const pieces = piecesFrom(html)
  const lines: string[] = []
  let depth = 0
  let inline = ''

  const pad = () => '  '.repeat(Math.max(depth, 0))
  const flushInline = () => {
    const text = inline.replace(/\s+/g, ' ').trim()
    inline = ''
    if (!text) return
    lines.push(`${pad()}${text}`)
  }

  for (const piece of pieces) {
    if (piece.kind === 'text') {
      inline += piece.raw
      continue
    }

    const block = BLOCK.has(piece.name) || piece.name === 'br'

    if (!block) {
      inline += piece.raw
      continue
    }

    flushInline()

    if (piece.kind === 'close') {
      depth = Math.max(depth - 1, 0)
      lines.push(`${pad()}${piece.raw}`)
      continue
    }

    if (piece.name === 'br') {
      lines.push(`${pad()}<br>`)
      continue
    }

    lines.push(`${pad()}${piece.raw}`)
    if (piece.kind === 'open') depth += 1
  }

  flushInline()
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}
