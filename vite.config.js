import http from 'node:http'
import https from 'node:https'
import path from 'node:path'
import { defineConfig, searchForWorkspaceRoot } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { musicMundialLandingPlugin, newsRoot } from './vite.landing.js'

const appBase = '/vote'

/** Prefer local API uploads (fresh admin videos), fall back to prod for covers. */
const uploadsFallbackPlugin = () => ({
  name: 'uploads-local-then-prod',
  configureServer(server) {
    const pipe = (upstreamUrl, req, res, onMiss) => {
      const url = new URL(upstreamUrl)
      const lib = url.protocol === 'https:' ? https : http
      const headers = { ...req.headers, host: url.host }
      delete headers['accept-encoding']
      const upstream = lib.request(
        {
          protocol: url.protocol,
          hostname: url.hostname,
          port: url.port || (url.protocol === 'https:' ? 443 : 80),
          path: `${url.pathname}${url.search}`,
          method: req.method,
          headers,
        },
        (upstreamRes) => {
          if (onMiss && (upstreamRes.statusCode === 404 || upstreamRes.statusCode === 500)) {
            upstreamRes.resume()
            onMiss()
            return
          }
          res.statusCode = upstreamRes.statusCode || 200
          for (const [key, value] of Object.entries(upstreamRes.headers)) {
            if (value == null || key === 'transfer-encoding') continue
            res.setHeader(key, value)
          }
          upstreamRes.pipe(res)
        },
      )
      upstream.on('error', () => {
        if (onMiss) onMiss()
        else {
          res.statusCode = 502
          res.end('Bad gateway')
        }
      })
      req.pipe(upstream)
    }

    server.middlewares.use((req, res, next) => {
      const raw = String(req.url || '')
      const pathname = raw.split('?')[0] || ''
      if (!pathname.startsWith('/uploads/') && !pathname.startsWith(`${appBase}/uploads/`)) {
        next()
        return
      }
      const uploadPath = pathname.startsWith(appBase)
        ? pathname.slice(appBase.length)
        : pathname
      const search = raw.includes('?') ? raw.slice(raw.indexOf('?')) : ''
      pipe(`http://127.0.0.1:4000${uploadPath}${search}`, req, res, () => {
        pipe(`https://www.musicmundial.com${uploadPath}${search}`, req, res)
      })
    })
  },
})

// https://vite.dev/config/
export default defineConfig({
  base: `${appBase}/`,
  plugins: [
    vue({
      template: {
        transformAssetUrls: {
          includeAbsolute: false,
        },
      },
    }),
    tailwindcss(),
    musicMundialLandingPlugin(),
    uploadsFallbackPlugin(),
  ],
  resolve: {
    alias: {
      '@news': path.join(newsRoot, 'src'),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5174,
    strictPort: true,
    fs: {
      allow: [searchForWorkspaceRoot(process.cwd())],
    },
    watch: {
      // Flutter/Android build locks files under app_movile; ignore to avoid EBUSY on Windows.
      ignored: ['**/app_movile/**'],
    },
    proxy: {
      [`${appBase}/api`]: {
        target: 'http://localhost:4000',
        changeOrigin: true,
        rewrite: (pathName) => pathName.replace(/^\/vote/, ''),
      },
      [`${appBase}/socket.io`]: {
        target: 'http://localhost:4000',
        changeOrigin: true,
        ws: true,
        rewrite: (pathName) => pathName.replace(/^\/vote/, ''),
      },
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
})
