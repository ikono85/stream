/**
 * LE CLIENT HEIWASTREAM
 * =====================
 * Une fonction par route, et rien d'autre dans l'application ne connaît la
 * forme des réponses. Les appels partent vers /api/hs, le proxy du projet :
 * l'API refuse les appels navigateur et la clé reste côté serveur — voir
 * server/heiwa.mjs.
 *
 * Le paramètre `rich` n'existe pas chez HeiwaStream : il demande au proxy de
 * compléter les entrées d'une liste avec leur fiche /media (affiche, résumé,
 * genres). Sans lui, une liste revient nue, ce qui suffit pour un compte ou
 * une vérification de disponibilité.
 */

import type {
  Categorie, Entry, Episode, Famille, Ids, Langue, MediaType,
  Season, SeasonSummary, SortKey, Upcoming, Version,
} from '@/types'

/* ---------- l'erreur que l'interface sait montrer ---------- */

/** Codes que l'API documente, plus les nôtres. */
export type CodeErreur =
  | 'invalid_parameter' | 'key_required' | 'key_suspended' | 'address_banned'
  | 'not_found' | 'rate_limited' | 'unavailable' | 'maintenance'
  | 'key_missing' | 'injoignable' | 'route_inconnue' | 'reponse_illisible'

export class ErreurHeiwa extends Error {
  readonly statut: number
  readonly code: CodeErreur | string

  constructor(statut: number, code: string, message: string) {
    super(message)
    this.name = 'ErreurHeiwa'
    this.statut = statut
    this.code = code
  }

  /** Une phrase affichable, en français, pour chaque cas prévu. */
  get explication(): string {
    switch (this.code) {
      case 'key_missing':
        return "La clé de l'API n'est pas configurée. Copiez .env.example en .env et renseignez HEIWA_KEY."
      case 'key_required':
        return "La clé est absente ou inconnue du serveur HeiwaStream."
      case 'key_suspended':
        return 'Cette clé est suspendue.'
      case 'address_banned':
        return "Cette connexion n'a plus accès à l'API."
      case 'not_found':
        return "Ce titre n'est pas au catalogue."
      case 'rate_limited':
        return 'Trop de requêtes pour le moment. Réessayez dans un instant.'
      case 'unavailable':
      case 'maintenance':
        return 'HeiwaStream est momentanément indisponible.'
      case 'injoignable':
        return "Le serveur n'arrive pas à joindre HeiwaStream."
      default:
        return this.message || "La requête n'a pas abouti."
    }
  }
}

/* ---------- l'appel ---------- */

const BASE = '/api/hs'

interface Params {
  [cle: string]: string | number | boolean | null | undefined
}

function requete(params: Params = {}): string {
  const url = new URLSearchParams()
  for (const [cle, valeur] of Object.entries(params)) {
    if (valeur === null || valeur === undefined || valeur === '') continue
    url.set(cle, String(valeur))
  }
  const texte = url.toString()
  return texte ? `?${texte}` : ''
}

async function demande<T>(chemin: string, params: Params = {}, signal?: AbortSignal): Promise<T> {
  let reponse: Response
  try {
    reponse = await fetch(`${BASE}/${chemin}${requete(params)}`, {
      signal,
      headers: { Accept: 'application/json' },
    })
  } catch (erreur) {
    /* Une annulation n'est pas une panne : elle remonte telle quelle pour que
       l'appelant la distingue et ne l'affiche pas. */
    if (erreur instanceof DOMException && erreur.name === 'AbortError') throw erreur
    throw new ErreurHeiwa(0, 'injoignable', "Le serveur du site ne répond pas.")
  }

  const corps: unknown = await reponse.json().catch(() => null)

  if (!reponse.ok) {
    const details = (corps ?? {}) as { error?: string; message?: string }
    throw new ErreurHeiwa(
      reponse.status,
      details.error ?? 'unavailable',
      details.message ?? `La requête a échoué (${reponse.status}).`,
    )
  }

  return corps as T
}

/* ---------- ce que l'API renvoie, mot pour mot ---------- */

interface ItemBrut {
  type: MediaType
  tmdb: number
  title: string
  year?: number
  kind?: Categorie
  ids?: Ids
  languages?: Langue[]
  quality?: string | null
  rank?: number
  at?: string
  season?: number
  episode?: number
  /* Ajoutés par le proxy depuis /media — voir server/heiwa.mjs. */
  posterPath?: string | null
  backdropPath?: string | null
  logoPath?: string | null
  overview?: string
  tagline?: string
  genres?: string[]
  voteAverage?: number | null
  runtime?: number | null
  releaseYear?: number
  seasons?: SaisonBrute[]
  youtubeId?: string | null
  contentType?: Categorie
  nextEpisode?: ProchainBrut | null
}

