/**
 * LA SERRURE DE L'ADMINISTRATION
 * ==============================
 * Le serveur ne connaît personne. Il reçoit des requêtes, et rien dans une
 * requête ne dit qui l'envoie : « moi » n'existe pas, il n'y a que des
 * preuves. Ce module en accepte deux.
 *
 *   1. Venir de la machine elle-même. Une requête dont la socket part de
 *      127.0.0.1 ne peut pas avoir été fabriquée depuis l'extérieur.
 *   2. Connaître le mot de passe, remplacé ensuite par une session signée.
 *
 * C'est une serrure **séparée** des comptes des membres : s'inscrire sur le
 * site ne donne aucun droit ici, et l'administrateur n'a pas besoin d'un
 * compte membre. Deux portes, deux clés, aucun chemin de l'une vers l'autre.
 *
 * Les primitives — scrypt, jetons signés, cookies, adresses — viennent de
 * securite.mjs, partagé avec les comptes.
 *
 * Variables d'environnement (voir .env.example) :
 *   ADMIN_MOTDEPASSE    l'empreinte, produite par `npm run admin:motdepasse`
 *   ADMIN_LOCALHOST=0   refuse l'accès libre depuis la machine elle-même
 *   ADMIN_DERRIERE_PROXY=1  lit X-Forwarded-For pour journaliser la vraie IP
 */

import { appendFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import {
  DONNEES, adresseVisible, cookieSession, cookies, creeLimiteur,
  empreinte, empreinteJuste, estLocale, litJeton, signeJeton,
} from './securite.mjs'

const JOURNAL = resolve(DONNEES, 'admin-journal.jsonl')

/** Durée d'une session d'administration. Plus courte que celle des membres. */
const SESSION_MS = 12 * 3600 * 1000

const tentatives = creeLimiteur(5, 10 * 60 * 1000)

/**
 * L'empreinte du mot de passe entre dans la signature : en changer invalide
 * toutes les sessions en cours, ce qui est précisément ce qu'on veut.
 */
function usage() {
  return `admin|${process.env.ADMIN_MOTDEPASSE ?? ''}`
}

/** `scrypt$sel$empreinte`, ce que `npm run admin:motdepasse` produit. */
export const empreinteMotDePasse = empreinte

export function motDePasseConfigure() {
  return Boolean(process.env.ADMIN_MOTDEPASSE)
}

/** Cette requête a-t-elle le droit d'administrer ? */
export function estAdmin(req) {
  if (process.env.ADMIN_LOCALHOST !== '0' && estLocale(req)) return true
  return Boolean(litJeton(cookies(req).admin, usage()))
}

export function adressePourJournal(req) {
  return adresseVisible(req)
}

/**
 * Qui est entré, quand, depuis où. Tenu même pour un administrateur unique :
 * le jour où l'on se demande « est-ce que quelqu'un est entré ? », il faut
 * que la réponse soit écrite quelque part.
 */
export function consigne(evenement) {
  try {
    mkdirSync(dirname(JOURNAL), { recursive: true })
    appendFileSync(JOURNAL, JSON.stringify({ a: new Date().toISOString(), ...evenement }) + '\n')
  } catch {
    /* Ne jamais faire échouer une requête pour un défaut d'écriture. */
  }
}

export { JOURNAL }

function repondJson(res, statut, corps, entetes = {}) {
  res.statusCode = statut
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  for (const [k, v] of Object.entries(entetes)) res.setHeader(k, v)
  res.end(JSON.stringify(corps))
}

async function litCorps(req, maximum = 4096) {
  return new Promise((resoud) => {
    let donnees = ''
    req.on('data', (bout) => {
      donnees += bout
      if (donnees.length > maximum) { req.destroy(); resoud(null) }
    })
    req.on('end', () => resoud(donnees))
    req.on('error', () => resoud(null))
  })
}

/**
 * Les routes de session :
 *   GET    /api/admin/moi       suis-je administrateur ?
 *   POST   /api/admin/session   se connecter
 *   DELETE /api/admin/session   se déconnecter
 */
export async function serviSession(req, res, chemin) {
  if (chemin === 'moi' && req.method === 'GET') {
    repondJson(res, 200, {
      admin: estAdmin(req),
      motDePasseConfigure: motDePasseConfigure(),
      parLocalhost: process.env.ADMIN_LOCALHOST !== '0' && estLocale(req),
    })
    return true
  }

  if (chemin === 'session' && req.method === 'DELETE') {
    consigne({ action: 'deconnexion', ip: adresseVisible(req) })
    repondJson(res, 200, { admin: false }, {
      'Set-Cookie': cookieSession('admin', '', { req, dureeS: 0, efface: true }),
    })
    return true
  }

  if (chemin === 'session' && req.method === 'POST') {
    const ip = adresseVisible(req)

    if (tentatives.depasse(ip)) {
      consigne({ action: 'connexion', ok: false, raison: 'trop_de_tentatives', ip })
      repondJson(res, 429, {
        error: 'trop_de_tentatives',
        message: 'Trop de tentatives. Réessayez dans quelques minutes.',
      })
      return true
    }

    if (!motDePasseConfigure()) {
      repondJson(res, 503, {
        error: 'non_configure',
        message: "Aucun mot de passe n'est configuré. Lancez : npm run admin:motdepasse",
      })
      return true
    }

    const brut = await litCorps(req)
    let propose = ''
    try { propose = String(JSON.parse(brut ?? '{}').motDePasse ?? '') } catch { propose = '' }

    if (!propose || !empreinteJuste(propose, process.env.ADMIN_MOTDEPASSE)) {
      tentatives.note(ip)
      consigne({ action: 'connexion', ok: false, ip })
      /* Un délai court rend le test en masse pénible sans gêner une faute
         de frappe. */
      await new Promise((r) => setTimeout(r, 400))
      repondJson(res, 401, { error: 'refuse', message: 'Mot de passe incorrect.' })
      return true
    }

    tentatives.oublie(ip)
    consigne({ action: 'connexion', ok: true, ip })
    repondJson(res, 200, { admin: true }, {
      'Set-Cookie': cookieSession('admin', signeJeton({}, SESSION_MS, usage()), {
        req,
        dureeS: Math.floor(SESSION_MS / 1000),
      }),
    })
    return true
  }

  return false
}

/** Refus standard, pour tout ce qui exige une session. */
export function refuse(res) {
  repondJson(res, 401, {
    error: 'non_autorise',
    message: "Cette page demande une session d'administration.",
  })
}
