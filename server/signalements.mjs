import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs'
import { resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { DONNEES, adresseVisible } from './securite.mjs'

const fichier = resolve(DONNEES, 'signalements.json')
const motifs = new Set(['lecture', 'langue', 'qualite', 'episode', 'autre'])
const limites = new Map()

export function listeSignalements() {
  if (!existsSync(fichier)) return []
  return JSON.parse(readFileSync(fichier, 'utf8'))
}

export function valideSignalement(corps) {
  if (!corps || typeof corps !== 'object' || !/^(movie|tv)-[1-9]\d{0,9}$/.test(corps.entryId)
    || !motifs.has(corps.motif) || typeof corps.titre !== 'string' || !corps.titre.trim() || corps.titre.length > 200
    || (corps.commentaire !== undefined && (typeof corps.commentaire !== 'string' || corps.commentaire.length > 1000))) return null
  if (corps.episodeId && (!corps.entryId.startsWith('tv-') || !new RegExp(`^${corps.entryId}-s\\d{1,3}e\\d{1,4}$`).test(corps.episodeId))) return null
  return { entryId: corps.entryId, titre: corps.titre.trim(), episodeId: corps.episodeId || null,
    motif: corps.motif, commentaire: (corps.commentaire ?? '').trim() }
}

export async function serviSignalement(req, res, litCorps) {
  const repond = (statut, corps) => {
    res.statusCode = statut
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Cache-Control', 'no-store')
    res.end(JSON.stringify(corps))
    return true
  }
  if (req.method !== 'POST') return repond(405, { message: 'Méthode non autorisée.' })
  const origin = req.headers.origin
  try {
    if ((origin && new URL(origin).host !== req.headers.host) || !String(req.headers['content-type']).startsWith('application/json')) return repond(403, { message: 'Requête non autorisée.' })
  } catch { return repond(403, { message: 'Requête non autorisée.' }) }
  const maintenant = Date.now()
  for (const [ip, valeur] of limites) if (valeur.fin <= maintenant) limites.delete(ip)
  const ip = adresseVisible(req)
  const limite = limites.get(ip) ?? { nombre: 0, fin: maintenant + 600_000 }
  if (limite.nombre >= 5 || limites.size > 10000) return repond(429, { message: 'Trop de signalements. Réessayez dans dix minutes.' })
  limite.nombre++
  limites.set(ip, limite)
  const donnees = valideSignalement(await litCorps(req, 8192))
  if (!donnees) return repond(400, { message: 'Vérifiez le motif et le commentaire (1 000 caractères maximum).' })
  try {
    const entrees = listeSignalements()
    const nouveau = { id: randomUUID(), a: new Date().toISOString(), ...donnees }
    mkdirSync(DONNEES, { recursive: true })
    writeFileSync(fichier + '.tmp', JSON.stringify([nouveau, ...entrees].slice(0, 2000)))
    renameSync(fichier + '.tmp', fichier)
    return repond(201, { ok: true })
  } catch { return repond(503, { message: 'Le signalement n’a pas pu être enregistré. Réessayez.' }) }
}