interface ProchainBrut {
  seasonNumber: number
  episodeNumber: number
  name: string | null
  airDate: string | null
}

interface SaisonBrute {
  seasonNumber: number
  episodeCount: number
  year: number | null
  stillPath: string | null
  recent: boolean
  name: string | null
}

interface FicheBrute {
  tmdbId: number
  mediaType: MediaType
  title: string
  posterPath: string | null
  backdropPath: string | null
  logoPath: string | null
  releaseYear: number
  voteAverage: number | null
  contentType: Categorie
  genres: string[]
  overview: string
  tagline: string | null
  releaseDate: string | null
  runtime: number | null
  seasons: SaisonBrute[]
  languages: Langue[]
  youtubeId: string | null
  hauteQualite: boolean
  hasLinks: boolean
  nextEpisode: ProchainBrut | null
}

interface ListeBrute {
  page?: number
  pages?: number
  total?: number
  results?: ItemBrut[]
  items?: ItemBrut[]
  until?: string
  period?: string
  query?: string
}

interface EpisodeBrut {
  episode: number
  title: string
  air_date: string | null
  languages: Langue[]
  quality: string | null
  sources: number
  versions: Version[]
}

interface SerieBrute {
  tmdb: number
  title: string
  ids: Ids
  seasons: { season: number; episodes: EpisodeBrut[] }[]
}

interface DisponibiliteBrute {
  type: MediaType
  tmdb: number
  season?: number
  episode?: number
  available: boolean
  ids?: Ids
  languages: Langue[]
  quality: string | null
  sources: number
  versions: Version[]
  embed?: string
}

interface CalendrierBrut {
  from: string
  to: string
  results: {
    type: MediaType
    tmdb: number
    title: string
    season: number
    episode: number
    episode_title: string
    date: string
  }[]
}

/* ---------- traduction vers le modèle ---------- */

/** `movie-603`, `tv-1399` : ce qui désigne un titre dans une URL. */
export function entryId(type: MediaType, tmdb: number): string {
  return `${type}-${tmdb}`
}

/** L'inverse. Renvoie null sur une adresse qui ne veut rien dire. */
export function lisEntryId(id: string): { type: MediaType; tmdb: number } | null {
  const m = /^(movie|tv)-(\d+)$/.exec(id)
  if (!m) return null
  return { type: m[1] as MediaType, tmdb: Number(m[2]) }
}


/** `nextEpisode` de l'API vers le vocabulaire du modèle. */
function prochain(brut: ProchainBrut | null | undefined): Entry['nextEpisode'] {
  if (!brut || typeof brut.seasonNumber !== 'number') return undefined
  return {
    season: brut.seasonNumber,
    episode: brut.episodeNumber,
    name: brut.name,
    airDate: brut.airDate,
  }
}

function saison(brute: SaisonBrute): SeasonSummary {
  return {
    number: brute.seasonNumber,
    episodeCount: brute.episodeCount,
    year: brute.year,
    stillPath: brute.stillPath,
    name: brute.name,
    recent: brute.recent,
  }
}

/**
 * Un film est un film ; tout le reste se regarde épisode par épisode. L'API
 * dit `movie` / `series` / `anime` sous `kind`, et `movie` / `tv` sous
 * `type` : c'est ce dernier qui décide de la forme.
 */
