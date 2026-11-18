const EMBED_RE = /\[embed(?:\s+[^\]]*)?\]\s*(https?:\/\/[^[\s<]+?)\s*\[\/embed\]/gi
const TWEET_RE = /(?:twitter|x)\.com\/(?:[^/\s]+\/status|i\/web\/status)\/(\d+)/i
const YOUTUBE_RE =
  /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/i

const escapeAttr = (value: string) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

const cleanUrl = (value: string) =>
  String(value || '')
    .trim()
    .replace(/&amp;/g, '&')
    .replace(/\/$/, '')

const embedHtmlForUrl = (raw: string) => {
  const url = cleanUrl(raw)
  if (TWEET_RE.test(url)) {
    return `<blockquote class="twitter-tweet" data-dnt="true"><a href="${escapeAttr(url)}">${escapeAttr(url)}</a></blockquote>`
  }
  const video = url.match(YOUTUBE_RE)?.[1]
  if (video) {
    return `<div class="yt-embed" data-youtube-id="${escapeAttr(video)}"><div class="yt-stage"><a class="yt-facade" href="https://www.youtube.com/watch?v=${escapeAttr(video)}" target="_blank" rel="noopener noreferrer"><img src="https://i.ytimg.com/vi/${escapeAttr(video)}/hqdefault.jpg" alt="YouTube" loading="lazy" decoding="async" /><span class="yt-play" aria-hidden="true"></span><span class="yt-facade-label">Ver en YouTube</span></a></div></div>`
  }
  return `<p class="embed-link"><a href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer">${escapeAttr(url)}</a></p>`
}

export const expandWpCaptions = (html: string) =>
  String(html || '').replace(/\[caption[^\]]*\]([\s\S]*?)\[\/caption\]/gi, (_match, inner) => {
    const block = String(inner || '')
    const img = block.match(/<img[\s\S]*?>/i)?.[0] || ''
    const caption = block
      .replace(/<img[\s\S]*?>/i, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (!img) return block
    return `<figure class="wp-block-image">${img}${caption ? `<figcaption>${caption}</figcaption>` : ''}</figure>`
  })

/** Lyrics and classic WordPress posts keep real line breaks as newlines. HTML collapses those into one paragraph. */
export const preserveTextLineBreaks = (html: string) => {
  const parts = String(html || '').split(/(<[^>]+>)/g)
  let skip = 0
  return parts
    .map((part) => {
      if (part.startsWith('<')) {
        if (/^<(pre|script|style|textarea|iframe)\b/i.test(part)) skip += 1
        if (/^<\/(pre|script|style|textarea|iframe)>/i.test(part)) skip = Math.max(0, skip - 1)
        return part
      }
      if (skip || !part.trim() || !/[\r\n]/.test(part)) return part
      return part
        .replace(/\r\n|\r|\n/g, '<br>')
        .replace(/^(?:\s*<br>)+/g, '')
        .replace(/(?:<br>\s*)+$/g, '')
    })
    .join('')
}

export const expandNewsEmbeds = (html: string) =>
  preserveTextLineBreaks(expandWpCaptions(String(html || '').replace(EMBED_RE, (_match, url) => embedHtmlForUrl(url))))

export const youtubeVideoIds = (html: string) => {
  const re = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/gi
  const ids: string[] = []
  const seen = new Set<string>()
  for (const match of String(html || '').matchAll(re)) {
    const id = String(match[1] || '').trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    ids.push(id)
  }
  return ids
}

export const firstYoutubeEmbed = (html: string) => {
  const id = youtubeVideoIds(html)[0]
  return id ? `https://www.youtube.com/embed/${id}` : ''
}

export const rssBodyHtml = (html: string) => {
  let out = expandNewsEmbeds(String(html || ''))
  out = out.replace(
    /(?<!["'=])https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?[^\s<]+|youtu\.be\/[\w-]+[^\s<]*)/gi,
    (url) => embedHtmlForUrl(url),
  )
  out = sanitizeNewsHtml(out).replace(/<!--\s*\/?wp:[\s\S]*?-->/g, '')
  if (!/<p[\s>]/i.test(out)) {
    out = out
      .split(/\n{2,}/)
      .map((block) => block.trim())
      .filter(Boolean)
      .map((block) =>
        /^<(p|h[1-6]|ul|ol|li|div|blockquote|figure|iframe|table|img)\b/i.test(block)
          ? block
          : `<p>${block.replace(/\n/g, '<br />\n')}</p>`,
      )
      .join('\n')
  }
  return ensureImageLayout(out.trim())
}

export const sanitizeNewsHtml = (html: string) =>
  String(html || '')
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
    .replace(/\son\w+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, '')
    .replace(/javascript:/gi, '');

/** Fill empty/missing img alt with the article title for SEO. */
export const ensureImageAlts = (html: string, title: string) => {
  const alt = escapeAttr(String(title || '').trim())
  if (!alt) return String(html || '')
  return String(html || '').replace(/<img\b([^>]*)>/gi, (tag, rawAttrs = '') => {
    const attrs = String(rawAttrs)
    const altMatch = attrs.match(/\salt\s*=\s*(["'])(.*?)\1/i)
    if (altMatch && String(altMatch[2] || '').trim()) return tag
    const cleaned = attrs
      .replace(/\salt\s*=\s*(["']).*?\1/i, '')
      .replace(/\salt\s*=\s*[^\s/>]+/i, '')
      .replace(/\/\s*$/, '')
      .replace(/\s+/g, ' ')
      .trim()
    return `<img${cleaned ? ` ${cleaned}` : ''} alt="${alt}">`
  })
}

const sizeFromSrc = (src: string) => {
  const match = String(src || '').match(/-(\d{2,5})x(\d{2,5})(?=\.(?:jpe?g|png|webp|gif)(?:\?|#|$))/i)
  if (!match) return null
  const width = Number(match[1])
  const height = Number(match[2])
  if (!width || !height) return null
  return { width, height }
}

const hasAttr = (attrs: string, name: string) =>
  new RegExp(`\\s${name}\\s*=`, 'i').test(attrs)

/** Reserve layout for body images (CLS) and lazy-load below the fold. */
export const ensureImageLayout = (html: string) => {
  let index = 0
  return String(html || '').replace(/<img\b([^>]*)>/gi, (_tag, rawAttrs = '') => {
    index += 1
    let attrs = String(rawAttrs)
    const src =
      attrs.match(/\ssrc\s*=\s*(["'])(.*?)\1/i)?.[2] ||
      attrs.match(/\ssrc\s*=\s*([^\s>]+)/i)?.[1] ||
      ''
    const sized = sizeFromSrc(src)
    if (!hasAttr(attrs, 'width') || !hasAttr(attrs, 'height')) {
      const width = sized?.width || 1600
      const height = sized?.height || 900
      if (!hasAttr(attrs, 'width')) attrs += ` width="${width}"`
      if (!hasAttr(attrs, 'height')) attrs += ` height="${height}"`
    }
    if (!hasAttr(attrs, 'decoding')) attrs += ' decoding="async"'
    if (index > 1 && !hasAttr(attrs, 'loading')) attrs += ' loading="lazy"'
    if (index === 1 && !hasAttr(attrs, 'fetchpriority')) attrs += ' fetchpriority="high"'
    return `<img${attrs.replace(/\s+/g, ' ').trim() ? ` ${attrs.replace(/\s+/g, ' ').trim()}` : ''}>`
  })
}

export const plainExcerpt = (html: string, max = 220) => {
  const text = String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max).replace(/\s+\S*$/, '')}…`;
};
