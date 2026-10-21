/**
 * LES COMPTES
 * ===========
 * Un compte, c'est un nom, une empreinte de mot de passe, et une session
 * signée dans un cookie. Rien de plus : pas d'adresse électronique, donc pas
 * de courrier à envoyer, et pas de réinitialisation automatique — c'est
 * l'administrateur qui remet un mot de passe à zéro si besoin.
 *
 * Le site est ouvert : on peut parcourir et regarder sans compte. Le compte
 * sert à garder sa liste et ses reprises d'un appareil à l'autre, et c'est
 * lui qui donne un nom aux statistiques d'usage.
 *
 * Les comptes tiennent dans un fichier JSON, écrit de façon atomique. Pour
 * une bibliothèque entre proches, une base de données serait une
 * complication sans contrepartie ; le jour où elle s'impose, seul ce module
 * change.
 */

import { randomUUID } from 'node:crypto'
import { resolve } from 'node:path'
import {
  DONNEES, adresseVisible, cookieSession, cookies, creeLimiteur,
  ecritJson, empreinte, empreinteJuste, litJeton, litJson, signeJeton,
} from './securite.mjs'

const FICHIER = resolve(DONNEES, 'comptes.json')
const REGLAGES = resolve(DONNEES, 'reglages.json')

/** Un mois : on ne veut pas que les proches se reconnectent sans cesse. */
const SESSION_MS = 30 * 24 * 3600 * 1000

const NOM_MIN = 2
const NOM_MAX = 24
const MDP_MIN = 8
const MDP_MAX = 200

/* Garde-fous de l'inscription libre : ils ne gênent pas un usage normal et
   rendent la création en masse pénible. */
const inscriptions = creeLimiteur(3, 3600 * 1000)
const connexions = creeLimiteur(10, 10 * 60 * 1000)

/* ---------- le fichier ---------- */

function tous() {
  const donnees = litJson(FICHIER, { comptes: [] })
  return Array.isArray(donnees.comptes) ? donnees.comptes : []
}

function enregistre(comptes) {
  ecritJson(FICHIER, { comptes })
}

