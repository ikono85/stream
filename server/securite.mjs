/**
 * LES PRIMITIVES
 * ==============
 * Mots de passe, jetons signés, cookies, adresses. Tout ce qui touche à la
 * cryptographie est ici, en un seul endroit : l'administration et les
 * comptes des membres s'en servent, et deux implémentations auraient fini
 * par diverger sur un détail qui compte.
 *
 * Rien d'exotique, uniquement ce que Node fournit — scrypt pour les mots de
 * passe, HMAC-SHA256 pour les jetons. Pas de dépendance à maintenir sur le
 * morceau le plus sensible du projet.
 */

import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
export const RACINE = resolve(here, '..')
export const DONNEES = resolve(RACINE, 'donnees')

/* ---------- mots de passe ---------- */

/** `scrypt$sel$empreinte`. Le mot de passe lui-même n'est jamais conservé. */
export function empreinte(motDePasse) {
  const sel = randomBytes(16)
  return `scrypt$${sel.toString('hex')}$${scryptSync(motDePasse, sel, 64).toString('hex')}`
}

/** Vérification à temps constant : la durée ne doit rien révéler. */
export function empreinteJuste(propose, attendue) {
  if (!attendue || typeof propose !== 'string' || !propose) return false
  const [algo, selHex, cibleHex] = String(attendue).split('$')
  if (algo !== 'scrypt' || !selHex || !cibleHex) return false
  try {
    const cible = Buffer.from(cibleHex, 'hex')
    const calcule = scryptSync(propose, Buffer.from(selHex, 'hex'), cible.length)
    return timingSafeEqual(calcule, cible)
  } catch {
    return false
  }
}

/* ---------- jetons signés ---------- */

/**
 * Un secret stable, pour que les sessions survivent à un redémarrage. Il est
 * créé au premier lancement et rangé hors du dépôt. Le supprimer déconnecte
 * tout le monde, ce qui est d'ailleurs la façon la plus simple de le faire.
 */
let secretCache = null

export function secretServeur() {
  if (secretCache) return secretCache
  if (process.env.SESSION_SECRET) {
    secretCache = process.env.SESSION_SECRET
    return secretCache
  }
  const fichier = resolve(DONNEES, 'secret.txt')
  try {
    if (existsSync(fichier)) {
      secretCache = readFileSync(fichier, 'utf8').trim()
      if (secretCache) return secretCache
    }
    secretCache = randomBytes(32).toString('hex')
    mkdirSync(DONNEES, { recursive: true })
    writeFileSync(fichier, secretCache, { mode: 0o600 })
  } catch {
    /* Disque en lecture seule : un secret en mémoire, et les sessions ne
       survivront pas au redémarrage. Mieux que de refuser de démarrer. */
    secretCache = secretCache || randomBytes(32).toString('hex')
  }
  return secretCache
}

function signature(charge, usage) {
  return createHmac('sha256', `${secretServeur()}|${usage}`).update(charge).digest('base64url')
}

/** Un jeton porteur de données, signé, daté. */
export function signeJeton(donnees, dureeMs, usage = 'session') {
  const charge = Buffer.from(JSON.stringify({ ...donnees, exp: Date.now() + dureeMs })).toString('base64url')
  return `${charge}.${signature(charge, usage)}`
}

/** Les données d'un jeton, ou null s'il est falsifié ou périmé. */
export function litJeton(jeton, usage = 'session') {
  if (typeof jeton !== 'string') return null
  const [charge, fournie] = jeton.split('.')
  if (!charge || !fournie) return null

  const attendue = Buffer.from(signature(charge, usage))
  const recue = Buffer.from(fournie)
  if (attendue.length !== recue.length || !timingSafeEqual(attendue, recue)) return null

  try {
    const donnees = JSON.parse(Buffer.from(charge, 'base64url').toString())
    if (typeof donnees.exp !== 'number' || donnees.exp <= Date.now()) return null
    return donnees
  } catch {
    return null
  }
}

/* ---------- cookies ---------- */

export function cookies(req) {
  const brut = req.headers?.cookie
  if (!brut) return {}
  const out = {}
  for (const morceau of brut.split(';')) {
    const i = morceau.indexOf('=')
    if (i < 0) continue
    out[morceau.slice(0, i).trim()] = decodeURIComponent(morceau.slice(i + 1).trim())
  }
  return out
}

export function enHttps(req) {
  return req.socket?.encrypted === true || req.headers?.['x-forwarded-proto'] === 'https'
}

/** L'en-tête Set-Cookie d'une session, avec les attributs qui protègent. */
export function cookieSession(nom, valeur, { req, dureeS, efface = false }) {
  return [
    `${nom}=${efface ? '' : valeur}`,
    'HttpOnly',
    'SameSite=Lax',
    'Path=/',
    `Max-Age=${efface ? 0 : dureeS}`,
    enHttps(req) ? 'Secure' : null,
  ].filter(Boolean).join('; ')
}

/* ---------- adresses ---------- */

/** L'adresse de la socket. La seule qui ne se falsifie pas. */
export function adresseSocket(req) {
  return String(req.socket?.remoteAddress ?? '').replace(/^::ffff:/, '')
}

export function estLocale(req) {
  const ip = adresseSocket(req)
  return ip === '127.0.0.1' || ip === '::1'
}

/**
 * L'adresse à consigner. Derrière un proxy inverse, la socket est celle du
 * proxy ; X-Forwarded-For porte la vraie, mais on ne s'y fie que si
 * l'exploitant l'a déclaré — sinon n'importe qui choisit ce qu'on écrit.
 */
export function adresseVisible(req) {
  if (process.env.ADMIN_DERRIERE_PROXY === '1') {
    const suivi = req.headers?.['x-forwarded-for']
    if (typeof suivi === 'string' && suivi.trim()) {
      return suivi.split(',')[0].trim().replace(/^::ffff:/, '')
    }
  }
  return adresseSocket(req)
}

/* ---------- fichiers ---------- */

/**
 * Écriture atomique : on écrit à côté, puis on renomme. Un renommage est
 * indivisible pour le système de fichiers, donc une coupure de courant au
 * mauvais moment laisse l'ancien fichier intact plutôt qu'un fichier à
 * moitié écrit — ce qui, pour la liste des comptes, serait fâcheux.
 */
export function ecritJson(chemin, valeur) {
  mkdirSync(dirname(chemin), { recursive: true })
  const provisoire = `${chemin}.${process.pid}.tmp`
  writeFileSync(provisoire, JSON.stringify(valeur, null, 2))
  renameSync(provisoire, chemin)
}

export function litJson(chemin, defaut) {
  try {
    if (!existsSync(chemin)) return defaut
    return JSON.parse(readFileSync(chemin, 'utf8'))
  } catch {
    return defaut
  }
}

/* ---------- limitation ---------- */

/** Un compteur par clé, sur une fenêtre glissante. */
export function creeLimiteur(maximum, fenetreMs) {
  const vus = new Map()
  return {
    depasse(cle) {
      const suivi = vus.get(cle)
      if (!suivi || Date.now() > suivi.jusqua) return false
      return suivi.n >= maximum
    },
    note(cle) {
      const suivi = vus.get(cle)
      if (!suivi || Date.now() > suivi.jusqua) {
        vus.set(cle, { n: 1, jusqua: Date.now() + fenetreMs })
        return
      }
      suivi.n += 1
    },
    oublie(cle) { vus.delete(cle) },
  }
}
