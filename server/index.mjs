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
 *   HEIWA_KEY=hs_…     la clé de l'API, lue depuis .env si elle n'est pas
 *                      dans l'environnement — voir server/heiwa.mjs
 *   ADMIN_MOTDEPASSE   l'empreinte du mot de passe d'administration, produite
 *                      par `npm run admin:motdepasse` — voir server/admin.mjs
 *   VIDEOS=/mnt/films  a folder served at /videos, for a library kept outside
 *                      the project
 *
 * Behind Caddy or nginx, remember to forward the WebSocket upgrade on /sync —
 * see the README.
 */

import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { existsSync, readFileSync } from 'node:fs'
import sirv from 'sirv'
import { attachSync } from './sync.mjs'
import { serviHeiwa } from './heiwa.mjs'
import { estAdmin, motDePasseConfigure } from './admin.mjs'
import { pageConnexion, serviAdminApi } from './adminRoutes.mjs'
import { serviCompteApi } from './compteRoutes.mjs'
import { purge } from './evenements.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const dist = resolve(here, '..', 'dist')

if (!existsSync(dist)) {
  console.error("dist/ est introuvable. Lancez d'abord : npm run build")
  process.exit(1)
}

/* ---------- ce qui n'appartient qu'à l'administration ---------- */

/**
 * Le manifeste de build dit quels fichiers composent chaque entrée. On en
 * déduit ceux qui n'appartiennent **qu'à** l'administration : eux seuls sont
 * protégés. Les fichiers partagés avec le site public — React, la feuille de
 * style — ne doivent surtout pas l'être, sinon le site casse pour tout le
 * monde.
 */
function fichiersReservesALAdmin() {
  const manifeste = resolve(dist, '.vite', 'manifest.json')
  if (!existsSync(manifeste)) return new Set()

  let entrees
  try {
    entrees = JSON.parse(readFileSync(manifeste, 'utf8'))
  } catch {
    return new Set()
  }

  const rassemble = (cle, vus = new Set()) => {
    if (vus.has(cle)) return new Set()
    vus.add(cle)
    const entree = entrees[cle]
    if (!entree) return new Set()
    const fichiers = new Set()
    if (entree.file) fichiers.add('/' + entree.file)
    for (const css of entree.css ?? []) fichiers.add('/' + css)
    for (const suite of [...(entree.imports ?? []), ...(entree.dynamicImports ?? [])]) {
      for (const f of rassemble(suite, vus)) fichiers.add(f)
    }
    return fichiers
  }

  const cotéAdmin = rassemble('admin.html')
  const cotéPublic = rassemble('index.html')
  for (const partagé of cotéPublic) cotéAdmin.delete(partagé)
  return cotéAdmin
}

const reserves = fichiersReservesALAdmin()

function rendsConnexion(res) {
  const html = pageConnexion({ configure: motDePasseConfigure() })
  res.statusCode = 200
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(html)
}

function rendsAdmin(res) {
  const page = resolve(dist, 'admin.html')
  if (!existsSync(page)) {
    res.statusCode = 500
    res.end("admin.html est absent du build.")
    return
  }
  res.statusCode = 200
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(readFileSync(page))
}

const port = Number(process.env.PORT ?? 8080)
const site = sirv(dist, { single: true, etag: true, gzip: true, brotli: true })
const videos = process.env.VIDEOS
  ? sirv(resolve(process.env.VIDEOS), { etag: true, dev: true })
  : null

const server = createServer((req, res) => {
  /* Le catalogue passe par le proxy : la clé reste ici, le navigateur ne la
     voit jamais. Testé avant le site, dont le mode `single` renverrait
     index.html pour une route d'API. */
  if (req.url?.startsWith('/api/hs/')) {
    serviHeiwa(req, res).catch((erreur) => {
      console.error('[heiwa] erreur inattendue du proxy :', erreur)
      if (!res.headersSent) res.statusCode = 500
      res.end()
    })
    return
  }

  if (req.url?.startsWith('/api/admin/')) {
    serviAdminApi(req, res).catch((erreur) => {
      console.error('[admin] erreur inattendue :', erreur)
      if (!res.headersSent) res.statusCode = 500
      res.end()
    })
    return
  }

  /* Comptes, bibliothèques et événements d'usage. */
  if (req.url?.startsWith('/api/compte/') || req.url?.startsWith('/api/bibliotheque')
      || req.url?.startsWith('/api/evenements')) {
    serviCompteApi(req, res).then(
      (pris) => {
        if (pris) return
        res.statusCode = 404
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.end('{"erreur":"route_inconnue"}')
      },
      (erreur) => {
        console.error('[compte] erreur inattendue :', erreur)
        if (!res.headersSent) res.statusCode = 500
        res.end()
      },
    )
    return
  }

  /* L'administration : la page, puis les fichiers qui n'appartiennent qu'à
     elle. Testé avant sirv, dont le mode `single` renverrait le site public
     pour /admin, et servirait le bundle à qui en connaît le nom. */
  const chemin = (req.url ?? '/').split('?')[0]
  if (chemin === '/admin' || chemin === '/admin/' || chemin === '/admin.html') {
    if (estAdmin(req)) rendsAdmin(res)
    else rendsConnexion(res)
    return
  }
  if (reserves.has(chemin) && !estAdmin(req)) {
    res.statusCode = 404
    res.end('Introuvable')
    return
  }
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
  if (!process.env.HEIWA_KEY) {
    console.warn('HEIWA_KEY est absent : le catalogue restera vide. Voir .env.example.')
  }
  if (!motDePasseConfigure()) {
    console.warn(
      "ADMIN_MOTDEPASSE est absent : /admin n'est accessible que depuis cette machine.\n" +
      '  Avant une mise en ligne, lancez : npm run admin:motdepasse',
    )
  }
  if (reserves.size > 0) {
    console.log(`${reserves.size} fichier(s) réservé(s) à l'administration, protégés par session.`)
  }
  /* La purge des journaux d'usage. Sans RETENTION_JOURS, elle ne fait rien :
     le mécanisme est en place avant d'être utile, pour pouvoir l'activer
     plus tard sans rien migrer. */
  const efface = purge()
  if (efface > 0) console.log(`${efface} journal(aux) d'usage purgé(s).`)
  setInterval(purge, 24 * 3600 * 1000).unref()
  if (videos) console.log(`Vidéos servies depuis ${resolve(process.env.VIDEOS)} sur /videos`)
})
