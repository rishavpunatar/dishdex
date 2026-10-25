import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/dishdex/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        id: './',
        name: 'Dishdex',
        short_name: 'Dishdex',
        description: 'Every dish the two of you know how to cook.',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#F2EDE4',
        background_color: '#F2EDE4',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Only the app shell is cached. GitHub API traffic is never cached by the service worker.
        globPatterns: ['**/*.{js,css,html,svg,png}', '**/*-latin-[ow]*.woff2'],
        navigateFallback: 'index.html',
      },
    }),
  ],
})
