/**
 * HEIWASTREAM, CÔTÉ SERVEUR
 * =========================
 * Tout ce que le site sait du catalogue passe par ici. Deux raisons, et
 * aucune n'est négociable :
 *
 * 1. L'API ne renvoie aucun en-tête CORS. Un `fetch` depuis la page échoue
 *    avant même de partir, quel que soit l'en-tête d'autorisation.
 * 2. La clé est un secret. Dans le bundle, elle serait lisible par quiconque
 *    ouvre l'onglet Réseau. Elle reste donc dans .env, côté serveur, et le
 *    navigateur ne parle qu'à ce proxy.
 *
 * Le quota journalier est large (100 000 requêtes), mais la limite de rafale
 * est stricte : une vingtaine d'appels en deux secondes suffit à déclencher
 * un 429. D'où les trois précautions ci-dessous — un cache, une file à deux
 * requêtes de front espacées, et une reprise sur 429 qui respecte
 * `Retry-After`.
 *
 * Variables d'environnement :
 *   HEIWA_KEY      la clé, obligatoire (voir .env.example)
 *   HEIWA_RICH     nombre de fiches enrichies par page (défaut 24)
 *   HEIWA_NO_CACHE à 1, désactive le cache disque
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { noteAppel, noteCache, noteErreur, notePerime, noteQuota } from './mesures.mjs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const racine = resolve(here, '..')

/* ---------- .env, sans dépendance ---------- */

/**
 * Vite lit .env tout seul, `node server/index.mjs` non. Plutôt que deux
 * chemins de chargement selon le point d'entrée, on lit le fichier ici :
 * les deux serveurs passent par ce module.
 */
