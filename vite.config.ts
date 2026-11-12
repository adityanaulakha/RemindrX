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
        theme_color: '#07070B',
        background_color: '#07070B',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'Logo.png?v=2',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'Logo.png?v=2',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'Logo.png?v=2',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ],
        shortcuts: [
          {
            name: 'Events',
            url: '/events',
            icons: [{ src: 'Logo.png?v=2', sizes: '192x192' }]
          },
          {
            name: 'Timeline',
            url: '/timeline',
            icons: [{ src: 'Logo.png?v=2', sizes: '192x192' }]
          }
        ]
      }
    })
  ],
  optimizeDeps: {
    include: ['recharts', 'react-is']
  },
})
