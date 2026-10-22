import { store } from '@/lib/storage'
import type { Progress } from '@/types'

/**
 * REPRENDRE CE QU'ON AVAIT AVANT DE S'INSCRIRE
 * ============================================
 * Le site est ouvert : on s'en sert, on se constitue une liste, et elle vit
 * dans le navigateur. Créer un compte ensuite faisait repartir de zéro —
 * un défaut discret et agaçant, le genre qui fait renoncer à s'inscrire.
 *
 * Ces deux fonctions regardent ce que le navigateur garde, et le versent
 * dans le compte si la personne le demande. Rien n'est effacé localement :
 * en cas de doute, on peut revenir en arrière en se déconnectant.
 */

export interface ContenuLocal {
  episodesVus?: string[]
  maListe: string[]
  progression: Progress[]
}

/**
 * Ce que ce navigateur garde, tous profils confondus.
 *
 * Tous, parce que les profils locaux ne sont plus visibles depuis l'arrivée
 * des comptes : quelqu'un qui en avait créé plusieurs ne doit pas perdre ce
 * qui se trouvait dans celui qu'il ne voit plus.
 */
export async function contenuLocal(): Promise<ContenuLocal> {
  try {
    const profils = await store.listProfiles()
    const listes = await Promise.all(profils.map((p) => store.getMyList(p.id)))
    const progressions = await Promise.all(profils.map((p) => store.getProgress(p.id)))
    const vus = await Promise.all(profils.map((p) => store.getWatched(p.id)))

    const maListe = [...new Set(listes.flat())]

    /* Une seule entrée par titre et par épisode, la plus récente. */
    const parCle = new Map<string, Progress>()
    for (const p of progressions.flat()) {
      const cle = `${p.entryId}:${p.episodeId ?? ''}`
      const connue = parCle.get(cle)
      if (!connue || p.updatedAt > connue.updatedAt) parCle.set(cle, p)
    }

    return { maListe, progression: [...parCle.values()], episodesVus: [...new Set(vus.flat())] }
  } catch {
    /* Stockage bloqué ou navigation privée : il n'y a simplement rien à
       reprendre, et ce n'est pas une erreur. */
    return { maListe: [], progression: [] }
  }
}

/** Y a-t-il quelque chose à proposer ? */
export function vautLaPeine(contenu: ContenuLocal): boolean {
  return contenu.maListe.length > 0 || contenu.progression.length > 0 || Boolean(contenu.episodesVus?.length)
}

async function envoie(chemin: string, corps: unknown): Promise<void> {
  const reponse = await fetch(`/api/bibliotheque${chemin}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corps),
  })
  if (!reponse.ok) throw new Error('La sauvegarde a échoué. Réessayez ; vos données locales sont conservées.')
}

/**
 * Verse le contenu local dans le compte connecté. Fusionne plutôt que
 * remplace : un compte qui avait déjà une liste ne la perd pas.
 *
 * Renvoie ce qui a été ajouté, pour pouvoir le dire à la personne.
 */
export async function verseDansLeCompte(contenu: ContenuLocal): Promise<{ titres: number; reprises: number }> {
  const reponse = await fetch('/api/bibliotheque')
  if (!reponse.ok) throw new Error('Impossible de lire votre bibliothèque. Réessayez avant de l’importer.')
  const actuel = (await reponse.json()) as ContenuLocal

  const listeFusionnee = [...new Set([...actuel.maListe, ...contenu.maListe])]
  const ajoutes = listeFusionnee.length - actuel.maListe.length
  if (ajoutes > 0) await envoie('/liste', { ids: listeFusionnee })

  /* Les reprises partent une par une : la route les range et les plafonne
     elle-même, et on ne veut pas écraser celles du compte. */
  const deja = new Set(actuel.progression.map((p) => `${p.entryId}:${p.episodeId ?? ''}`))
  let reprises = 0
  for (const p of contenu.progression) {
    if (deja.has(`${p.entryId}:${p.episodeId ?? ''}`)) continue
    await envoie('/progression', p)
    reprises += 1
  }

  const vus = new Set(actuel.episodesVus ?? [])
  for (const episodeId of contenu.episodesVus ?? []) {
    if (!vus.has(episodeId)) await envoie('/episodes-vus', { episodeId, vu: true })
  }
  return { titres: ajoutes, reprises }
}
