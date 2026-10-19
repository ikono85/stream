import type { Entry, Progress } from '@/types'

/**
 * Recommendations from what this profile has actually done: genres saved to
 * the list, genres of things started. No signal yet means no pretending —
 * the caller shows the best-rated titles instead.
 */
export function recommend(
  catalog: Entry[],
  myList: string[],
  progress: Progress[],
  limit = 14,
): { items: Entry[]; personal: boolean } {
  const seen = new Set<string>([...myList, ...progress.map((p) => p.entryId)])

  const weights = new Map<string, number>()
  for (const id of myList) {
    catalog.find((e) => e.id === id)?.genres.forEach((g) => weights.set(g, (weights.get(g) ?? 0) + 2))
  }
  for (const p of progress) {
    catalog.find((e) => e.id === p.entryId)?.genres.forEach((g) => weights.set(g, (weights.get(g) ?? 0) + 1))
  }

  if (weights.size === 0) {
    return {
      items: [...catalog].sort((a, b) => b.rating - a.rating).slice(0, limit),
      personal: false,
    }
  }

  const scored = catalog
    .filter((e) => !seen.has(e.id))
    .map((e) => ({
      entry: e,
      score: e.genres.reduce((sum, g) => sum + (weights.get(g) ?? 0), 0) + e.rating / 10,
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)

  return { items: scored.slice(0, limit).map(({ entry }) => entry), personal: true }
}