function versEntry(brut: ItemBrut): Entry {
  const type: MediaType = brut.type === 'movie' ? 'movie' : 'tv'
  const categorie: Categorie = brut.kind ?? brut.contentType ?? (type === 'movie' ? 'movie' : 'series')

  const entree: Entry = {
    id: entryId(type, brut.tmdb),
    type,
    tmdb: brut.tmdb,
    kind: type === 'movie' ? 'film' : 'serie',
    categorie,
    title: brut.title,
    year: brut.year ?? brut.releaseYear ?? 0,
    ids: brut.ids ?? { tmdb: brut.tmdb },
    languages: brut.languages ?? [],
    quality: brut.quality ?? null,
  }

  /* Les champs d'enrichissement n'apparaissent que si le proxy les a joints :
     une propriété définie mais vide ferait afficher un résumé blanc. */
  if (brut.posterPath) entree.posterPath = brut.posterPath
  if (brut.backdropPath) entree.backdropPath = brut.backdropPath
  if (brut.logoPath) entree.logoPath = brut.logoPath
  if (brut.overview) entree.synopsis = brut.overview
  if (brut.tagline) entree.tagline = brut.tagline
  if (brut.genres?.length) entree.genres = brut.genres
  if (typeof brut.voteAverage === 'number') entree.rating = brut.voteAverage
  if (typeof brut.runtime === 'number' && brut.runtime > 0) entree.runtime = brut.runtime
  if (brut.seasons?.length) entree.seasons = brut.seasons.map(saison)
  if (brut.youtubeId) entree.trailer = brut.youtubeId
  const suite = prochain(brut.nextEpisode)
  if (suite) entree.nextEpisode = suite
  if (typeof brut.rank === 'number') entree.rank = brut.rank
  if (brut.at) entree.addedAt = brut.at
  if (typeof brut.season === 'number' && typeof brut.episode === 'number') {
    entree.addedEpisode = { season: brut.season, episode: brut.episode }
  }

  return entree
}

function versEntryDepuisFiche(brute: FicheBrute): Entry {
  const type: MediaType = brute.mediaType === 'movie' ? 'movie' : 'tv'
  const entree: Entry = {
    id: entryId(type, brute.tmdbId),
    type,
    tmdb: brute.tmdbId,
    kind: type === 'movie' ? 'film' : 'serie',
    categorie: brute.contentType ?? (type === 'movie' ? 'movie' : 'series'),
    title: brute.title,
    year: brute.releaseYear ?? 0,
    ids: { tmdb: brute.tmdbId },
    languages: brute.languages ?? [],
    quality: brute.hauteQualite ? '1080p' : null,
  }

  if (brute.posterPath) entree.posterPath = brute.posterPath
  if (brute.backdropPath) entree.backdropPath = brute.backdropPath
  if (brute.logoPath) entree.logoPath = brute.logoPath
  if (brute.overview) entree.synopsis = brute.overview
  if (brute.tagline) entree.tagline = brute.tagline
  if (brute.genres?.length) entree.genres = brute.genres
  if (typeof brute.voteAverage === 'number') entree.rating = brute.voteAverage
  if (typeof brute.runtime === 'number' && brute.runtime > 0) entree.runtime = brute.runtime
  if (brute.seasons?.length) entree.seasons = brute.seasons.map(saison)
  if (brute.youtubeId) entree.trailer = brute.youtubeId
  const suite = prochain(brute.nextEpisode)
  if (suite) entree.nextEpisode = suite

  return entree
}

function liste(brute: ListeBrute): Entry[] {
  const items = brute.results ?? brute.items ?? []
  return items.map(versEntry)
}

/* ---------- les routes ---------- */

export interface Page {
  entries: Entry[]
  page: number
  pages: number
  total: number
}

export interface FiltresCatalogue {
  famille?: Famille
  genre?: string
  /** Une année, ou un intervalle : `2024`, `2020-2026`. */
  year?: string
  lang?: 'vf' | 'vostfr' | 'vo'
  quality?: '4k' | '1080p' | '720p' | '480p'
  /** Note minimale sur 10. */
  rating?: number
  platform?: string
  sort?: SortKey
  page?: number
  /** Nombre de fiches détaillées à joindre. 0 pour une liste nue. */
  rich?: number
}

/**
 * Le catalogue. La famille est un segment de chemin, pas un paramètre :
 * `/catalog?type=movie` est accepté puis ignoré par l'API, ce qui renvoie
 * silencieusement tout le catalogue. Un détail qui coûte une demi-journée à
 * qui ne l'a pas vu.
 *
 * Vingt pages de cinquante titres au plus, soit mille par jeu de filtres :
 * au-delà, l'API demande de resserrer.
 */
export async function catalogue(filtres: FiltresCatalogue = {}, signal?: AbortSignal): Promise<Page> {
  const { famille, rich = 24, ...reste } = filtres
  const chemin = famille ? `catalog/${famille}` : 'catalog'
  const brute = await demande<ListeBrute>(chemin, { ...reste, rich: rich > 0 ? rich : undefined }, signal)
  return {
    entries: liste(brute),
    page: brute.page ?? 1,
    pages: brute.pages ?? 1,
    total: brute.total ?? 0,
  }
}

/** La fiche complète d'un titre : c'est elle qui porte les visuels. */
export async function fiche(type: MediaType, tmdb: number, signal?: AbortSignal): Promise<Entry> {
  const brute = await demande<FicheBrute>(`media/${type}/${tmdb}`, {}, signal)
  return versEntryDepuisFiche(brute)
}

