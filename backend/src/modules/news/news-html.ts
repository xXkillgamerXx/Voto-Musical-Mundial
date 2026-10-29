const EMBED_RE = /\[embed\]\s*(https?:\/\/[^[\s<]+?)\s*\[\/embed\]/gi
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
    return `<div class="yt-embed"><iframe src="https://www.youtube.com/embed/${escapeAttr(video)}" title="YouTube" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen loading="lazy"></iframe></div>`
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

export const expandNewsEmbeds = (html: string) =>
  expandWpCaptions(String(html || '').replace(EMBED_RE, (_match, url) => embedHtmlForUrl(url)))

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
  return out.trim()
}

export const sanitizeNewsHtml = (html: string) =>
  String(html || '')
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
    .replace(/\son\w+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, '')
    .replace(/javascript:/gi, '');

export const plainExcerpt = (html: string, max = 220) => {
  const text = String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max).replace(/\s+\S*$/, '')}…`;
};
