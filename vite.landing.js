import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
export const newsRoot = path.resolve(here, 'news')
const newsPublic = path.join(newsRoot, 'public')

const MIME = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.mp4': 'video/mp4',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
  '.xml': 'application/xml; charset=utf-8',
  '.xsl': 'application/xml; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

const toFsUrl = (filePath, base) => {
  const posix = filePath.replace(/\\/g, '/')
  const prefix = String(base || '/').replace(/\/+$/, '')
  return `${prefix}/@fs/${posix}`
}

const isVoteRoute = (urlPath) =>
  urlPath === '/vote' || urlPath.startsWith('/vote/')

const isVoteBackend = (urlPath) =>
  urlPath.startsWith('/api')
  || urlPath.startsWith('/socket.io')
  || urlPath.startsWith('/uploads')

const isViteInternal = (urlPath) =>
  urlPath.startsWith('/@') || urlPath.startsWith('/node_modules')

const RESERVED_SLUGS = new Set([
  'admin',
  'perfil',
  'profile',
  'user',
  'categorias',
  'categories',
  'categoria',
  'vote',
  'api',
  'uploads',
  'images',
  'assets',
  'kpop',
  'k-pop',
  'noticias',
  'viral',
  'pop',
  'series',
  'celebridades',
  'entretenimiento',
  'peliculas',
  'k-drama',
  'es',
  'en',
  'feed',
  'author',
  'forum',
  'foro',
])

const articleShareTarget = (urlPath) => {
  const parts = String(urlPath || '/').split('/').filter(Boolean)
  if (!parts.length || path.extname(urlPath || '')) return null
  const locale = parts[0] === 'es' ? 'es' : 'en'
  if (parts[0] === 'es' || parts[0] === 'en') parts.shift()
  if (parts.length !== 1 || RESERVED_SLUGS.has(parts[0])) return null
  return { locale, slug: parts[0] }
}

const proxyNewsShare = (target, req, res, pathOverride = '', onMiss) => {
  const upstream = http.request(
    {
      hostname: '127.0.0.1',
      port: 4000,
      path: pathOverride || `/api/news/share/${encodeURIComponent(target.slug)}?locale=${target.locale}`,
      method: 'GET',
      headers: {
        accept: 'text/html',
        'user-agent': String(req.headers['user-agent'] || ''),
        host: String(req.headers.host || '127.0.0.1:5174'),
        'x-forwarded-proto': 'http',
      },
    },
    (upstreamRes) => {
      if (onMiss && (upstreamRes.statusCode === 404 || upstreamRes.statusCode === 204)) {
        upstreamRes.resume()
        onMiss()
        return
      }
      res.statusCode = upstreamRes.statusCode || 200
      const type = upstreamRes.headers['content-type'] || 'text/html; charset=utf-8'
      res.setHeader('Content-Type', type)
      upstreamRes.pipe(res)
    },
  )
  upstream.on('error', () => {
    if (onMiss) {
      onMiss()
      return
    }
    res.statusCode = 502
    res.end('News share unavailable')
  })
  upstream.end()
}

const serveNewsHtml = (res, base) => {
  const htmlPath = path.join(newsRoot, 'index.html')
  if (!fs.existsSync(htmlPath)) {
    res.statusCode = 404
    res.end('No se encontro news/index.html')
    return
  }
  const client = `${String(base).replace(/\/+$/, '')}/@vite/client`
  const main = toFsUrl(path.join(newsRoot, 'src/main.ts'), base)
  const html = fs.readFileSync(htmlPath, 'utf8').replace(
    '<script type="module" src="/src/main.ts"></script>',
    `<script type="module" src="${client}"></script>\n    <script type="module" src="${main}"></script>`,
  )
  res.statusCode = 200
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.end(html)
}

const proxyLegacyRoot = (slug, req, res, onMiss) => {
  const upstream = http.request(
    {
      hostname: '127.0.0.1',
      port: 4000,
      path: `/api/news/legacy-root/${encodeURIComponent(slug)}`,
      method: 'GET',
      headers: {
        host: String(req.headers.host || '127.0.0.1:5174'),
      },
    },
    (upstreamRes) => {
      const loc = String(upstreamRes.headers.location || '')
      if (upstreamRes.statusCode === 301 && loc) {
        res.statusCode = 301
        res.setHeader('Location', loc)
        res.end()
        return
      }
      onMiss()
    },
  )
  upstream.on('error', () => onMiss())
  upstream.end()
}

