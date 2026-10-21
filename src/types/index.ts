/**
 * LE MODÈLE
 * =========
 * Tout vient de HeiwaStream, et les types suivent ce que l'API dit vraiment.
 * Deux appels nourrissent une entrée :
 *
 *   /catalog/{famille}        titre, année, langues, qualité, identifiants
 *   /media/{type}/{tmdb}      affiche, fond, logo, résumé, genres, note…
 *
 * Le second est facultatif : le proxy n'enrichit que les premières entrées
 * d'une page. Les champs qu'il apporte sont donc tous optionnels, et
 * l'interface sait se passer de chacun — un titre sans affiche reçoit celle
 * que lib/poster dessine, un titre sans résumé n'affiche pas de résumé.
 *
 * Ce que l'API ne donne pas, et qui a donc disparu du modèle : la
 * distribution, la réalisation, le studio, les sagas. Aucune route ne les
 * expose ; les inventer serait mentir.
 */

/** Film ou série, le vocabulaire de l'interface. */
export type Kind = 'film' | 'serie'

/** Le segment que l'API attend pour une fiche : elle ne connaît que ces deux. */
export type MediaType = 'movie' | 'tv'

/**
 * Les trois rayons du catalogue. `anime` n'est pas un type à part pour l'API
 * — c'est une série — mais `/catalog/anime` existe et ne renvoie que ceux-là.
 */
export type Famille = 'movie' | 'tv' | 'anime'

/** Ce que l'API classe sous `kind`. */
export type Categorie = 'movie' | 'series' | 'anime'

/** Les pistes annoncées par l'API, dans son orthographe. */
export type Langue = 'VF' | 'VFSTFR' | 'VOSTFR' | 'VO'

/** Ordres acceptés par /catalog. */
export type SortKey = 'popular' | 'added' | 'rating'

/** Identifiants croisés, tels que l'API les renvoie. */
export interface Ids {
  tmdb: number
  imdb?: string | null
  tvdb?: number | null
  mal?: number | null
  anilist?: number | null
}

/** Une saison, vue de la fiche : ce qu'il faut pour un sélecteur. */
export interface SeasonSummary {
  number: number
  episodeCount: number
  year: number | null
  /** Image de saison, chemin TMDB — voir lib/images. */
  stillPath: string | null
  name: string | null
  recent: boolean
}

/** Le détail d'une langue pour un titre ou un épisode. */
export interface Version {
  language: Langue
  quality: string | null
  sources: number
  qualities: Record<string, number>
}

/** Un épisode, tel que /tv/{tmdb} le décrit. */
export interface Episode {
  /** `tv-1399-s1e2`, construit par nous : l'API numérote, elle n'identifie pas. */
  id: string
  season: number
  number: number
  title: string
  airDate: string | null
  languages: Langue[]
  quality: string | null
  /** Nombre de liens en service. Zéro signifie « pas encore disponible ». */
  sources: number
  versions: Version[]
}

export interface Season {
  number: number
  episodes: Episode[]
}

/**
 * Un titre. `id` est de la forme `movie-603` ou `tv-1399` : l'API n'a pas
 * d'identifiant propre, et le couple type + TMDB est ce qui désigne un titre
 * de façon stable dans une URL comme dans « ma liste ».
 */
export interface Entry {
  id: string
  type: MediaType
  tmdb: number
  kind: Kind
  categorie: Categorie
  title: string
  year: number
  ids: Ids
  languages: Langue[]
  /** Meilleure définition mesurée, « 1080p », « 4K »… Null si inconnue. */
  quality: string | null

  /* ---- ce que la fiche /media ajoute, quand elle a été demandée ---- */

  /** Chemins TMDB, pas des URL : lib/images les assemble. */
  posterPath?: string | null
  backdropPath?: string | null
  logoPath?: string | null
  synopsis?: string
  tagline?: string
  genres?: string[]
  /** Sur 10. */
  rating?: number
  /** Films, en minutes. */
  runtime?: number
  seasons?: SeasonSummary[]
  /** Clé YouTube de la bande-annonce. Jamais une source de lecture. */
  trailer?: string
  /**
   * Le prochain épisode attendu d'une série en cours, quand l'API en connaît
   * un. Absent pour un film et pour une série terminée.
   */
  nextEpisode?: { season: number; episode: number; name: string | null; airDate: string | null }

  /* ---- selon la liste d'où le titre vient ---- */

  /** Rang, dans le classement uniquement. */
  rank?: number
  /** Date d'ajout, dans les nouveautés uniquement. */
  addedAt?: string
  /** Saison et épisode ajoutés, dans les nouveautés d'une série. */
  addedEpisode?: { season: number; episode: number }
}

/** Une sortie attendue, pour le calendrier. */
export interface Upcoming {
  id: string
  type: MediaType
  tmdb: number
  title: string
  season: number
  episode: number
  episodeTitle: string
  date: string
}

/**
 * Où un spectateur en est.
 *
 * `duration` à zéro signifie « lancé, position inconnue » : c'est le cas
 * normal avec le lecteur HeiwaStream, qui ne rapporte rien. On sait alors
 * quel titre et quel épisode ont été lancés, et quand — ce qui suffit à
 * reprendre une série au bon endroit, mais pas à afficher une barre de
 * progression. L'interface s'en tient à ce qu'elle sait.
 */
export interface Progress {
  entryId: string
  /** Identifiant d'épisode pour une série, absent pour un film. */
  episodeId?: string
  seconds: number
  /** Zéro quand la durée n'est pas connue — voir ci-dessus. */
  duration: number
  updatedAt: number
}

export interface Profile {
  id: string
  name: string
  /** Index dans la palette de teintes des profils. */
  tint: number
}
