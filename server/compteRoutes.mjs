/**
 * LES ROUTES DES MEMBRES
 * ======================
 *   /api/compte/…        s'inscrire, se connecter, se déconnecter, changer
 *                        de mot de passe, supprimer son compte
 *   /api/bibliotheque/…  sa liste, ses reprises, ses recherches
 *   /api/evenements      ce que le navigateur est seul à savoir
 *
 * Tout ce qui touche à une bibliothèque exige une session, et n'agit que sur
 * celle du compte connecté : l'identifiant vient du cookie signé, jamais du
 * corps de la requête. C'est la seule façon d'être sûr qu'on ne lit pas la
 * liste du voisin en changeant un numéro dans l'URL.
 */

import {
  bibliotheque, changeListe, changeRecherches, effaceBibliotheque, poseReprise, retireReprise, changeFavoriRadio, changeEpisodeVu,
} from './bibliotheque.mjs'
import {
  adresseVisible, changeMotDePasse, compteDe, connecte, cookieDeDeconnexion, cookieDeSession,
  inscrit, reglages, supprimeCompte, vuePublique,
} from './comptes.mjs'
import { consigne, effaceTracesDuCompte } from './evenements.mjs'
import { serviSignalement } from './signalements.mjs'

function repond(res, statut, corps, entetes = {}) {
  res.statusCode = statut
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  for (const [k, v] of Object.entries(entetes)) res.setHeader(k, v)
  res.end(JSON.stringify(corps))
}

async function corpsJson(req, maximum = 16384) {
  return new Promise((resoud) => {
    let donnees = ''
    req.on('data', (bout) => {
      donnees += bout
      if (donnees.length > maximum) { req.destroy(); resoud(null) }
    })
    req.on('end', () => {
      try { resoud(JSON.parse(donnees || '{}')) } catch { resoud(null) }
    })
    req.on('error', () => resoud(null))
  })
}

/* ---------- /api/compte ---------- */

async function routesCompte(req, res, chemin) {
  const ip = adresseVisible(req)

  if (chemin === 'moi' && req.method === 'GET') {
    const compte = compteDe(req)
    repond(res, 200, {
      compte: vuePublique(compte),
      inscriptionOuverte: reglages().inscriptionOuverte,
    })
    return true
  }

  if (chemin === 'inscription' && req.method === 'POST') {
    const corps = await corpsJson(req)
    const resultat = inscrit({ nom: corps?.nom, motDePasse: corps?.motDePasse, ip })
    if (resultat.erreur) {
      repond(res, resultat.erreur === 'trop_de_comptes' ? 429 : 400, resultat)
      return true
    }
    consigne(req, { type: 'inscription', compte: resultat.compte.id, nom: resultat.compte.nom })
    repond(res, 201, { compte: vuePublique(resultat.compte) }, {
      'Set-Cookie': cookieDeSession(req, resultat.compte),
    })
    return true
  }

  if (chemin === 'session' && req.method === 'POST') {
    const corps = await corpsJson(req)
    const resultat = connecte({ nom: corps?.nom, motDePasse: corps?.motDePasse, ip })
    if (resultat.erreur) {
      consigne(req, { type: 'connexion', ok: false, nom: String(corps?.nom ?? '').slice(0, 40) })
      repond(res, resultat.erreur === 'trop_de_tentatives' ? 429 : 401, resultat)
      return true
    }
    consigne(req, { type: 'connexion', ok: true, compte: resultat.compte.id, nom: resultat.compte.nom })
    repond(res, 200, { compte: vuePublique(resultat.compte) }, {
      'Set-Cookie': cookieDeSession(req, resultat.compte),
    })
    return true
  }

  if (chemin === 'session' && req.method === 'DELETE') {
    const compte = compteDe(req)
    if (compte) consigne(req, { type: 'deconnexion', compte: compte.id, nom: compte.nom })
    repond(res, 200, { compte: null }, { 'Set-Cookie': cookieDeDeconnexion(req) })
    return true
  }

  if (chemin === 'motdepasse' && req.method === 'PUT') {
    const compte = compteDe(req)
    if (!compte) { repond(res, 401, { erreur: 'non_connecte' }); return true }
    const corps = await corpsJson(req)
    const resultat = changeMotDePasse({ id: compte.id, actuel: corps?.actuel, nouveau: corps?.nouveau })
    if (resultat.erreur) { repond(res, 400, resultat); return true }
    /* Le mot de passe a changé : on repart sur une session neuve. */
    repond(res, 200, { ok: true }, { 'Set-Cookie': cookieDeSession(req, resultat.compte) })
    return true
  }

  /* Quelqu'un qui s'en va emporte tout : sa bibliothèque et ses traces. */
  if (chemin === 'moi' && req.method === 'DELETE') {
    const compte = compteDe(req)
    if (!compte) { repond(res, 401, { erreur: 'non_connecte' }); return true }
    effaceBibliotheque(compte.id)
    effaceTracesDuCompte(compte.id)
    supprimeCompte(compte.id)
    repond(res, 200, { ok: true }, { 'Set-Cookie': cookieDeDeconnexion(req) })
    return true
  }

  return false
}