function chargeEnv() {
  const fichier = resolve(racine, '.env')
  if (!existsSync(fichier)) return
  for (const ligne of readFileSync(fichier, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i.exec(ligne)
    if (!m) continue
    const [, nom, brut] = m
    if (process.env[nom] !== undefined) continue
    process.env[nom] = brut.replace(/^(['"])(.*)\1$/, '$2')
  }
}

chargeEnv()

const BASE = 'https://heiwastream.fr/api/v1'
/* La doc le demande : sans User-Agent nommé, l'API peut répondre une page
   d'erreur en 403 une fois le site hébergé. */
const AGENT = 'Lucarne/1.0 (+https://github.com)'
const RICH_MAX = Number(process.env.HEIWA_RICH ?? 24)
/** Au-delà, on commence à retirer les entrées périmées les plus anciennes. */
const CACHE_MAX = 4000

/** Les seules routes que le proxy accepte de relayer. */
const ROUTES = /^(catalog|find|news|top|calendar|available|media|tv)(\/|$)/

/**
 * Durées de cache, en secondes. Une fiche ne change pas : on la garde une
 * semaine. Un classement bouge chaque jour, une nouveauté chaque heure.
 */
function duree(chemin) {
  if (chemin.startsWith('media/')) return 7 * 24 * 3600
  if (chemin.startsWith('tv/')) return 3600
  if (chemin.startsWith('catalog/') || chemin.startsWith('find/')) return 900
  if (chemin.startsWith('top/')) return 1800
  if (chemin.startsWith('news') || chemin.startsWith('calendar')) return 300
  if (chemin.startsWith('available/')) return 300
  return 300
}

/* ---------- cache ---------- */

const cache = new Map()
const enVol = new Map()

const FICHIER_CACHE = resolve(racine, '.cache', 'heiwa.json')
const cacheDisque = process.env.HEIWA_NO_CACHE !== '1'
let sale = false
let minuteur = null

/**
 * Les fiches coûtent cher à rassembler et ne changent jamais. Les perdre à
 * chaque redémarrage rendait le premier chargement pénible, donc elles
 * survivent sur disque. Seules les entrées longue durée sont écrites : un
 * classement périmé ne vaut pas l'écriture.
 */
function relitDisque() {
  if (!cacheDisque || !existsSync(FICHIER_CACHE)) return
  try {
    const brut = JSON.parse(readFileSync(FICHIER_CACHE, 'utf8'))
    const maintenant = Date.now()
    for (const [cle, entree] of Object.entries(brut)) {
      if (entree?.jusqua > maintenant) cache.set(cle, entree)
    }
  } catch {
    /* Cache illisible : on repart à vide, ce n'est qu'un cache. */
  }
}

function planifieEcriture() {
  if (!cacheDisque || minuteur) return
  minuteur = setTimeout(() => {
    minuteur = null
    if (!sale) return
    sale = false
    try {
      mkdirSync(dirname(FICHIER_CACHE), { recursive: true })
      const garde = {}
      for (const [cle, entree] of cache) {
        if (entree.longue) garde[cle] = entree
      }
      writeFileSync(FICHIER_CACHE, JSON.stringify(garde))
    } catch {
      /* Disque en lecture seule ou plein : le cache mémoire suffit. */
    }
  }, 5000)
  minuteur.unref?.()
}

relitDisque()

function lis(cle) {
  const entree = cache.get(cle)
  if (!entree) return null
  /* Périmée : elle ne sert plus de réponse normale, mais on la garde — voir
     `lisPerime`, qui s'en sert quand l'API ne répond plus. */
  if (entree.jusqua <= Date.now()) return null
  return entree.corps
}

/**
 * La dernière réponse connue, même périmée.
 *
 * Quand HeiwaStream tombe, le site a souvent les fiches sous la main : les
 * jeter pour afficher une erreur serait absurde. Une affiche d'hier vaut
 * mieux qu'une page vide, et l'interface n'a pas à savoir que la donnée a
 * vieilli — c'est le même contenu, simplement plus tout jeune.
 */
function lisPerime(cle) {
  return cache.get(cle)?.corps ?? null
}

/**
 * Le cache ne se vidant plus tout seul à la péremption, il faut une borne.
 * On retire les plus anciennes entrées périmées quand le nombre devient
 * déraisonnable — jamais les fiches encore valides.
 */
function borneLeCache() {
  if (cache.size <= CACHE_MAX) return
  const perimees = []
  const maintenant = Date.now()
  for (const [cle, entree] of cache) {
    if (entree.jusqua <= maintenant) perimees.push([cle, entree.jusqua])
  }
  perimees.sort((a, b) => a[1] - b[1])
  for (const [cle] of perimees.slice(0, cache.size - CACHE_MAX)) cache.delete(cle)
}

function ecris(cle, corps, secondes) {
  cache.set(cle, {
    corps,
    jusqua: Date.now() + secondes * 1000,
    longue: secondes >= 3600,
  })
  if (secondes >= 3600) {
    sale = true
    planifieEcriture()
  }
  borneLeCache()
}

/* ---------- file d'attente vers l'API ---------- */

let actives = 0
const attente = []
const FRONT = 2
const ESPACEMENT = 120
let dernierDepart = 0

function suivant() {
  if (actives >= FRONT) return
  const tache = attente.shift()
  if (!tache) return
  actives += 1
  const retard = Math.max(0, dernierDepart + ESPACEMENT - Date.now())
  setTimeout(() => {
    dernierDepart = Date.now()
    tache().finally(() => {
      actives -= 1
      suivant()
    })
  }, retard)
}

/** Deux requêtes de front, espacées : la limite de rafale ne se déclenche pas. */
function file(fn) {
  return new Promise((resoud, rejette) => {
    attente.push(() => fn().then(resoud, rejette))
    suivant()
  })
}

/* ---------- appel ---------- */

class ErreurApi extends Error {
  constructor(statut, corps) {
    super(`HeiwaStream a répondu ${statut}`)
    this.statut = statut
    this.corps = corps
  }
}

async function appelle(chemin, essai = 0) {
  const cle = process.env.HEIWA_KEY
  if (!cle) throw new ErreurApi(500, { error: 'key_missing', message: 'HEIWA_KEY est absent de .env — voir .env.example.' })

  const debut = Date.now()
  const reponse = await fetch(`${BASE}/${chemin}`, {
    headers: { Authorization: `Bearer ${cle}`, 'User-Agent': AGENT, Accept: 'application/json' },
  })

  /* Le quota voyage dans les en-têtes de chaque réponse : le relever ici
     coûte rien et donne au tableau de bord son indicateur le plus utile. */
  noteQuota(reponse.headers)
  noteAppel(chemin, reponse.status, Date.now() - debut)

  /* La limite de rafale est courte : attendre ce qu'elle demande suffit. */
  if (reponse.status === 429 && essai < 3) {
    const demande = Number(reponse.headers.get('retry-after'))
    const pause = Number.isFinite(demande) && demande > 0 ? demande * 1000 : 1200 * (essai + 1)
    await new Promise((r) => setTimeout(r, Math.min(pause, 5000)))
    return appelle(chemin, essai + 1)
  }

  const texte = await reponse.text()
  let corps
  try {
    corps = JSON.parse(texte)
  } catch {
    /* Une page HTML au lieu du JSON : presque toujours une erreur d'en-tête. */
    throw new ErreurApi(reponse.status === 200 ? 502 : reponse.status, {
      error: 'reponse_illisible',
      message: "L'API n'a pas renvoyé de JSON.",
    })
  }

  if (!reponse.ok) {
    noteErreur(chemin, reponse.status, corps?.error)
    throw new ErreurApi(reponse.status, corps)
  }
  return corps
}

/**
 * Un chemin, une seule requête en vol. Six cartes qui demandent la même
 * fiche en même temps ne font qu'un appel.
 */
function demande(chemin) {
  const connu = lis(chemin)
  if (connu) {
    noteCache(chemin)
    return Promise.resolve(connu)
  }

  const deja = enVol.get(chemin)
  if (deja) return deja

  const promesse = file(() => appelle(chemin))
    .then((corps) => {
      ecris(chemin, corps, duree(chemin))
      return corps
    })
    .catch((erreur) => {
      /* Une panne de leur côté, pas une réponse : un 404 ou un paramètre
         invalide sont de vraies réponses, et les masquer par une vieille
         copie induirait en erreur. */
      const statut = erreur instanceof ErreurApi ? erreur.statut : 0
      const panne = statut === 0 || statut === 429 || statut >= 500
      if (!panne) throw erreur

      const vieux = lisPerime(chemin)
      if (vieux === null) throw erreur

      notePerime(chemin)
      return vieux
    })
    .finally(() => enVol.delete(chemin))

  enVol.set(chemin, promesse)
  return promesse
}

/* ---------- enrichissement ---------- */

/**
 * Le catalogue ne renvoie ni affiche ni résumé ; la fiche `/media` les a. Les
 * rassembler ici plutôt que dans la page évite cinquante allers-retours
 * depuis le navigateur, et le cache ci-dessus fait que la deuxième visite ne
 * coûte rien.
 *
 * Seules les premières entrées sont enrichies : au-delà de ce que l'écran
 * montre, c'est du quota dépensé pour rien. Celles qui restent gardent leurs
 * champs d'origine, et l'interface sait s'en passer.
 */
const CHAMPS = [
  'posterPath', 'backdropPath', 'logoPath', 'overview', 'tagline', 'genres',
  'voteAverage', 'runtime', 'releaseYear', 'releaseDate', 'seasons', 'youtubeId',
  'contentType', 'hauteQualite', 'nextEpisode',
]

async function enrichis(corps, combien) {
  const liste = Array.isArray(corps?.results) ? corps.results
    : Array.isArray(corps?.items) ? corps.items
    : null
  if (!liste) return corps

  const cibles = liste.slice(0, Math.max(0, combien))
  const fiches = await Promise.all(cibles.map(async (item) => {
    const type = item.type === 'movie' ? 'movie' : 'tv'
    const id = item.tmdb ?? item.tmdbId
    if (!id) return null
    try {
      return await demande(`media/${type}/${id}`)
    } catch {
      /* Une fiche manquante n'est pas une page en erreur : l'entrée reste
         affichable avec ce que la liste en disait déjà. */
      return null
    }
  }))

  const enrichies = cibles.map((item, i) => {
    const fiche = fiches[i]
    if (!fiche) return item
    const ajout = {}
    for (const champ of CHAMPS) {
      if (fiche[champ] !== undefined && fiche[champ] !== null) ajout[champ] = fiche[champ]
    }
    return { ...item, ...ajout }
  })

  const fusion = [...enrichies, ...liste.slice(cibles.length)]
  return Array.isArray(corps.results)
    ? { ...corps, results: fusion }
    : { ...corps, items: fusion }
}

/* ---------- la poignée HTTP ---------- */

function repond(res, statut, corps, secondes = 0) {
  const texte = JSON.stringify(corps)
  res.statusCode = statut
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  /* Le navigateur peut garder une copie : c'est le même contenu, et cela
     épargne un aller-retour au proxy. */
  res.setHeader('Cache-Control', secondes > 0 ? `private, max-age=${secondes}` : 'no-store')
  res.end(texte)
}

/**
 * Branche le proxy sur un serveur Node. Renvoie true quand la requête lui
 * appartenait, afin que l'appelant sache s'il doit passer la main.
 */
export async function serviHeiwa(req, res) {
  /* Une adresse malformée ne doit pas laisser la requête sans réponse : sans
     ce garde-fou, l'exception remontait dans une promesse que personne
     n'attendait, et le navigateur restait en attente jusqu'au délai. */
  let url
  try {
    url = new URL(req.url ?? '/', 'http://local')
  } catch {
    return false
  }
  if (!url.pathname.startsWith('/api/hs/')) return false

  const chemin = url.pathname.slice('/api/hs/'.length)
  if (!ROUTES.test(chemin)) {
    repond(res, 404, { error: 'route_inconnue', message: `Le proxy ne relaie pas « ${chemin} ».` })
    return true
  }

  /* `rich` n'appartient pas à l'API : c'est notre demande d'enrichissement. */
  const parametres = new URLSearchParams(url.search)
  const rich = parametres.get('rich')
  parametres.delete('rich')
  const requete = parametres.toString()
  const complet = requete ? `${chemin}?${requete}` : chemin

  try {
    let corps = await demande(complet)
    if (rich !== null) {
      const combien = rich === '' || rich === '1' ? RICH_MAX : Number(rich) || RICH_MAX
      corps = await enrichis(corps, combien)
    }
    repond(res, 200, corps, Math.min(duree(chemin), 600))
  } catch (erreur) {
    if (erreur instanceof ErreurApi) {
      repond(res, erreur.statut, erreur.corps)
    } else {
      repond(res, 502, {
        error: 'injoignable',
        message: "HeiwaStream est injoignable depuis ce serveur.",
      })
    }
  }
  return true
}

/** L'état du cache, pour le tableau de bord d'administration. */
export function etatDuCache() {
  let longues = 0
  const maintenant = Date.now()
  let perimees = 0
  for (const entree of cache.values()) {
    if (entree.longue) longues += 1
    if (entree.jusqua <= maintenant) perimees += 1
  }
  return {
    entrees: cache.size,
    fiches: longues,
    perimees,
    enVol: enVol.size,
    surDisque: cacheDisque && existsSync(FICHIER_CACHE),
  }
}

/** Pour le greffon Vite : un middleware Connect classique. */
export function middlewareHeiwa() {
  return (req, res, next) => {
    serviHeiwa(req, res).then(
      (pris) => { if (!pris) next() },
      (erreur) => {
        /* Dernier filet : le proxy a déjà sa propre gestion d'erreur, donc
           arriver ici est un défaut de code, pas une panne de l'API. */
        console.error('[heiwa] erreur inattendue du proxy :', erreur)
        if (res.headersSent) { res.end(); return }
        repond(res, 500, { error: 'proxy', message: 'Erreur interne du proxy.' })
      },
    )
  }
}
