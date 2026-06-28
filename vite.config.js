import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), tailwindcss()],
  server: {
    proxy: {
      // En desarrollo, las imagenes subidas viven en el servidor de produccion.
      // Reenviamos /uploads alli para poder verlas en local.
      '/uploads': {
        target: 'https://vote.musicmundial.com',
        changeOrigin: true,
        secure: true,
      },
    },
  },
})
