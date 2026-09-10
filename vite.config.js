import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),

    VitePWA({
      registerType: 'autoUpdate',

      manifest: {
        name: 'NeuroPlay',
        short_name: 'NeuroPlay',

        description:
          'AI-based cognitive gaming and memory assistance platform for elderly users',

        theme_color: '#2f5d50',
        background_color: '#f7f4ed',

        display: 'standalone',

        start_url: '/',
        scope: '/',

        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },

      workbox: {
  globPatterns: [
    '**/*.{js,css,html,ico,png,svg,jpg,jpeg,webp}'
  ],

  maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
},
    }),
  ],
})