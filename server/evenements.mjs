/**
 * LE JOURNAL D'USAGE
 * ==================
 * Ce que les gens font sur le site : fiches ouvertes, lectures lancées,
 * recherches, connexions. Un fichier par jour, une ligne par événement,
 * en JSONL — un format qui s'écrit par ajout, ne se corrompt pas en cas de
 * coupure, et se lit avec n'importe quel outil.
 *
 * Ce qu'on enregistre, et c'est un choix assumé de l'exploitant du site :
 * le compte quand il y en a un, l'adresse IP, et l'appareil. Les visiteurs
 * doivent le savoir — le pied de page du site le dit.
 *
 * Les adresses sont tronquées ; la rétention vaut 90 jours par défaut.
 *
 * Ce qu'on ne peut PAS enregistrer, et qu'il ne faut pas chercher : la durée
 * réellement regardée. Le lecteur est une iframe de HeiwaStream qui ne
 * rapporte rien. « Lecture lancée » est le seul signal de visionnage.
 */

import {
  appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync,
  renameSync, unlinkSync, writeFileSync,
} from 'node:fs'
import { resolve } from 'node:path'
import { DONNEES, adresseVisible } from './securite.mjs'

const DOSSIER = resolve(DONNEES, 'evenements')
let dernierePurge = ''

function adresseTronquee(req) {
  const ip = adresseVisible(req)
  if (/^\d+\.\d+\.\d+\.\d+$/.test(ip)) return ip.replace(/\.\d+$/, '.0/24')
  if (ip.includes(':')) {
    const [gauche, droite] = ip.split('::')
    const debut = gauche ? gauche.split(':') : []
    const fin = droite ? droite.split(':') : []
    const blocs = droite === undefined ? debut : [...debut, ...Array(Math.max(0, 8 - debut.length - fin.length)).fill('0'), ...fin]
    return blocs.slice(0, 3).map((b) => b || '0').join(':') + '::/48'
  }
  return 'inconnue'
}

/** Les types attendus. Un type inconnu est refusé plutôt que stocké. */
const TYPES = new Set(['page', 'fiche', 'lecture', 'recherche', 'connexion', 'inscription', 'deconnexion'])