/** « Dans le même esprit » : l'API les choisit, visuels compris. */
export async function semblables(type: MediaType, tmdb: number, signal?: AbortSignal): Promise<Entry[]> {
  const brute = await demande<ListeBrute>(`media/${type}/${tmdb}/similar`, {}, signal)
  return liste(brute)
}

/**
 * Les saisons et les épisodes d'une série, avec le nombre de liens par
 * épisode : c'est ce nombre, et lui seul, qui dit si un épisode se regarde.
 */
export async function episodes(tmdb: number, saisonVoulue?: number, signal?: AbortSignal): Promise<Season[]> {
  const chemin = saisonVoulue ? `tv/${tmdb}/${saisonVoulue}` : `tv/${tmdb}`
  const brute = await demande<SerieBrute>(chemin, {}, signal)
  return (brute.seasons ?? []).map((s) => ({
    number: s.season,
    episodes: (s.episodes ?? []).map<Episode>((ep) => ({
      id: `tv-${tmdb}-s${s.season}e${ep.episode}`,
      season: s.season,
      number: ep.episode,
      title: ep.title,
      airDate: ep.air_date,
      languages: ep.languages ?? [],
      quality: ep.quality,
      sources: ep.sources ?? 0,
      versions: ep.versions ?? [],
    })),
  }))
}

export interface OptionsRecherche {
  type?: MediaType
  year?: number
  lang?: 'vf' | 'vostfr' | 'vo'
  quality?: '1080p' | '720p' | '480p'
  /** Vingt au plus, selon l'API. */
  limit?: number
  rich?: number
}

/** Recherche par titre. Deux caractères au minimum, l'API refuse en dessous. */
export async function recherche(titre: string, options: OptionsRecherche = {}, signal?: AbortSignal): Promise<Entry[]> {
  const terme = titre.trim()
  if (terme.length < 2) return []
  const { rich = 0, ...reste } = options
  const brute = await demande<ListeBrute>(
    `find/${encodeURIComponent(terme)}`,
    { ...reste, rich: rich > 0 ? rich : undefined },
    signal,
  )
  return liste(brute)
}

/** Les cinquante derniers ajouts. Un épisode ajouté y figure comme tel. */
export async function nouveautes(
  options: { famille?: 'movie' | 'tv'; lang?: string; since?: string; rich?: number } = {},
  signal?: AbortSignal,
): Promise<Entry[]> {
  const { famille, rich = 24, ...reste } = options
  const chemin = famille ? `news/${famille}` : 'news'
  const brute = await demande<ListeBrute>(chemin, { ...reste, rich: rich > 0 ? rich : undefined }, signal)
  return liste(brute)
}

/** Les cinquante titres les plus regardés. */
export async function classement(
  options: { famille?: 'movie' | 'tv'; period?: 'week' | 'month'; rich?: number } = {},
  signal?: AbortSignal,
): Promise<Entry[]> {
  const { famille, rich = 24, ...reste } = options
  const chemin = famille ? `top/${famille}` : 'top'
  const brute = await demande<ListeBrute>(chemin, { ...reste, rich: rich > 0 ? rich : undefined }, signal)
  return liste(brute)
}

/** La fenêtre que l'API accepte, en jours. Au-delà, elle répond 400. */
export const CALENDRIER_MAX_JOURS = 31

/**
 * Les épisodes attendus. Sept jours par défaut, trente et un au plus — la
 * borne est vérifiée ici plutôt que subie : un intervalle trop large renvoie
 * `invalid_parameter`, ce qui n'apprend rien à personne.
 */
export async function calendrier(
  options: { from?: string; to?: string } = {},
  signal?: AbortSignal,
): Promise<Upcoming[]> {
  if (options.from && options.to) {
    const jours = (Date.parse(options.to) - Date.parse(options.from)) / 86400000
    if (jours > CALENDRIER_MAX_JOURS) {
      throw new ErreurHeiwa(400, 'invalid_parameter',
        `L'API ne couvre que ${CALENDRIER_MAX_JOURS} jours à la fois.`)
    }
  }
  const brute = await demande<CalendrierBrut>('calendar', options, signal)
  return (brute.results ?? []).map((item) => ({
    id: entryId(item.type, item.tmdb),
    type: item.type,
    tmdb: item.tmdb,
    title: item.title,
    season: item.season,
    episode: item.episode,
    episodeTitle: item.episode_title,
    date: item.date,
  }))
}

