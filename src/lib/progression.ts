import type { Progress } from '@/types'

/** Une seule reprise par titre : l'épisode le plus récemment ouvert. */
export function reprisesParTitre(progress: Progress[]): Progress[] {
  const titres = new Map<string, Progress>()
  for (const p of [...progress].sort((a, b) => b.updatedAt - a.updatedAt)) {
    if (!titres.has(p.entryId)) titres.set(p.entryId, p)
  }
  return [...titres.values()]
}

/** Ouvrir une lecture met à jour sa date sans effacer sa position connue. */
export function lectureCommencee(entryId: string, episodeId: string | undefined, connue?: Progress): Progress {
  return {
    entryId, ...(episodeId ? { episodeId } : {}),
    seconds: connue?.seconds ?? 0,
    duration: connue?.duration ?? 0,
    updatedAt: Date.now(),
  }
}
