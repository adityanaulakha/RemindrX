import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { pathToFileURL } from 'node:url'
import path from 'node:path'

/** Local-dev shim so `/api/gla/*` works without `vercel dev`. */
function glaApiPlugin(): Plugin {
  const routes: Record<string, string> = {
    '/api/gla/enroll': 'api/gla/enroll.ts',
    '/api/gla/login': 'api/gla/login.ts',
    '/api/gla/captcha': 'api/gla/captcha.ts',
    '/api/gla/refresh': 'api/gla/refresh.ts',
  }

  return {
    name: 'gla-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || ''
        const pathname = url.split('?')[0] || ''
        const rel = routes[pathname]
        if (!rel) return next()

        try {
          const chunks: Buffer[] = []
          if (req.method !== 'GET' && req.method !== 'HEAD') {
            for await (const chunk of req) chunks.push(Buffer.from(chunk))
          }
          const body =
            chunks.length > 0
              ? JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
              : undefined
          const query: Record<string, string> = {}
          const q = url.includes('?') ? new URL(url, 'http://localhost').searchParams : null
          q?.forEach((v, k) => {
            query[k] = v
          })

          const modPath = pathToFileURL(path.resolve(server.config.root, rel)).href
          const { default: handler } = await server.ssrLoadModule(modPath)
          await handler(
            {
              method: req.method,
              body,
              query,
              headers: req.headers as Record<string, string>,
            },
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
          console.error('[gla-api]', pathname, err)
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(
            JSON.stringify({
              success: false,
              error: err instanceof Error ? err.message : 'API failed',
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
    glaApiPlugin(),
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
