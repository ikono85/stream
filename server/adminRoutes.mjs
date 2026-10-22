/**
 * LES ROUTES D'ADMINISTRATION
 * ===========================
 * Deux familles, et la différence est la serrure :
 *
 *   /api/admin/moi      et  /api/admin/session   — publiques par nécessité :
 *       c'est par là qu'on demande si l'on est administrateur, et par là
 *       qu'on le devient. Elles ne révèlent rien d'autre.
 *   tout le reste       — exige une session valide, sinon 401.
 *
 * Le tableau de bord ne lit que ce que le serveur sait déjà : les compteurs
 * du proxy, l'état du cache, le journal des connexions. Rien n'est collecté
 * dans le navigateur à ce stade.
 */

import { readFileSync, existsSync } from 'node:fs'
import { JOURNAL, adressePourJournal, estAdmin, motDePasseConfigure, refuse, serviSession } from './admin.mjs'
import { resume } from './mesures.mjs'
import { etatDuCache } from './heiwa.mjs'
import {
  changeReglages, listeComptes, reglages, reinitialise, supprimeCompte, suspendCompte,
} from './comptes.mjs'
import { effaceBibliotheque } from './bibliotheque.mjs'
import { activiteDuCompte, effaceTracesDuCompte, resumeUsage } from './evenements.mjs'
import { listeSignalements } from './signalements.mjs'

/** Les dernières lignes du journal d'audit, les plus récentes d'abord. */
function journal(combien = 50) {
  if (!existsSync(JOURNAL)) return []
  try {
    /* Le fichier est append-only et reste petit : le relire entièrement est
       plus simple qu'un curseur, et assez rapide pour des milliers de lignes.
       Le jour où il grossit, il faudra le faire tourner par date. */
    const lignes = readFileSync(JOURNAL, 'utf8').trim().split('\n').filter(Boolean)
    return lignes.slice(-combien).reverse().map((ligne) => {
      try {
        return JSON.parse(ligne)
      } catch {
        return { a: null, action: 'illisible' }
      }
    })
  } catch {
    return []
  }
}

