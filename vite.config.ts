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
        name: 'Academic Platform',
        short_name: 'Academic',
        description: 'Modern academic management system for college students',
        theme_color: '#0F6B56',
        background_color: '#F6F3EC',
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
