/**
 * LA BIBLIOTHÈQUE D'UN COMPTE
 * ===========================
 * Ce que chacun garde : sa liste, ses reprises, ses recherches récentes.
 * Un fichier par compte, écrit de façon atomique.
 *
 * Sans compte, tout cela reste dans le navigateur, comme avant — c'est la
 * conséquence du site ouvert : on peut s'en servir sans s'inscrire, et
 * s'inscrire fait alors suivre ses affaires d'un appareil à l'autre.
 */

import { resolve } from 'node:path'
import { DONNEES, ecritJson, litJson } from './securite.mjs'

const DOSSIER = resolve(DONNEES, 'bibliotheques')

/** Plafonds : une liste n'est pas un dépotoir, et un fichier doit rester petit. */
const LISTE_MAX = 500
const REPRISES_MAX = 100
const RECHERCHES_MAX = 12

const VIDE = { maListe: [], progression: [], recherches: [] }

function fichier(compteId) {
  /* L'identifiant vient d'un UUID que nous avons produit : il ne peut pas
     contenir de séparateur de chemin. On le vérifie quand même, parce qu'un
     jour il pourrait venir d'ailleurs. */
  if (!/^[0-9a-f-]{36}$/i.test(String(compteId))) return null
  return resolve(DOSSIER, `${compteId}.json`)
}

export function bibliotheque(compteId) {
  const chemin = fichier(compteId)
  if (!chemin) return { ...VIDE }
  const donnees = litJson(chemin, VIDE)
  return {
    maListe: Array.isArray(donnees.maListe) ? donnees.maListe : [],
    progression: Array.isArray(donnees.progression) ? donnees.progression : [],
    recherches: Array.isArray(donnees.recherches) ? donnees.recherches : [],
  }
}

function sauve(compteId, donnees) {
  const chemin = fichier(compteId)
  if (!chemin) return
  ecritJson(chemin, donnees)
}

/** Un identifiant de titre tel que l'interface les fabrique. */
function idValide(id) {
  return typeof id === 'string' && /^(movie|tv)-\d+$/.test(id)
}

export function changeListe(compteId, ids) {
  if (!Array.isArray(ids)) return bibliotheque(compteId)
  const propres = [...new Set(ids.filter(idValide))].slice(0, LISTE_MAX)
  const donnees = bibliotheque(compteId)
  donnees.maListe = propres
  sauve(compteId, donnees)
  return donnees
}

function repriseValide(p) {
  return p && idValide(p.entryId)
    && Number.isFinite(p.seconds) && p.seconds >= 0
    && Number.isFinite(p.duration) && p.duration >= 0
}

export function poseReprise(compteId, reprise) {
  if (!repriseValide(reprise)) return bibliotheque(compteId)
  const donnees = bibliotheque(compteId)
  const cle = (p) => `${p.entryId}:${p.episodeId ?? ''}`
  const propre = {
    entryId: reprise.entryId,
    ...(reprise.episodeId ? { episodeId: String(reprise.episodeId).slice(0, 64) } : {}),
    seconds: Math.round(reprise.seconds),
    duration: Math.round(reprise.duration),
    updatedAt: Date.now(),
  }
  donnees.progression = [propre, ...donnees.progression.filter((p) => cle(p) !== cle(propre))]
    .slice(0, REPRISES_MAX)
  sauve(compteId, donnees)
  return donnees
}

export function retireReprise(compteId, entryId) {
  const donnees = bibliotheque(compteId)
  donnees.progression = donnees.progression.filter((p) => p.entryId !== entryId)
  sauve(compteId, donnees)
  return donnees
}

export function changeRecherches(compteId, recherches) {
  const donnees = bibliotheque(compteId)
  donnees.recherches = Array.isArray(recherches)
    ? [...new Set(recherches.filter((r) => typeof r === 'string' && r.trim()))]
        .map((r) => r.trim().slice(0, 80))
        .slice(0, RECHERCHES_MAX)
    : []
  sauve(compteId, donnees)
  return donnees
}

/** Tout effacer pour un compte — à sa demande, ou à sa suppression. */
export function effaceBibliotheque(compteId) {
  sauve(compteId, { ...VIDE })
}