/** Pour comparer les noms sans se faire piéger par la casse ou les accents. */
function plie(nom) {
  return String(nom).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

export function reglages() {
  return { inscriptionOuverte: true, ...litJson(REGLAGES, {}) }
}

export function changeReglages(patch) {
  const suivant = { ...reglages(), ...patch }
  ecritJson(REGLAGES, suivant)
  return suivant
}

/* ---------- lecture ---------- */

/** Le compte d'une requête, ou null. Ne touche jamais au mot de passe. */
export function compteDe(req) {
  const jeton = litJeton(cookies(req).session, 'compte')
  if (!jeton?.id) return null
  const compte = tous().find((c) => c.id === jeton.id)
  if (!compte || compte.suspendu) return null
  return compte
}

/** La version publique d'un compte : jamais l'empreinte. */
export function vuePublique(compte) {
  if (!compte) return null
  return {
    id: compte.id,
    nom: compte.nom,
    role: compte.role ?? 'membre',
    creeA: compte.creeA,
    derniereConnexionA: compte.derniereConnexionA ?? null,
  }
}

export function listeComptes() {
  return tous().map((c) => ({
    ...vuePublique(c),
    suspendu: Boolean(c.suspendu),
    creeDepuis: c.creeDepuis ?? null,
  }))
}

export function compteParId(id) {
  return tous().find((c) => c.id === id) ?? null
}

export function supprimeCompte(id) {
  const restants = tous().filter((c) => c.id !== id)
  enregistre(restants)
}

export function suspendCompte(id, suspendu) {
  const comptes = tous()
  const compte = comptes.find((c) => c.id === id)
  if (!compte) return false
  compte.suspendu = Boolean(suspendu)
  enregistre(comptes)
  return true
}

/** Remet un mot de passe, à la demande de quelqu'un qui l'a perdu. */
export function reinitialise(id, nouveau) {
  if (typeof nouveau !== 'string' || nouveau.length < MDP_MIN) return false
  const comptes = tous()
  const compte = comptes.find((c) => c.id === id)
  if (!compte) return false
  compte.motDePasse = empreinte(nouveau)
  enregistre(comptes)
  return true
}

/* ---------- validation ---------- */

function nomValide(nom) {
  if (typeof nom !== 'string') return 'Le nom est absent.'
  const propre = nom.trim()
  if (propre.length < NOM_MIN) return `Le nom fait ${NOM_MIN} caractères au minimum.`
  if (propre.length > NOM_MAX) return `Le nom fait ${NOM_MAX} caractères au maximum.`
  if (!/^[\p{L}\p{N} ._-]+$/u.test(propre)) return 'Le nom contient un caractère interdit.'
  return null
}

function motDePasseValide(mdp) {
  if (typeof mdp !== 'string') return 'Le mot de passe est absent.'
  if (mdp.length < MDP_MIN) return `Le mot de passe fait ${MDP_MIN} caractères au minimum.`
  if (mdp.length > MDP_MAX) return 'Le mot de passe est trop long.'
  return null
}

/* ---------- actions ---------- */

export function inscrit({ nom, motDePasse, ip }) {
  if (!reglages().inscriptionOuverte) {
    return { erreur: 'inscription_fermee', message: "Les inscriptions sont fermées pour le moment." }
  }
  if (inscriptions.depasse(ip)) {
    return { erreur: 'trop_de_comptes', message: 'Trop de comptes créés depuis cette connexion. Réessayez plus tard.' }
  }

  const soucisNom = nomValide(nom)
  if (soucisNom) return { erreur: 'nom_invalide', message: soucisNom }
  const soucisMdp = motDePasseValide(motDePasse)
  if (soucisMdp) return { erreur: 'motdepasse_invalide', message: soucisMdp }

  const comptes = tous()
  const propre = nom.trim()
  if (comptes.some((c) => plie(c.nom) === plie(propre))) {
    return { erreur: 'nom_pris', message: 'Ce nom est déjà utilisé.' }
  }

  const compte = {
    id: randomUUID(),
    nom: propre,
    motDePasse: empreinte(motDePasse),
    /* Le premier inscrit n'a pas de privilège : l'administration est une
       serrure séparée, pas un rôle que l'on obtient en s'inscrivant. */
    role: 'membre',
    creeA: new Date().toISOString(),
    creeDepuis: ip ?? null,
    derniereConnexionA: new Date().toISOString(),
  }

  comptes.push(compte)
  enregistre(comptes)
  inscriptions.note(ip)
  return { compte }
}

export function connecte({ nom, motDePasse, ip }) {
  if (connexions.depasse(ip)) {
    return { erreur: 'trop_de_tentatives', message: 'Trop de tentatives. Réessayez dans quelques minutes.' }
  }

  const comptes = tous()
  const compte = comptes.find((c) => plie(c.nom) === plie(String(nom ?? '')))

  /* Le même message dans les deux cas : dire « ce compte n'existe pas »
     révélerait quels noms existent. */
  const refus = { erreur: 'refuse', message: 'Nom ou mot de passe incorrect.' }

  if (!compte || !empreinteJuste(String(motDePasse ?? ''), compte.motDePasse)) {
    connexions.note(ip)
    return refus
  }
  if (compte.suspendu) {
    return { erreur: 'suspendu', message: 'Ce compte est suspendu.' }
  }

  connexions.oublie(ip)
  compte.derniereConnexionA = new Date().toISOString()
  enregistre(comptes)
  return { compte }
}

export function changeMotDePasse({ id, actuel, nouveau }) {
  const comptes = tous()
  const compte = comptes.find((c) => c.id === id)
  if (!compte) return { erreur: 'introuvable', message: 'Compte introuvable.' }
  if (!empreinteJuste(String(actuel ?? ''), compte.motDePasse)) {
    return { erreur: 'refuse', message: 'Le mot de passe actuel est incorrect.' }
  }
  const soucis = motDePasseValide(nouveau)
  if (soucis) return { erreur: 'motdepasse_invalide', message: soucis }

  compte.motDePasse = empreinte(nouveau)
  enregistre(comptes)
  return { compte }
}

/* ---------- cookies de session ---------- */

export function cookieDeSession(req, compte) {
  return cookieSession('session', signeJeton({ id: compte.id }, SESSION_MS, 'compte'), {
    req,
    dureeS: Math.floor(SESSION_MS / 1000),
  })
}

export function cookieDeDeconnexion(req) {
  return cookieSession('session', '', { req, dureeS: 0, efface: true })
}

export { adresseVisible }
