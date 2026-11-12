import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: true
      },
      manifest: {
        name: 'RemindrX',
        short_name: 'RemindrX',
        description: 'Campus workspace for deadlines, attendance, timetable, and section updates',
        theme_color: '#111111',
        background_color: '#111111',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ],
        shortcuts: [
          {
            name: 'Events',
            url: '/events',
            icons: [{ src: 'icon-192.png', sizes: '192x192' }]
          },
          {
            name: 'Timeline',
            url: '/timeline',
            icons: [{ src: 'icon-192.png', sizes: '192x192' }]
          }
        ]
      }
    })
  ],
  optimizeDeps: {
    include: ['recharts', 'react-is']
  },
})