export const musicMundialLandingPlugin = () => ({
  name: 'musicmundial-landing',
  configureServer(server) {
    const base = server.config.base || '/'

    server.middlewares.use((req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        next()
        return
      }

      const urlPath = decodeURIComponent(String(req.url || '/').split('?')[0] || '/')
      if (isVoteRoute(urlPath) || isVoteBackend(urlPath) || isViteInternal(urlPath)) {
        next()
        return
      }

      const qs = String(req.url || '').includes('?') ? `?${String(req.url).split('?').slice(1).join('?')}` : ''
      if (urlPath === '/en' || urlPath === '/en/') {
        res.statusCode = 301
        res.setHeader('Location', `/${qs}`)
        res.end()
        return
      }
      if (urlPath.startsWith('/en/') && !path.extname(urlPath)) {
        res.statusCode = 301
        res.setHeader('Location', `${urlPath.slice(3) || '/'}${qs}`)
        res.end()
        return
      }

      const sitemapRedirect = (() => {
        const enOld = urlPath.match(/^\/sitemap-en-(\d+)\.xml$/)
        if (enOld) return `/sitemap-${enOld[1]}.xml`
        const esOld = urlPath.match(/^\/sitemap-es-(\d+)\.xml$/)
        if (esOld) return `/es/sitemap-${esOld[1]}.xml`
        const postRoot = urlPath.match(/^\/(?:en\/)?post-sitemap(\d+)\.xml$/)
        if (postRoot) return `/sitemap-${postRoot[1]}.xml`
        const postEs = urlPath.match(/^\/es\/post-sitemap(\d+)\.xml$/)
        if (postEs) return `/es/sitemap-${postEs[1]}.xml`
        return ''
      })()
      if (sitemapRedirect) {
        res.statusCode = 301
        res.setHeader('Location', `${sitemapRedirect}${qs}`)
        res.end()
        return
      }

      const sitemapPath = (() => {
        if (urlPath === '/feed' || urlPath === '/feed/' || urlPath === '/rss.xml') return '/api/news/feed'
        if (urlPath === '/en/feed' || urlPath === '/en/feed/') return '/api/news/feed/en'
        if (urlPath === '/es/feed' || urlPath === '/es/feed/') return '/api/news/feed/es'
        if (urlPath === '/sitemap.xml' || urlPath === '/sitemap_index.xml') return '/api/news/sitemaps/index'
        if (urlPath === '/es/sitemap_index.xml' || urlPath === '/es/sitemap.xml') return '/api/news/sitemaps/index/es'
        if (urlPath === '/news-sitemap.xml') return '/api/news/sitemaps/news'
        if (urlPath === '/es/news-sitemap.xml') return '/api/news/sitemaps/news/es'
        const newsLocale = urlPath.match(/^\/news-sitemap-(en|es)\.xml$/)
        if (newsLocale) return `/api/news/sitemaps/news/${newsLocale[1]}`
        const rootPage = urlPath.match(/^\/sitemap-(\d+)\.xml$/)
        if (rootPage) return `/api/news/sitemaps/en/${rootPage[1]}`
        const esPage = urlPath.match(/^\/es\/sitemap-(\d+)\.xml$/)
        if (esPage) return `/api/news/sitemaps/es/${esPage[1]}`
        return ''
      })()
      if (sitemapPath) {
        proxyNewsShare({ slug: '', locale: 'en' }, req, res, sitemapPath)
        return
      }

      const rootSlug = urlPath.match(/^\/([A-Za-z0-9_-]+)\/?$/)
      if (rootSlug && !RESERVED_SLUGS.has(rootSlug[1])) {
        proxyLegacyRoot(rootSlug[1], req, res, () => {
          proxyNewsShare({ slug: rootSlug[1], locale: 'en' }, req, res, '', () => serveNewsHtml(res, base))
        })
        return
      }

      const shareTarget = articleShareTarget(urlPath)
      if (shareTarget) {
        proxyNewsShare(shareTarget, req, res, '', () => serveNewsHtml(res, base))
        return
      }

      const isNewsHtml =
        urlPath === '/'
        || urlPath === '/index.html'
        || (
          !path.extname(urlPath)
          && !urlPath.startsWith('/images/')
        )

      if (isNewsHtml) {
        serveNewsHtml(res, base)
        return
      }

      const publicFile = path.normalize(path.join(newsPublic, urlPath.replace(/^\/+/, '')))
      const rel = path.relative(newsPublic, publicFile)
      if (rel.startsWith('..') || path.isAbsolute(rel)) {
        next()
        return
      }

      if (fs.existsSync(publicFile) && fs.statSync(publicFile).isFile()) {
        res.statusCode = 200
        res.setHeader('Content-Type', MIME[path.extname(publicFile).toLowerCase()] || 'application/octet-stream')
        fs.createReadStream(publicFile).pipe(res)
        return
      }

      next()
    })
  },
})