function jourDe(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/** L'appareil, réduit à l'essentiel : la chaîne complète n'apprend rien. */
function appareil(ua) {
  const texte = String(ua ?? '')
  if (!texte) return 'inconnu'
  if (/iPhone|iPod/i.test(texte)) return 'iPhone'
  if (/iPad/i.test(texte)) return 'iPad'
  if (/Android/i.test(texte)) return /Mobile/i.test(texte) ? 'Android' : 'Android (tablette)'
  if (/Windows/i.test(texte)) return 'Windows'
  if (/Macintosh|Mac OS X/i.test(texte)) return 'Mac'
  if (/CrOS/i.test(texte)) return 'ChromeOS'
  if (/Linux/i.test(texte)) return 'Linux'
  if (/bot|crawl|spider/i.test(texte)) return 'robot'
  return 'autre'
}

/**
 * Consigne un événement. N'échoue jamais : un défaut d'écriture ne doit pas
 * casser une page pour un visiteur.
 */
export function consigne(req, { type, ...reste }) {
  if (!TYPES.has(type)) return
  const jour = jourDe()
  if (dernierePurge !== jour) { purge(); dernierePurge = jour }
  const ligne = {
    a: new Date().toISOString(),
    type,
    ip: adresseTronquee(req),
    appareil: appareil(req.headers?.['user-agent']),
    ...reste,
  }
  try {
    mkdirSync(DOSSIER, { recursive: true })
    appendFileSync(resolve(DOSSIER, `${jourDe()}.jsonl`), JSON.stringify(ligne) + '\n')
  } catch {
    /* Rien à faire, et surtout rien à propager. */
  }
}

/** Les fichiers de journal, du plus récent au plus ancien. */
function journaux() {
  if (!existsSync(DOSSIER)) return []
  try {
    return readdirSync(DOSSIER).filter((f) => f.endsWith('.jsonl')).sort().reverse()
  } catch {
    return []
  }
}

/** Les événements des N derniers jours, les plus récents d'abord. */
export function evenements(jours = 7, maximum = 20000) {
  const limite = new Date()
  limite.setDate(limite.getDate() - (jours - 1))
  const depuis = jourDe(limite)

  const out = []
  for (const nom of journaux()) {
    if (nom.slice(0, 10) < depuis) break
    let contenu
    try {
      contenu = readFileSync(resolve(DOSSIER, nom), 'utf8')
    } catch {
      continue
    }
    const lignes = contenu.split('\n')
    for (let i = lignes.length - 1; i >= 0; i--) {
      const ligne = lignes[i].trim()
      if (!ligne) continue
      try {
        out.push(JSON.parse(ligne))
      } catch {
        /* Une ligne tronquée par une coupure : on l'ignore. */
      }
      if (out.length >= maximum) return out
    }
  }
  return out
}

function compte(liste, clef) {
  const totaux = new Map()
  for (const e of liste) {
    const k = clef(e)
    if (k === undefined || k === null || k === '') continue
    totaux.set(k, (totaux.get(k) ?? 0) + 1)
  }
  return [...totaux.entries()].sort((a, b) => b[1] - a[1])
}

/**
 * Ce que le panneau affiche. Tout est calculé à la demande : à l'échelle
 * d'une bibliothèque entre proches, relire quelques milliers de lignes coûte
 * moins cher que de tenir des agrégats à jour en permanence.
 */
export function resumeUsage(jours = 7) {
  const liste = evenements(jours)
  const lectures = liste.filter((e) => e.type === 'lecture')
  const fiches = liste.filter((e) => e.type === 'fiche')
  const recherches = liste.filter((e) => e.type === 'recherche')

  /* Une « visite » : un couple compte-ou-IP et un jour. Faute de mieux sans
     traceur, c'est l'approximation honnête du nombre de personnes venues. */
  const visites = new Set(liste.map((e) => `${e.compte ?? e.ip}|${String(e.a).slice(0, 10)}`))

  const parJour = new Map()
  for (const e of liste) {
    const jour = String(e.a).slice(0, 10)
    const ligne = parJour.get(jour) ?? { jour, lectures: 0, fiches: 0, recherches: 0, visiteurs: new Set() }
    if (e.type === 'lecture') ligne.lectures += 1
    if (e.type === 'fiche') ligne.fiches += 1
    if (e.type === 'recherche') ligne.recherches += 1
    ligne.visiteurs.add(e.compte ?? e.ip)
    parJour.set(jour, ligne)
  }

  return {
    jours,
    total: liste.length,
    lectures: lectures.length,
    fiches: fiches.length,
    recherches: recherches.length,
    visites: visites.size,
    parJour: [...parJour.values()]
      .map(({ visiteurs, ...reste }) => ({ ...reste, visiteurs: visiteurs.size }))
      .sort((a, b) => a.jour.localeCompare(b.jour)),
    titresLances: compte(lectures, (e) => e.titre && `${e.titre}|${e.id ?? ''}`)
      .slice(0, 15)
      .map(([clef, n]) => ({ titre: clef.split('|')[0], id: clef.split('|')[1], n })),
    fichesOuvertes: compte(fiches, (e) => e.titre && `${e.titre}|${e.id ?? ''}`)
      .slice(0, 15)
      .map(([clef, n]) => ({ titre: clef.split('|')[0], id: clef.split('|')[1], n })),
    motsCherches: compte(recherches, (e) => e.terme).slice(0, 20).map(([terme, n]) => ({ terme, n })),
    appareils: compte(liste, (e) => e.appareil).map(([nom, n]) => ({ nom, n })),
    adresses: compte(liste, (e) => e.ip).slice(0, 20).map(([ip, n]) => ({ ip, n })),
    /* L'activité la plus récente, telle quelle : c'est ce qu'on regarde en
       premier quand on se demande « que se passe-t-il en ce moment ». */
    dernieres: liste.slice(0, 60),
  }
}

/** L'activité d'un compte, pour sa fiche dans le panneau. */
export function activiteDuCompte(compteId, jours = 90, maximum = 200) {
  return evenements(jours).filter((e) => e.compte === compteId).slice(0, maximum)
}

/**
 * Efface les journaux plus vieux que N jours. Appelée au démarrage et une
 * fois par jour. Une valeur absente, invalide ou nulle revient à 90 jours.
 */
export function purge() {
  const reglage = Number(process.env.RETENTION_JOURS ?? 90)
  const jours = Number.isFinite(reglage) && reglage > 0 ? Math.min(365, Math.max(1, Math.floor(reglage))) : 90

  const limite = new Date()
  limite.setDate(limite.getDate() - jours)
  const avant = jourDe(limite)

  let effaces = 0
  for (const nom of journaux()) {
    if (nom.slice(0, 10) >= avant) continue
    try {
      unlinkSync(resolve(DOSSIER, nom))
      effaces += 1
    } catch {
      /* Fichier verrouillé ou déjà parti. */
    }
  }
  return effaces
}

/** Efface toute trace d'un compte dans les journaux, à sa demande. */
export function effaceTracesDuCompte(compteId) {
  let retirees = 0
  for (const nom of journaux()) {
    const chemin = resolve(DOSSIER, nom)
    let contenu
    try {
      contenu = readFileSync(chemin, 'utf8')
    } catch {
      continue
    }

    const gardees = []
    for (const ligne of contenu.split('\n')) {
      if (!ligne.trim()) continue
      try {
        if (JSON.parse(ligne).compte === compteId) {
          retirees += 1
          continue
        }
      } catch {
        /* Ligne illisible : on la garde plutôt que de la perdre. */
      }
      gardees.push(ligne)
    }

    if (gardees.length === contenu.split('\n').filter((l) => l.trim()).length) continue

    /* Réécriture par remplacement atomique : le fichier est petit, et une
       coupure au mauvais moment laisserait sinon un journal tronqué. */
    try {
      const provisoire = `${chemin}.${process.pid}.tmp`
      writeFileSync(provisoire, gardees.length ? gardees.join('\n') + '\n' : '')
      renameSync(provisoire, chemin)
    } catch {
      /* On préfère un journal intact qu'à moitié réécrit. */
    }
  }
  return retirees
}
