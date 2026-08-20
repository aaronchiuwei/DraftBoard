import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    preact(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Draft Room',
        short_name: 'Draft Room',
        description: 'Offline-first draft tracker for a live PPR fantasy football draft.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#10141B',
        theme_color: '#10141B',
        icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }]
      },
      workbox: {
        // the whole app is precached, so a draft-day load needs no network at all
        globPatterns: ['**/*.{js,css,html,svg,json}'],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            /* Headshots are the only thing left on the network, and far too
               large to precache 300 of. Keeping the ones actually opened means
               a player reviewed on the sofa still has a face in the draft room. */
            urlPattern: /^https:\/\/sleepercdn\.com\/content\/nfl\/players\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'headshots',
              expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 120 },
              cacheableResponse: { statuses: [0, 200] }
            }
          }
        ]
      }
    })
  ],
  build: {
    target: 'es2022',
    // one draft-night request beats code splitting for a 70KB app
    modulePreload: { polyfill: false }
  },
  test: {
    // domain tests need no DOM; the App integration test opts in per file
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    css: { modules: { classNameStrategy: 'non-scoped' } }
  }
});
