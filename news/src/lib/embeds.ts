const EMBED_RE = /\[embed(?:\s+[^\]]*)?\]\s*(https?:\/\/[^[\s<]+?)\s*\[\/embed\]/gi
const TWEET_RE = /(?:twitter|x)\.com\/(?:[^/\s]+\/status|i\/web\/status)\/(\d+)/i
const YOUTUBE_RE =
  /(?:youtube\.com\/(?:watch\?(?:[^#]*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/i

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
    .replace(/[),.;!?]+$/g, '')
    .replace(/\/$/, '')

const tweetId = (url: string) => url.match(TWEET_RE)?.[1] || ''
const youtubeId = (url: string) => url.match(YOUTUBE_RE)?.[1] || ''

export const youtubeVideoIds = (html: string) => {
  const re =
    /(?:youtube\.com\/(?:watch\?(?:[^#]*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/gi
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
  `<blockquote class="twitter-tweet" data-dnt="true" data-theme="dark"><a href="${escapeAttr(url)}">${escapeAttr(url)}</a></blockquote>`

const youtubeSrc = (id: string) =>
  `https://www.youtube.com/embed/${escapeAttr(id)}?rel=0&playsinline=1`

const youtubeWatchUrl = (id: string) => `https://www.youtube.com/watch?v=${escapeAttr(id)}`

const youtubeThumb = (id: string) => `https://i.ytimg.com/vi/${escapeAttr(id)}/hqdefault.jpg`

/** Facade: thumbnail always visible. JS hydrates to iframe (YouTube blocks embeds from 127.0.0.1). */
const youtubeFacade = (id: string) =>
  `<div class="yt-stage"><a class="yt-facade" href="${youtubeWatchUrl(id)}" target="_blank" rel="noopener noreferrer"><img src="${youtubeThumb(id)}" alt="YouTube" loading="lazy" decoding="async" /><span class="yt-play" aria-hidden="true"></span><span class="yt-facade-label">Ver en YouTube</span></a></div>`

const youtubeHtml = (id: string) =>
  `<div class="yt-embed" data-youtube-id="${escapeAttr(id)}">${youtubeFacade(id)}</div>`

const linkHtml = (url: string) =>
  `<p class="embed-link"><a href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer">${escapeAttr(url)}</a></p>`

export const isEmbeddableUrl = (raw: string) => {
  const url = cleanUrl(raw)
  return Boolean(
    tweetId(url) ||
      youtubeId(url) ||
      /tiktok\.com\//i.test(url) ||
      /instagram\.com\/(p|reel|tv)\//i.test(url) ||
      /open\.spotify\.com\//i.test(url),
  )
}

/** First embeddable http(s) URL in plain text (tolerates trailing newlines). */
export const firstEmbeddableUrl = (raw: string) => {
  const text = String(raw || '').trim()
  if (!text) return ''
  if (/^https?:\/\/\S+$/i.test(text) && isEmbeddableUrl(text)) return cleanUrl(text)
  const match = text.match(/https?:\/\/[^\s<>"']+/i)
  const url = match?.[0] || ''
  return url && isEmbeddableUrl(url) ? cleanUrl(url) : ''
}

/** Pull embed URL from pasted HTML (iframe src, blockquote cite, bare link). */
export const embedUrlFromHtml = (html: string) => {
  const raw = String(html || '')
  if (!raw.trim()) return ''
  const iframe = raw.match(/<iframe\b[^>]*\bsrc=["']([^"']+)["']/i)?.[1]
  if (iframe && isEmbeddableUrl(iframe)) return cleanUrl(iframe)
  const href = raw.match(/<a\b[^>]*\bhref=["'](https?:\/\/[^"']+)["']/i)?.[1]
  if (href && isEmbeddableUrl(href)) return cleanUrl(href)
  return firstEmbeddableUrl(raw.replace(/<[^>]+>/g, ' '))
}

const embedToolbar = (label: string) =>
  `<div class="na-media-toolbar" contenteditable="false"><button type="button" class="na-media-drag" draggable="true" title="Arrastrar para mover">⠿</button><span class="na-media-label">${label}</span><span class="na-media-actions"><button type="button" class="na-media-move-up" title="Subir">↑</button><button type="button" class="na-media-move-down" title="Bajar">↓</button><button type="button" class="na-media-remove" title="Quitar" aria-label="Quitar">×</button></span></div>`

export const editorEmbedHtml = (raw: string) => {
  const href = cleanUrl(raw)
  const video = youtubeId(href)
  if (video) {
    return `<div class="na-embed yt-embed na-media-block" contenteditable="false" data-embed="${escapeAttr(href)}" data-youtube-id="${escapeAttr(video)}">${embedToolbar('YouTube')}${youtubeFacade(video)}</div>`
  }
  if (tweetId(href)) {
    return `<div class="na-embed na-tweet-embed na-media-block" contenteditable="false" data-embed="${escapeAttr(href)}">${embedToolbar('Tweet')}${twitterHtml(href)}</div>`
  }
  const label = /tiktok\.com/i.test(href)
    ? 'TikTok'
    : /spotify\.com/i.test(href)
      ? 'Spotify'
      : /instagram\.com/i.test(href)
        ? 'Instagram'
        : 'Embed'
  return `<div class="na-embed na-media-block" contenteditable="false" data-embed="${escapeAttr(href)}">${embedToolbar(label)}<span class="na-embed-fallback"><b>${label}</b><small>${escapeAttr(href)}</small></span></div>`
}

const expandBareMedia = (html: string, editor = false) => {
  let next = String(html || '')
  // Naked URL paragraph.
  next = next.replace(/<p>\s*(https?:\/\/[^<\s]+)\s*<\/p>/gi, (match, url) => {
    if (!isEmbeddableUrl(url)) return match
    return editor ? editorEmbedHtml(url) : embedHtmlForUrl(url)
  })
  // Paragraph that only contains a link to an embeddable URL.
  next = next.replace(
    /<p>\s*<a\b[^>]*\bhref=["'](https?:\/\/[^"']+)["'][^>]*>[\s\S]*?<\/a>\s*<\/p>/gi,
    (match, href) => {
      if (!isEmbeddableUrl(href)) return match
      return editor ? editorEmbedHtml(href) : embedHtmlForUrl(href)
    },
  )
  return next
}

/** Replace outer <div class="…className…">…</div> blocks with nested-div-safe matching. */
const replaceDivsByClass = (
  html: string,
  className: string,
  replacer: (attrs: string, inner: string, full: string) => string,
) => {
  const source = String(html || '')
  const lower = source.toLowerCase()
  const needle = `\\b${className.toLowerCase()}\\b`
  const classRe = new RegExp(needle, 'i')
  let out = ''
  let i = 0
  while (i < source.length) {
    const openIdx = lower.indexOf('<div', i)
    if (openIdx === -1) {
      out += source.slice(i)
      break
    }
    out += source.slice(i, openIdx)
    const tagEnd = source.indexOf('>', openIdx)
    if (tagEnd === -1) {
      out += source.slice(openIdx)
      break
    }
    const openTag = source.slice(openIdx, tagEnd + 1)
    if (!classRe.test(openTag)) {
      out += openTag
      i = tagEnd + 1
      continue
    }
    let depth = 1
    let pos = tagEnd + 1
    let closed = false
    while (pos < source.length && depth > 0) {
      const nextOpen = lower.indexOf('<div', pos)
      const nextClose = lower.indexOf('</div>', pos)
      if (nextClose === -1) break
      if (nextOpen !== -1 && nextOpen < nextClose) {
        depth += 1
        pos = nextOpen + 4
        continue
      }
      depth -= 1
      if (depth === 0) {
        const inner = source.slice(tagEnd + 1, nextClose)
        const full = source.slice(openIdx, nextClose + 6)
        const attrs = openTag.replace(/^<div\b/i, '').replace(/>$/, '')
        out += replacer(attrs, inner, full)
        i = nextClose + 6
        closed = true
        break
      }
      pos = nextClose + 6
    }
    if (!closed) {
      out += source.slice(openIdx)
      break
    }
  }
  return out
}

const youtubeIdFromEmbedParts = (attrs: string, inner: string) => {
  const fromData = String(attrs.match(/\bdata-youtube-id=["']([^"']+)["']/i)?.[1] || '').trim()
  const fromEmbed = String(attrs.match(/\bdata-embed=["']([^"']+)["']/i)?.[1] || '')
    .replace(/&amp;/g, '&')
    .trim()
  const fromSrc = String(inner.match(/youtube\.com\/embed\/([\w-]{11})/i)?.[1] || '').trim()
  const fromWatch = youtubeId(fromEmbed) || youtubeId(String(inner.match(/https?:\/\/[^\s<"']+/i)?.[0] || ''))
  return fromData || fromSrc || fromWatch
}

/** Leftover editor placeholders → public embeds. */
const expandEditorPlaceholders = (html: string) =>
  replaceDivsByClass(html, 'na-embed', (attrs, inner, full) => {
    const fromData = String(attrs.match(/\bdata-embed=["']([^"']+)["']/i)?.[1] || '')
      .replace(/&amp;/g, '&')
      .trim()
    const fromIframe = String(inner.match(/<iframe\b[^>]*\bsrc=["']([^"']+)["']/i)?.[1] || '')
      .replace(/&amp;/g, '&')
      .trim()
    const fromHref = String(inner.match(/https?:\/\/[^\s<"']+/i)?.[0] || '').trim()
    const url = cleanUrl(fromData || fromIframe || fromHref)
    if (!url || !isEmbeddableUrl(url)) return full
    return embedHtmlForUrl(url)
  })

/** Old SSR/API iframes → facade (avoids YouTube Error 153 on 127.0.0.1). */
const normalizeYoutubeIframes = (html: string) =>
  replaceDivsByClass(html, 'yt-embed', (attrs, inner, full) => {
    if (/\byt-facade\b/i.test(inner) && /\bdata-youtube-id=/i.test(attrs) && !/\bna-embed\b/i.test(attrs)) {
      return full
    }
    const id = youtubeIdFromEmbedParts(attrs, inner)
    return id ? youtubeHtml(id) : full
  })

/** Keep a single block per YouTube id (drops broken leftovers from older nested-div bugs). */
const dedupeYoutubeEmbeds = (html: string) => {
  const seen = new Set<string>()
  return replaceDivsByClass(html, 'yt-embed', (attrs, inner, full) => {
    const id = youtubeIdFromEmbedParts(attrs, inner)
    if (!id) return full
    if (seen.has(id)) return ''
    seen.add(id)
    return full
  })
}

const expandIframesForEditor = (html: string) =>
  String(html || '').replace(/<iframe\b[^>]*\bsrc=["']([^"']+)["'][^>]*>\s*<\/iframe>/gi, (match, src) =>
    isEmbeddableUrl(src) ? editorEmbedHtml(src) : match,
  )

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
  preserveTextLineBreaks(
    dedupeYoutubeEmbeds(
      normalizeYoutubeIframes(
        expandBareMedia(
          expandEditorPlaceholders(
            expandWpCaptions(String(html || '').replace(EMBED_RE, (_match, url) => embedHtmlForUrl(url))),
          ),
        ),
      ),
    ),
  )

const holdEditorEmbeds = (html: string) => {
  const blocks: string[] = []
  const tokenized = replaceDivsByClass(html, 'na-embed', (_attrs, _inner, full) => {
    blocks.push(full)
    return `<!--vmm-embed-${blocks.length - 1}-->`
  })
  return { tokenized, blocks }
}

/** Rebuild editor chrome for na-embed + plain yt-embed so only one block with toolbar shows. */
const refreshEditorEmbedChrome = (html: string) => {
  let next = replaceDivsByClass(html, 'na-embed', (attrs, inner, full) => {
    const fromData = String(attrs.match(/\bdata-embed=["']([^"']+)["']/i)?.[1] || '')
      .replace(/&amp;/g, '&')
      .trim()
    const id = youtubeIdFromEmbedParts(attrs, inner)
    const fromHref = String(inner.match(/https?:\/\/[^\s<"']+/i)?.[0] || '')
      .replace(/&amp;/g, '&')
      .trim()
    const url = cleanUrl(fromData || (id ? youtubeWatchUrl(id) : fromHref))
    return url && isEmbeddableUrl(url) ? editorEmbedHtml(url) : full
  })
  next = replaceDivsByClass(next, 'yt-embed', (attrs, inner, full) => {
    if (/\bna-embed\b/i.test(attrs)) return full
    const id = youtubeIdFromEmbedParts(attrs, inner)
    return id ? editorEmbedHtml(youtubeWatchUrl(id)) : full
  })
  return dedupeYoutubeEmbeds(next)
}

export const expandNewsEmbedsForEditor = (html: string) => {
  const withShortcodes = expandWpCaptions(String(html || '')).replace(EMBED_RE, (_match, url) =>
    editorEmbedHtml(url),
  )
  const refreshed = refreshEditorEmbedChrome(withShortcodes)
  const held = holdEditorEmbeds(refreshed)
  const expanded = expandBareMedia(expandIframesForEditor(held.tokenized), true)
  return dedupeYoutubeEmbeds(
    expanded.replace(/<!--vmm-embed-(\d+)-->/g, (_match, index) => held.blocks[Number(index)] || ''),
  )
}

export const collapseNewsEmbeds = (html: string) => {
  let next = replaceDivsByClass(String(html || ''), 'na-embed', (attrs, inner) => {
    const fromData = String(attrs.match(/\bdata-embed=["']([^"']+)["']/i)?.[1] || '')
      .replace(/&amp;/g, '&')
      .trim()
    const fromIframe = String(inner.match(/<iframe\b[^>]*\bsrc=["']([^"']+)["']/i)?.[1] || '')
      .replace(/&amp;/g, '&')
      .trim()
    const id = youtubeIdFromEmbedParts(attrs, inner)
    const fromHref = String(
      inner.match(/https?:\/\/(?:twitter|x|youtube|youtu\.be|tiktok|instagram|spotify)[^\s<"']+/i)?.[0] || '',
    )
      .replace(/&amp;/g, '&')
      .trim()
    const url = cleanUrl(fromData || fromIframe || (id ? youtubeWatchUrl(id) : fromHref))
    return url ? `[embed]${url}[/embed]` : ''
  })
  next = replaceDivsByClass(next, 'yt-embed', (attrs, inner) => {
    const id = youtubeIdFromEmbedParts(attrs, inner)
    return id ? `[embed]${youtubeWatchUrl(id)}[/embed]` : ''
  })
  return next.replace(/<blockquote\b[^>]*\btwitter-tweet\b[^>]*>[\s\S]*?<\/blockquote>/gi, (block) => {
    const href = String(block.match(/https?:\/\/(?:twitter|x)\.com\/[^\s<"']+/i)?.[0] || '')
      .replace(/&amp;/g, '&')
      .trim()
    return href ? `[embed]${cleanUrl(href)}[/embed]` : ''
  })
}

const canInlineYoutube = () => {
  if (typeof window === 'undefined') return false
  const host = window.location.hostname
  // YouTube returns Error 153 / UNPLAYABLE when Referer is 127.0.0.1
  return host !== '127.0.0.1' && host !== '0.0.0.0'
}

/** Swap YouTube facades for real iframes when the host allows embedding. */
export const hydrateYoutubeEmbeds = (root?: ParentNode | null) => {
  if (typeof document === 'undefined') return
  const scope = (root || document) as ParentNode
  const nodes = scope.querySelectorAll?.('.yt-embed[data-youtube-id]')
  if (!nodes?.length) return
  const inline = canInlineYoutube()
  nodes.forEach((node) => {
    const el = node as HTMLElement
    if (el.dataset.ytReady === '1') return
    const id = String(el.dataset.youtubeId || '').trim()
    if (!/^[\w-]{11}$/.test(id)) return
    const facade = el.querySelector('.yt-facade') as HTMLAnchorElement | null
    if (!facade) return
    if (!inline) {
      el.dataset.ytReady = '1'
      return
    }
    facade.addEventListener(
      'click',
      (event) => {
        event.preventDefault()
        if (el.querySelector('iframe')) return
        const stage = el.querySelector('.yt-stage') || el
        const iframe = document.createElement('iframe')
        iframe.src = `${youtubeSrc(id)}&autoplay=1`
        iframe.title = 'YouTube'
        iframe.allow =
          'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share'
        iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin')
        iframe.allowFullscreen = true
        stage.replaceChildren(iframe)
        el.dataset.ytReady = '1'
      },
      { once: true },
    )
  })
}

export const loadTwitterEmbeds = (root?: ParentNode | null) => {
  if (typeof document === 'undefined') return
  const scope = root || document
  const hasTweet = (scope as ParentNode).querySelector?.('.twitter-tweet')
  if (!hasTweet) return
  const w = window as Window & {
    twttr?: {
      ready?: (cb: () => void) => void
      widgets?: { load: (el?: ParentNode) => void }
    }
  }
  const run = () => {
    try {
      w.twttr?.widgets?.load((root as ParentNode) || document.body)
    } catch {
      /* ignore */
    }
  }
  if (w.twttr?.widgets?.load) {
    if (typeof w.twttr.ready === 'function') w.twttr.ready(run)
    else run()
    return
  }
  const existing = document.querySelector('script[data-twitter-wjs]') as HTMLScriptElement | null
  if (existing) {
    const wait = () => {
      if (w.twttr?.widgets?.load) {
        if (typeof w.twttr.ready === 'function') w.twttr.ready(run)
        else run()
        return
      }
      window.setTimeout(wait, 120)
    }
    wait()
    return
  }
  const script = document.createElement('script')
  script.src = 'https://platform.twitter.com/widgets.js'
  script.async = true
  script.dataset.twitterWjs = '1'
  script.onload = () => {
    if (typeof w.twttr?.ready === 'function') w.twttr.ready(run)
    else run()
  }
  document.body.appendChild(script)
}
