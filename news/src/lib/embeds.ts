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

const tweetId = (url: string) => url.match(TWEET_RE)?.[1] || ''
const youtubeId = (url: string) => url.match(YOUTUBE_RE)?.[1] || ''

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

const twitterHtml = (url: string) =>
  `<blockquote class="twitter-tweet" data-dnt="true"><a href="${escapeAttr(url)}">${escapeAttr(url)}</a></blockquote>`

const youtubeHtml = (id: string) =>
  `<div class="yt-embed"><iframe src="https://www.youtube.com/embed/${escapeAttr(id)}" title="YouTube" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen loading="lazy"></iframe></div>`

const linkHtml = (url: string) =>
  `<p class="embed-link"><a href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer">${escapeAttr(url)}</a></p>`

export const embedHtmlForUrl = (raw: string) => {
  const url = cleanUrl(raw)
  if (tweetId(url)) return twitterHtml(url)
  const video = youtubeId(url)
  if (video) return youtubeHtml(video)
  return linkHtml(url)
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

/** Lyrics and classic posts store line breaks as newlines. The browser otherwise joins them into one paragraph. */
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

export const expandNewsEmbedsForEditor = (html: string) =>
  expandWpCaptions(String(html || '')).replace(EMBED_RE, (_match, url) => {
    const href = cleanUrl(url)
    return `<div class="na-embed" contenteditable="false" data-embed="${escapeAttr(href)}">${embedHtmlForUrl(href)}</div>`
  })

export const collapseNewsEmbeds = (html: string) =>
  String(html || '').replace(
    /<div class="na-embed"[^>]*data-embed="([^"]+)"[^>]*>[\s\S]*?<\/div>/gi,
    (_match, url) => `[embed]${String(url).replace(/&amp;/g, '&')}[/embed]`,
  )

export const loadTwitterEmbeds = (root?: ParentNode | null) => {
  if (typeof document === 'undefined') return
  const hasTweet = (root || document).querySelector?.('.twitter-tweet')
  if (!hasTweet) return
  const w = window as Window & { twttr?: { widgets?: { load: (el?: ParentNode) => void } } }
  if (w.twttr?.widgets?.load) {
    w.twttr.widgets.load(root || document.body)
    return
  }
  if (document.querySelector('script[data-twitter-wjs]')) return
  const script = document.createElement('script')
  script.src = 'https://platform.twitter.com/widgets.js'
  script.async = true
  script.dataset.twitterWjs = '1'
  script.onload = () => w.twttr?.widgets?.load(root || document.body)
  document.body.appendChild(script)
}
