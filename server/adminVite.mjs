/**
 * La garde de /admin pour le serveur de développement.
 *
 * Même règle qu'en production : sans session, on reçoit la page de connexion
 * et rien d'autre. En développement on travaille depuis la machine
 * elle-même, donc l'accès est libre et on ne tape jamais de mot de passe —
 * mais la garde est là, ce qui évite de découvrir qu'elle manque le jour de
 * la mise en ligne.
 */

import { estAdmin, motDePasseConfigure } from './admin.mjs'
import { pageConnexion, serviAdminApi } from './adminRoutes.mjs'
import { serviCompteApi } from './compteRoutes.mjs'

function rendsConnexion(res) {
  const html = pageConnexion({ configure: motDePasseConfigure() })
  res.statusCode = 200
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(html)
}

export function middlewareAdmin() {
  return (req, res, next) => {
    let url
    try {
      url = new URL(req.url ?? '/', 'http://local')
    } catch {
      next()
      return
    }

    if (url.pathname.startsWith('/api/compte/') || url.pathname.startsWith('/api/bibliotheque')
        || url.pathname.startsWith('/api/evenements')) {
      serviCompteApi(req, res).then(
        (pris) => { if (!pris) next() },
        (erreur) => {
          console.error('[compte] erreur inattendue :', erreur)
          if (!res.headersSent) res.statusCode = 500
          res.end()
        },
      )
      return
    }

    if (url.pathname.startsWith('/api/admin/')) {
      serviAdminApi(req, res).then(
        (pris) => { if (!pris) next() },
        (erreur) => {
          console.error('[admin] erreur inattendue :', erreur)
          if (!res.headersSent) res.statusCode = 500
          res.end()
        },
      )
      return
    }

    /* /admin et /admin.html mènent au même endroit, et au même contrôle. */
    if (url.pathname === '/admin' || url.pathname === '/admin/' || url.pathname === '/admin.html') {
      if (!estAdmin(req)) {
        rendsConnexion(res)
        return
      }
      req.url = '/admin.html'
    }

    next()
  }
}
