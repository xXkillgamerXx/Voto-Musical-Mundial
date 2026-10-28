import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, searchForWorkspaceRoot } from 'vite'
import vue from '@vitejs/plugin-vue'

const here = path.dirname(fileURLToPath(import.meta.url))
const repo = path.resolve(here, '..')

export default defineConfig(({ mode }) => ({
  root: here,
  envDir: repo,
  base: '/',
  define:
    mode === 'production'
      ? { 'import.meta.env.VITE_API_BASE_URL': JSON.stringify('/api') }
      : {},
  plugins: [
    vue({
      template: {
        transformAssetUrls: {
          includeAbsolute: false,
        },
      },
    }),
  ],
  resolve: {
    alias: {
      '@news': path.join(here, 'src'),
    },
  },
  server: {
    fs: {
      allow: [searchForWorkspaceRoot(repo)],
    },
  },
  build: {
    outDir: path.join(repo, 'dist-news'),
    emptyOutDir: true,
    assetsDir: 'assets',
  },
  publicDir: path.join(here, 'public'),
}))
