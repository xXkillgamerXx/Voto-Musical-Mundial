import fs from 'node:fs'
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
  '.webp': 'image/webp',
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

      const isNewsHtml =
        urlPath === '/'
        || urlPath === '/index.html'
        || (
          !path.extname(urlPath)
          && !urlPath.startsWith('/images/')
        )

      if (isNewsHtml) {
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
