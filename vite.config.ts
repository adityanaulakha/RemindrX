import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { pathToFileURL } from 'node:url'
import path from 'node:path'

/** Local-dev shim so `/api/gla/enroll` works without `vercel dev`. */
function glaEnrollApiPlugin(): Plugin {
  return {
    name: 'gla-enroll-api',
    configureServer(server) {
      server.middlewares.use('/api/gla/enroll', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.setHeader('Allow', 'POST')
          res.end(JSON.stringify({ success: false, error: 'Method not allowed' }))
          return
        }
        try {
          const chunks: Buffer[] = []
          for await (const chunk of req) chunks.push(Buffer.from(chunk))
          const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
          const modPath = pathToFileURL(
            path.resolve(server.config.root, 'api/gla/enroll.ts')
          ).href
          const { default: handler } = await server.ssrLoadModule(modPath)
          await handler(
            { method: 'POST', body, headers: req.headers as Record<string, string> },
            {
              setHeader: (k: string, v: string) => res.setHeader(k, v),
              status: (n: number) => ({
                json: (b: unknown) => {
                  res.statusCode = n
                  res.setHeader('Content-Type', 'application/json')
                  res.end(JSON.stringify(b))
                },
              }),
            }
          )
        } catch (err) {
          console.error('[gla-enroll-api]', err)
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(
            JSON.stringify({
              success: false,
              error: err instanceof Error ? err.message : 'Enroll failed',
            })
          )
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    glaEnrollApiPlugin(),
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
  build: {
    rolldownOptions: {
      output: {
        // Stable vendor chunks: cache well across deploys and keep the entry small.
        // recharts/d3 stay in the lazily-loaded Super Admin chunk.
        codeSplitting: {
          groups: [
            { name: 'vendor-react', test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/ },
            { name: 'vendor-firebase', test: /node_modules[\\/](@firebase|firebase)[\\/]/ },
          ],
        },
      },
    },
  },
  optimizeDeps: {
    include: ['recharts', 'react-is']
  },
})
