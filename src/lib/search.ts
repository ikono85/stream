import { fold } from '@/lib/format'
import { hasVideo } from '@/lib/playable'
import type { Entry, Kind, SortKey } from '@/types'

export interface Filters {
  query: string
  kind: Kind | 'tout'
  genres: string[]
  decade: number | null
  /** Keep only titles with a source attached. */
  playable: boolean
  /**
   * 'anime' keeps only anime, 'autre' keeps everything else, null keeps all.
   *
   * The exclusion exists because an anime series is a series: without it, two
   * hundred imported anime bury the dozen series that are not, and the Séries
   * shelf stops meaning anything. The three menu entries are therefore
   * exclusive, while the catalogue as a whole still holds everything.
   */
  origine: 'anime' | 'autre' | null
  sort: SortKey
}

export const EMPTY_FILTERS: Filters = {
  query: '',
  kind: 'tout',
  genres: [],
  decade: null,
  playable: false,
  origine: null,
  sort: 'popularite',
}

/** Weighted match. Higher wins; 0 means the entry is out. */
function score(entry: Entry, q: string): number {
  const title = fold(entry.title)
  if (!q) return 1
  if (title === q) return 1000
  if (title.startsWith(q)) return 500
  if (title.includes(q)) return 300
  if (entry.cast.some((c) => fold(c).includes(q))) return 120
  if (fold(entry.director).includes(q)) return 110
  if (entry.genres.some((g) => fold(g).includes(q))) return 80
  if (fold(entry.synopsis).includes(q)) return 40
  return 0
}

const SORTERS: Record<SortKey, (a: Entry, b: Entry) => number> = {
  popularite: (a, b) => b.popularity - a.popularity,
  recent: (a, b) => b.addedAt.localeCompare(a.addedAt),
  annee: (a, b) => b.year - a.year || b.popularity - a.popularity,
  note: (a, b) => b.rating - a.rating,
  alpha: (a, b) => a.title.localeCompare(b.title, 'fr'),
}

export function applyFilters(catalog: Entry[], filters: Filters): Entry[] {
  const q = fold(filters.query)

  const matched = catalog
    .map((entry) => ({ entry, s: score(entry, q) }))
    .filter(({ entry, s }) => {
      if (s === 0) return false
      if (filters.kind !== 'tout' && entry.kind !== filters.kind) return false
      if (filters.genres.length && !filters.genres.some((g) => entry.genres.includes(g))) return false
      if (filters.playable && !hasVideo(entry)) return false
      if (filters.origine === 'anime' && entry.origine !== 'anime') return false
      if (filters.origine === 'autre' && entry.origine === 'anime') return false
      if (filters.decade !== null) {
        const d = Math.floor(entry.year / 10) * 10
        if (d !== filters.decade) return false
      }
      return true
    })

  /* A query orders by relevance; browsing orders by the chosen key. */
  if (q) matched.sort((a, b) => b.s - a.s || SORTERS[filters.sort](a.entry, b.entry))
  else matched.sort((a, b) => SORTERS[filters.sort](a.entry, b.entry))

  return matched.map(({ entry }) => entry)
}

/** Typeahead: the few best title matches, for the search overlay. */
export function suggest(catalog: Entry[], query: string, limit = 6): Entry[] {
  const q = fold(query)
  if (q.length < 1) return []
  return catalog
    .map((entry) => ({ entry, s: score(entry, q) }))
    .filter(({ s }) => s >= 40)
    .sort((a, b) => b.s - a.s || b.entry.popularity - a.entry.popularity)
    .slice(0, limit)
    .map(({ entry }) => entry)
}

export const DECADES = [2020, 2010, 2000, 1990] as const

export function filtersActive(f: Filters): number {
  return (f.kind !== 'tout' ? 1 : 0) + f.genres.length + (f.decade !== null ? 1 : 0) + (f.playable ? 1 : 0) + (f.origine ? 1 : 0)
}
