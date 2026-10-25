import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { execSync } from 'node:child_process'

// Shown in Settings so we can tell which version a phone is actually running.
const sha = (process.env.GITHUB_SHA ?? (() => {
  try {
    return execSync('git rev-parse HEAD').toString()
  } catch {
    return 'dev'
  }
})()).trim().slice(0, 7)
const BUILD = `${new Date().toISOString().slice(0, 16).replace('T', ' ')} · ${sha}`

export default defineConfig({
  base: '/dishdex/',
  define: { __BUILD__: JSON.stringify(BUILD) },
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