/* ---------- /api/bibliotheque ---------- */

async function routesBibliotheque(req, res, chemin) {
  const compte = compteDe(req)
  if (!compte) {
    repond(res, 401, { erreur: 'non_connecte', message: 'Connectez-vous pour garder votre liste.' })
    return true
  }

  if (chemin === '' && req.method === 'GET') {
    repond(res, 200, bibliotheque(compte.id))
    return true
  }

  if (chemin === 'radios' && req.method === 'GET') {
    repond(res, 200, { favorisRadio: bibliotheque(compte.id).favorisRadio })
    return true
  }
  if (chemin.startsWith('radios/') && ['PUT', 'DELETE'].includes(req.method)) {
    const favorisRadio = changeFavoriRadio(compte.id, chemin.slice('radios/'.length), req.method === 'PUT')
    repond(res, favorisRadio ? 200 : 400, favorisRadio ? { favorisRadio } : { message: 'Station invalide ou limite de 100 favoris atteinte.' })
    return true
  }

  if (chemin === 'episodes-vus' && req.method === 'PUT') {
    const corps = await corpsJson(req)
    const episodesVus = changeEpisodeVu(compte.id, corps?.episodeId, corps?.vu)
    repond(res, episodesVus ? 200 : 400, episodesVus ? { episodesVus } : { erreur: 'episode_invalide' })
    return true
  }

  if (chemin === 'liste' && req.method === 'PUT') {
    const corps = await corpsJson(req)
    repond(res, 200, changeListe(compte.id, corps?.ids))
    return true
  }

  if (chemin === 'progression' && req.method === 'PUT') {
    const corps = await corpsJson(req)
    repond(res, 200, poseReprise(compte.id, corps))
    return true
  }

  if (chemin.startsWith('progression/') && req.method === 'DELETE') {
    repond(res, 200, retireReprise(compte.id, decodeURIComponent(chemin.slice('progression/'.length))))
    return true
  }

  if (chemin === 'recherches' && req.method === 'PUT') {
    const corps = await corpsJson(req)
    repond(res, 200, changeRecherches(compte.id, corps?.recherches))
    return true
  }

  return false
}

/* ---------- /api/evenements ---------- */

/**
 * Ce que seul le navigateur sait : quelle fiche a été ouverte, quelle
 * lecture lancée, quel mot cherché. Le serveur voit passer les requêtes
 * d'API, mais pas les pages — l'application est une page unique.
 */
async function routeEvenement(req, res) {
  if (req.method !== 'POST') return false
  const corps = await corpsJson(req, 2048)
  const compte = compteDe(req)

  consigne(req, {
    type: String(corps?.type ?? ''),
    ...(compte ? { compte: compte.id, nom: compte.nom } : {}),
    ...(corps?.id ? { id: String(corps.id).slice(0, 40) } : {}),
    ...(corps?.titre ? { titre: String(corps.titre).slice(0, 120) } : {}),
    ...(corps?.terme ? { terme: String(corps.terme).slice(0, 80) } : {}),
    ...(corps?.episode ? { episode: String(corps.episode).slice(0, 40) } : {}),
    ...(corps?.chemin ? { chemin: String(corps.chemin).slice(0, 120) } : {}),
  })

  /* 204 : le navigateur n'a rien à faire de la réponse, et un corps vide
     évite de ralentir une page pour une mesure. */
  res.statusCode = 204
  res.end()
  return true
}

/* ---------- l'aiguillage ---------- */

export async function serviCompteApi(req, res) {
  let url
  try {
    url = new URL(req.url ?? '/', 'http://local')
  } catch {
    return false
  }

  const p = url.pathname
  if (p === '/api/signalements') return serviSignalement(req, res, corpsJson)
  if (p === '/api/evenements') return routeEvenement(req, res)
  if (p.startsWith('/api/compte/')) return routesCompte(req, res, p.slice('/api/compte/'.length))
  if (p === '/api/bibliotheque' || p.startsWith('/api/bibliotheque/')) {
    return routesBibliotheque(req, res, p.slice('/api/bibliotheque'.length).replace(/^\//, ''))
  }
  return false
}
