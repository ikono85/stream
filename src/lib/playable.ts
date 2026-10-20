import type { Entry, Episode } from '@/types'

/**
 * Whether a title can actually be watched, asked of an entry alone.
 *
 * This lives in lib rather than in the catalogue module because the search
 * filters need it too, and importing the catalogue from there would have the
 * two files reaching into each other. `@/data/catalog` re-exports both for
 * everything that already imports them from there.
 */

/** Every episode of a series, flattened in running order. */
export function episodesOf(entry: Entry): Episode[] {
  return entry.seasons?.flatMap((s) => s.episodes) ?? []
}

/** True when a film has a source, or a series has one anywhere. */
export function hasVideo(entry: Entry): boolean {
  if (entry.kind === 'film') return (entry.sources?.length ?? 0) > 0
  return episodesOf(entry).some((ep) => ep.sources.length > 0)
}