async function corpsJson(req, maximum = 8192) {
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

function repondJson(res, statut, corps) {
  const texte = JSON.stringify(corps)
  res.statusCode = statut
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(texte)
}

/**
 * Traite une requête /api/admin/… Renvoie true si elle lui appartenait.
 */
export async function serviAdminApi(req, res) {
  const url = new URL(req.url ?? '/', 'http://local')
  if (!url.pathname.startsWith('/api/admin/')) return false

  const chemin = url.pathname.slice('/api/admin/'.length)

  /* Session : ouvert, parce qu'il faut bien pouvoir frapper à la porte. */
  if (await serviSession(req, res, chemin)) return true

  /* Tout le reste est derrière la serrure. */
  if (!estAdmin(req)) {
    refuse(res)
    return true
  }

  if (chemin === 'signalements' && req.method === 'GET') {
    try { repondJson(res, 200, { entrees: listeSignalements() }) }
    catch { repondJson(res, 503, { message: 'Les signalements sont indisponibles.' }) }
    return true
  }

  if (chemin === 'mesures' && req.method === 'GET') {
    repondJson(res, 200, resume({
      cache: etatDuCache(),
      cle: {
        configuree: Boolean(process.env.HEIWA_KEY),
        motDePasseAdmin: motDePasseConfigure(),
        accesLocalhost: process.env.ADMIN_LOCALHOST !== '0',
      },
      vous: { ip: adressePourJournal(req) },
    }))
    return true
  }

  if (chemin === 'journal' && req.method === 'GET') {
    const combien = Math.min(Number(url.searchParams.get('n')) || 50, 300)
    repondJson(res, 200, { entrees: journal(combien) })
    return true
  }

  /* ---------- usage ---------- */

  if (chemin === 'usage' && req.method === 'GET') {
    const jours = Math.min(Math.max(Number(url.searchParams.get('jours')) || 7, 1), 365)
    repondJson(res, 200, resumeUsage(jours))
    return true
  }

  /* ---------- comptes ---------- */

  if (chemin === 'comptes' && req.method === 'GET') {
    repondJson(res, 200, { comptes: listeComptes(), reglages: reglages() })
    return true
  }

  if (chemin === 'reglages' && req.method === 'PUT') {
    const corps = await corpsJson(req)
    const patch = {}
    if (typeof corps?.inscriptionOuverte === 'boolean') patch.inscriptionOuverte = corps.inscriptionOuverte
    repondJson(res, 200, changeReglages(patch))
    return true
  }

  const surCompte = /^comptes\/([0-9a-f-]{36})(?:\/(\w+))?$/i.exec(chemin)
  if (surCompte) {
    const [, id, action] = surCompte

    if (!action && req.method === 'GET') {
      const jours = Math.min(Math.max(Number(url.searchParams.get('jours')) || 90, 1), 3650)
      repondJson(res, 200, { activite: activiteDuCompte(id, jours) })
      return true
    }

    /* Supprimer un compte emporte sa bibliothèque et ses traces : un compte
       effacé qui laisserait un historique nominatif derrière lui serait le
       pire des deux mondes. */
    if (!action && req.method === 'DELETE') {
      effaceBibliotheque(id)
      const retirees = effaceTracesDuCompte(id)
      supprimeCompte(id)
      repondJson(res, 200, { ok: true, tracesRetirees: retirees })
      return true
    }

    if (action === 'suspension' && req.method === 'PUT') {
      const corps = await corpsJson(req)
      const ok = suspendCompte(id, Boolean(corps?.suspendu))
      repondJson(res, ok ? 200 : 404, { ok })
      return true
    }

    if (action === 'motdepasse' && req.method === 'PUT') {
      const corps = await corpsJson(req)
      const ok = reinitialise(id, String(corps?.nouveau ?? ''))
      repondJson(res, ok ? 200 : 400, {
        ok,
        ...(ok ? {} : { message: 'Mot de passe trop court (huit caractères au minimum).' }),
      })
      return true
    }

    /* Effacer l'historique sans toucher au compte : ce qu'on fait quand
       quelqu'un le demande. */
    if (action === 'traces' && req.method === 'DELETE') {
      repondJson(res, 200, { ok: true, tracesRetirees: effaceTracesDuCompte(id) })
      return true
    }
  }

  repondJson(res, 404, { error: 'route_inconnue', message: `Pas de route « ${chemin} ».` })
  return true
}

/* ---------- la page de connexion ---------- */

/**
 * Rendue par le serveur, sans bundle : c'est la porte, pas l'application.
 * Un visiteur qui tombe ici ne télécharge rien du tableau de bord, et il n'y
 * a rien à fouiller dans le code reçu.
 */
export function pageConnexion({ erreur = null, configure = true } = {}) {
  const message = !configure
    ? "Aucun mot de passe n'est configuré sur ce serveur. Lancez <code>npm run admin:motdepasse</code> et suivez les instructions."
    : erreur

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Connexion</title>
<style>
  :root { color-scheme: dark }
  * { box-sizing: border-box }
  body {
    margin: 0; min-height: 100dvh; display: grid; place-items: center; padding: 24px;
    background: #04070F; color: #EEF1F7;
    font: 15px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif;
  }
  form { width: min(26rem, 100%) }
  h1 { font-size: 1.4rem; margin: 0 0 .4rem; letter-spacing: -.01em }
  p.sous { margin: 0 0 1.6rem; color: #8A93A6; font-size: .9rem }
  label { display: block; font-size: .85rem; color: #8A93A6; margin-bottom: .4rem }
  input {
    width: 100%; height: 46px; padding: 0 14px; border-radius: 10px;
    border: 1px solid #2A3142; background: #0D121D; color: #EEF1F7; font-size: 1rem;
  }
  input:focus { outline: 2px solid #F2A93B; outline-offset: 1px; border-color: transparent }
  button {
    margin-top: 14px; width: 100%; height: 46px; border: 0; border-radius: 999px;
    background: #F2A93B; color: #04070F; font-weight: 650; font-size: .95rem; cursor: pointer;
  }
  button:hover { background: #F7BB5C }
  button:disabled { opacity: .6; cursor: default }
  .erreur {
    margin-top: 14px; padding: 10px 14px; border-radius: 10px; font-size: .88rem;
    border: 1px solid rgba(209,86,63,.4); background: rgba(209,86,63,.12); color: #F0B7A8;
  }
  .erreur code { background: rgba(255,255,255,.08); padding: 1px 5px; border-radius: 4px }
  a { color: #8A93A6; font-size: .85rem; display: inline-block; margin-top: 22px }
</style>
</head>
<body>
  <form id="f" autocomplete="on">
    <h1>Administration</h1>
    <p class="sous">Cette page est réservée.</p>
    <label for="mdp">Mot de passe</label>
    <input id="mdp" name="password" type="password" autocomplete="current-password" autofocus ${configure ? '' : 'disabled'}>
    <button type="submit" ${configure ? '' : 'disabled'}>Entrer</button>
    <div class="erreur" id="e" ${message ? '' : 'hidden'}>${message ?? ''}</div>
    <a href="/">Retour au site</a>
  </form>
<script>
  const f = document.getElementById('f')
  const e = document.getElementById('e')
  const champ = document.getElementById('mdp')
  f.addEventListener('submit', async (ev) => {
    ev.preventDefault()
    const bouton = f.querySelector('button')
    bouton.disabled = true
    e.hidden = true
    try {
      const r = await fetch('/api/admin/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motDePasse: champ.value }),
      })
      if (r.ok) { location.replace('/admin'); return }
      const d = await r.json().catch(() => ({}))
      e.textContent = d.message || 'Connexion refusée.'
      e.hidden = false
      champ.select()
    } catch {
      e.textContent = 'Le serveur ne répond pas.'
      e.hidden = false
    }
    bouton.disabled = false
  })
</script>
</body>
</html>`
}
