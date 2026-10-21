/**
 * CE QUE LE SERVEUR SAIT DÉJÀ
 * ===========================
 * Chaque appel à HeiwaStream passe par le proxy ; chaque page passe par le
 * serveur. Il suffit de compter au passage pour avoir de quoi remplir un
 * tableau de bord, sans rien instrumenter côté navigateur.
 *
 * Tout est en mémoire, et c'est assumé : ces chiffres décrivent la vie du
 * processus en cours. Redémarrer remet les compteurs à zéro, ce qui est le
 * comportement attendu d'un indicateur de santé. Ce qui doit survivre — le
 * journal d'audit, et plus tard les événements d'usage — s'écrit sur disque.
 */

const DEBUT = Date.now()

/** Les dernières erreurs, pour voir ce qui cloche sans fouiller un journal. */
const DERNIERES_ERREURS_MAX = 40

const etat = {
  appels: 0,
  depuisLeCache: 0,
  servisPerimes: 0,
  erreurs: 0,
  parCode: /** @type {Record<string, number>} */ ({}),
  parRoute: /** @type {Record<string, number>} */ ({}),
  dureeTotale: 0,
  dureeMax: 0,
  dernieresErreurs: /** @type {{a: string, chemin: string, code: number|string, message?: string}[]} */ ([]),
  quota: /** @type {{limite: number|null, restant: number|null, remiseAZero: string|null, vuA: string|null}} */ ({
    limite: null, restant: null, remiseAZero: null, vuA: null,
  }),
}

/** `catalog/movie?sort=popular` → `catalog`, pour compter par famille. */
function famille(chemin) {
  return String(chemin).split(/[/?]/)[0] || 'inconnu'
}

/** Un appel servi par le cache : aucune requête n'est partie. */
export function noteCache(chemin) {
  etat.appels += 1
  etat.depuisLeCache += 1
  etat.parRoute[famille(chemin)] = (etat.parRoute[famille(chemin)] ?? 0) + 1
}

/** Un appel réellement parti vers l'API. */
export function noteAppel(chemin, statut, ms) {
  etat.appels += 1
  etat.parRoute[famille(chemin)] = (etat.parRoute[famille(chemin)] ?? 0) + 1
  etat.parCode[String(statut)] = (etat.parCode[String(statut)] ?? 0) + 1
  etat.dureeTotale += ms
  if (ms > etat.dureeMax) etat.dureeMax = ms
}

/**
 * Une réponse servie depuis une copie périmée, parce que l'API était en
 * panne. C'est un indicateur à part : le site a tenu, mais quelque chose
 * n'allait pas en face.
 */
export function notePerime(chemin) {
  etat.servisPerimes += 1
  etat.dernierPerime = { a: new Date().toISOString(), chemin: String(chemin).slice(0, 120) }
}

export function noteErreur(chemin, code, message) {
  etat.erreurs += 1
  etat.dernieresErreurs.unshift({
    a: new Date().toISOString(),
    chemin: String(chemin).slice(0, 120),
    code,
    ...(message ? { message: String(message).slice(0, 200) } : {}),
  })
  etat.dernieresErreurs.length = Math.min(etat.dernieresErreurs.length, DERNIERES_ERREURS_MAX)
}

/**
 * Le quota, lu dans les en-têtes de chaque réponse. C'est l'indicateur le
 * plus utile du lot : il prévient avant la panne, pas après.
 */
export function noteQuota(entetes) {
  const nombre = (nom) => {
    const brut = entetes.get(nom)
    const valeur = Number(brut)
    return Number.isFinite(valeur) ? valeur : null
  }
  const limite = nombre('x-ratelimit-limit')
  const restant = nombre('x-ratelimit-remaining')
  const remise = nombre('x-ratelimit-reset')
  if (limite === null && restant === null) return
  etat.quota = {
    limite,
    restant,
    remiseAZero: remise ? new Date(remise * 1000).toISOString() : null,
    vuA: new Date().toISOString(),
  }
}

/** Tout ce que le tableau de bord affiche, en un objet. */
export function resume(extra = {}) {
  const partis = etat.appels - etat.depuisLeCache
  return {
    depuis: new Date(DEBUT).toISOString(),
    secondesEnLigne: Math.round((Date.now() - DEBUT) / 1000),
    api: {
      appels: etat.appels,
      depuisLeCache: etat.depuisLeCache,
      partis,
      tauxDeCache: etat.appels ? Math.round((etat.depuisLeCache / etat.appels) * 100) : 0,
      servisPerimes: etat.servisPerimes,
      dernierPerime: etat.dernierPerime ?? null,
      dureeMoyenneMs: partis ? Math.round(etat.dureeTotale / partis) : 0,
      dureeMaxMs: Math.round(etat.dureeMax),
      parCode: etat.parCode,
      parRoute: etat.parRoute,
    },
    erreurs: { total: etat.erreurs, dernieres: etat.dernieresErreurs },
    quota: etat.quota,
    ...extra,
  }
}