export interface Disponibilite {
  available: boolean
  languages: Langue[]
  quality: string | null
  sources: number
  versions: Version[]
  /** L'adresse du lecteur HeiwaStream, quand le titre est disponible. */
  embed: string | null
}

/**
 * Est-ce que ça se regarde, dans quelles langues, en quelle qualité. Pour un
 * épisode, la saison et le numéro s'ajoutent au chemin.
 */
export async function disponibilite(
  type: MediaType,
  tmdb: number,
  saisonVoulue?: number,
  episode?: number,
  signal?: AbortSignal,
): Promise<Disponibilite> {
  const suite = saisonVoulue && episode ? `/${saisonVoulue}/${episode}` : saisonVoulue ? `/${saisonVoulue}` : ''
  const brute = await demande<DisponibiliteBrute>(`available/${type}/${tmdb}${suite}`, {}, signal)
  return {
    available: brute.available,
    languages: brute.languages ?? [],
    quality: brute.quality,
    sources: brute.sources ?? 0,
    versions: brute.versions ?? [],
    embed: brute.embed ?? null,
  }
}

/* ---------- le lecteur ---------- */

export interface OptionsLecteur {
  /** Démarre sur cette piste. */
  lang?: 'vf' | 'vostfr'
  /** Démarre sans attendre un clic. */
  autoplay?: boolean
  /** Démarre muet — nécessaire pour que `autoplay` passe sur certains navigateurs. */
  muted?: boolean
}

/**
 * L'adresse du lecteur HeiwaStream pour un titre ou un épisode.
 *
 * C'est la seule façon de lire : l'API ne donne jamais d'URL de fichier. Le
 * lecteur vit donc dans une iframe, et dialogue avec la page par
 * postMessage — voir player/Embed.
 */
export function urlLecteur(
  type: MediaType,
  tmdb: number,
  episode?: { season: number; number: number },
  options: OptionsLecteur = {},
): string {
  const suite = type === 'tv' && episode
    ? `/${String(episode.season).padStart(2, '0')}/${String(episode.number).padStart(2, '0')}`
    : ''
  const params = new URLSearchParams()
  if (options.lang) params.set('lang', options.lang)
  if (options.autoplay) params.set('autoplay', '1')
  if (options.muted) params.set('muted', '1')
  const requeteLecteur = params.toString()
  return `https://heiwastream.fr/embed/${type}/${tmdb}${suite}${requeteLecteur ? `?${requeteLecteur}` : ''}`
}

/** L'origine d'où viennent les messages du lecteur, et à qui les envoyer. */
export const ORIGINE_LECTEUR = 'https://heiwastream.fr'

/**
 * Les fiches de plusieurs titres, à partir de leurs identifiants internes.
 *
 * « Ma liste » et « Reprendre la lecture » ne gardent que des identifiants :
 * les titres eux-mêmes doivent être redemandés. Les fiches étant mises en
 * cache une semaine par le proxy, c'est gratuit après la première fois. Une
 * fiche introuvable est écartée plutôt que de faire échouer la page entière :
 * un titre retiré du catalogue ne doit pas vider la liste.
 */
export async function fichesDe(ids: readonly string[], signal?: AbortSignal): Promise<Entry[]> {
  const resultats = await Promise.all(ids.map(async (id) => {
    const lu = lisEntryId(id)
    if (!lu) return null
    try {
      return await fiche(lu.type, lu.tmdb, signal)
    } catch (erreur) {
      if (erreur instanceof DOMException && erreur.name === 'AbortError') throw erreur
      return null
    }
  }))
  return resultats.filter((e): e is Entry => e !== null)
}

/**
 * `tv-1399-s1e2` → la série, la saison, l'épisode.
 *
 * L'API numérote les épisodes mais ne les identifie pas : cet identifiant est
 * construit par nous, et c'est lui qui voyage dans les URL de lecture et dans
 * les positions enregistrées. Null quand la forme ne correspond pas.
 */
export function lisEpisodeId(id: string): { tmdb: number; season: number; number: number } | null {
  const m = /^tv-(\d+)-s(\d+)e(\d+)$/.exec(id)
  if (!m) return null
  return { tmdb: Number(m[1]), season: Number(m[2]), number: Number(m[3]) }
}

/** L'inverse, pour construire un identifiant d'épisode. */
export function episodeIdDe(tmdb: number, season: number, number: number): string {
  return `tv-${tmdb}-s${season}e${number}`
}
