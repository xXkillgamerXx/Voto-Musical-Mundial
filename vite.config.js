import path from 'node:path'
import { defineConfig, searchForWorkspaceRoot } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { musicMundialLandingPlugin, newsRoot } from './vite.landing.js'

const appBase = '/vote'

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
      [`${appBase}/uploads`]: {
        target: 'https://vote.musicmundial.com',
        changeOrigin: true,
        secure: true,
        rewrite: (pathName) => pathName.replace(/^\/vote/, ''),
      },
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
      '/uploads': {
        target: 'https://vote.musicmundial.com',
        changeOrigin: true,
        secure: true,
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
