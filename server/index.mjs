/**
 * Serveur de production.
 *
 * Serves the built site from dist/ and runs the shared-room relay on the same
 * port, so one process is enough:
 *
 *   npm run build
 *   npm start
 *
 * Optional environment variables:
 *   PORT=8080          the port to listen on (default 8080)
 *   VIDEOS=/mnt/films  a folder served at /videos, for a library kept outside
 *                      the project
 *
 * Behind Caddy or nginx, remember to forward the WebSocket upgrade on /sync —
 * see the README.
 */

import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { existsSync } from 'node:fs'
import sirv from 'sirv'
import { attachSync } from './sync.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const dist = resolve(here, '..', 'dist')

if (!existsSync(dist)) {
  console.error("dist/ est introuvable. Lancez d'abord : npm run build")
  process.exit(1)
}

const port = Number(process.env.PORT ?? 8080)
const site = sirv(dist, { single: true, etag: true, gzip: true, brotli: true })
const videos = process.env.VIDEOS
  ? sirv(resolve(process.env.VIDEOS), { etag: true, dev: true })
  : null

const server = createServer((req, res) => {
  if (videos && req.url?.startsWith('/videos/')) {
    req.url = req.url.slice('/videos'.length)
    videos(req, res, () => {
      res.statusCode = 404
      res.end('Introuvable')
    })
    return
  }
  site(req, res, () => {
    res.statusCode = 404
    res.end('Introuvable')
  })
})

attachSync(server)

server.listen(port, () => {
  console.log(`Lucarne écoute sur http://localhost:${port}`)
  if (videos) console.log(`Vidéos servies depuis ${resolve(process.env.VIDEOS)} sur /videos`)
})
