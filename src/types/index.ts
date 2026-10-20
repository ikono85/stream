export type Kind = 'film' | 'serie'

export type SortKey = 'popularite' | 'recent' | 'annee' | 'note' | 'alpha'

/** One playable rendition. Several of these enable the quality picker. */
export interface Source {
  /** Absolute URL, or a path served from /public. */
  src: string
  /** MIME type — 'video/mp4', 'application/vnd.apple.mpegurl' for HLS. */
  type: string
  /** Shown in the quality menu. Omit if there is only one rendition. */
  quality?: string
}

export interface Subtitle {
  src: string
  /** BCP-47 tag, e.g. 'fr'. */
  lang: string
  label: string
  default?: boolean
}

export interface Episode {
  id: string
  number: number
  title: string
  synopsis: string
  runtime: number
  sources: Source[]
  subtitles?: Subtitle[]
}

export interface Season {
  number: number
  episodes: Episode[]
}

/** A credited person, with a portrait when the source provides one. */
export interface Person {
  name: string
  /** Role played, when known. */
  character?: string
  /** Portrait URL, same 2:3 shape as a poster. */
  photo?: string
}

export interface Entry {
  id: string
  kind: Kind
  title: string
  year: number
  synopsis: string
  genres: string[]
  /** Out of 10. */
  rating: number
  cast: string[]
  /**
   * Billed cast with portraits and roles, when a source provides them.
   * `cast` above remains the plain-text fallback, and the one search reads.
   */
  people?: Person[]
  /**
   * YouTube key of a trailer. Not a source: it plays in an overlay on the
   * detail page, never in the player.
   */
  trailer?: string
  director: string
  /** Production studio, when the source names one. Anime mostly. */
  studio?: string
  /** Films only, in minutes. */
  runtime?: number
  /** Series only. */
  seasons?: Season[]
  /**
   * How many episodes a series has, when a source knows the number but not
   * the episodes themselves. MyAnimeList is like that. Showing the count is
   * honest; inventing a thousand rows of "Épisode 417" would not be.
   */
  episodeCount?: number
  /**
   * Where a title comes from, when the import knows it. Deliberately not a
   * `kind`: an anime is a film or a series like any other, and making it a
   * third kind would mean a title that is neither — with no runtime and no
   * seasons. Origin is its own axis, and the filters treat it as one.
   */
  origine?: 'anime'
  /** Films only. Empty means no source is configured yet. */
  sources?: Source[]
  subtitles?: Subtitle[]
  /** Override the generated artwork with your own image URL. */
  artwork?: string
  backdrop?: string
  /**
   * Title treatment — the film's own lettering on transparency. Shown in the
   * hero in place of the typeset title when a source provides one.
   */
  logo?: string
  /**
   * The series of films this one belongs to — Avengers, Harry Potter. Comes
   * from TMDB's collection; drives the saga row on the detail page.
   */
  collection?: { id: number; name: string }
  /**
   * Optional muted loop behind the hero. Only ever loaded on a wide screen,
   * with motion allowed and data saving off — see Hero.
   */
  heroVideo?: string
  addedAt: string
  popularity: number
  /** Licence of the actual video, when one is attached. Shown on the detail page. */
  license?: string
  /** Attribution line required by that licence. */
  attribution?: string
  /**
   * True for the invented catalogue shipped with the project. Nothing marked
   * demo describes a real film — the interface says so wherever it matters.
   */
  demo: boolean
}

/** Where a viewer stopped. */
export interface Progress {
  entryId: string
  /** Episode id for series, undefined for films. */
  episodeId?: string
  seconds: number
  duration: number
  updatedAt: number
}

export interface Profile {
  id: string
  name: string
  /** Index into the profile colour ramp. */
  tint: number
}
