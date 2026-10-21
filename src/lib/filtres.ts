/**
 * LES FILTRES, ENTRE L'URL ET L'API
 * =================================
 * La page Catalogue garde son état dans l'adresse : un lien partagé rouvre
 * exactement la même vue, et le bouton Retour fait ce qu'on attend. Ce
 * module est le seul endroit qui sache traduire dans les deux sens, entre
 * les paramètres d'URL — en français, lisibles — et ceux de l'API.
 *
 * Le tri et la pagination sont faits par l'API, pas ici : elle rend cinquante
 * titres par page sur quarante-huit mille. Trier côté navigateur ne trierait
 * qu'une page, ce qui serait faux.
 */

import type { Famille, SortKey } from '@/types'
import type { FiltresCatalogue } from '@/lib/heiwa'
import { genreFiltrable } from '@/lib/genres'
import { plateformeParId } from '@/lib/plateformes'

export type Rayon = Famille | 'tout'
export type Langue = 'vf' | 'vostfr' | 'vo'
export type Qualite = '4k' | '1080p' | '720p' | '480p'

export interface Filtres {
  /** Une recherche par titre : elle passe par /find, pas par /catalog. */
  query: string
  rayon: Rayon
  genre: string | null
  /** 2020 signifie « les années 2020 », traduit en intervalle pour l'API. */
  decennie: number | null
  langue: Langue | null
  qualite: Qualite | null
  /** Note minimale sur 10. */
  note: number | null
  /** Identifiant de plateforme — voir lib/plateformes. */
  plateforme: string | null
  sort: SortKey
  page: number
}

export const FILTRES_VIDES: Filtres = {
  query: '',
  rayon: 'tout',
  genre: null,
  decennie: null,
  langue: null,
  qualite: null,
  note: null,
  plateforme: null,
  sort: 'popular',
  page: 1,
}

export const TRIS: Record<SortKey, string> = {
  popular: 'Les plus regardés',
  added: 'Ajoutés récemment',
  rating: 'Les mieux notés',
}

export const RAYONS: { value: Rayon; label: string }[] = [
  { value: 'tout', label: 'Tout' },
  { value: 'movie', label: 'Films' },
  { value: 'tv', label: 'Séries' },
  { value: 'anime', label: 'Animés' },
]

export const DECENNIES = [2020, 2010, 2000, 1990, 1980] as const

export const LANGUES: { value: Langue; label: string }[] = [
  { value: 'vf', label: 'VF' },
  { value: 'vostfr', label: 'VOSTFR' },
  { value: 'vo', label: 'VO' },
]

export const QUALITES: Qualite[] = ['4k', '1080p', '720p', '480p']

/* ---------- l'URL vers les filtres ---------- */

/** Les noms de rayon dans l'adresse, pour qu'elle reste lisible. */
const RAYON_URL: Record<string, Rayon> = {
  film: 'movie',
  films: 'movie',
  serie: 'tv',
  series: 'tv',
  anime: 'anime',
  animes: 'anime',
}

const URL_RAYON: Record<Exclude<Rayon, 'tout'>, string> = {
  movie: 'film',
  tv: 'serie',
  anime: 'anime',
}

function nombre(brut: string | null, min: number, max: number): number | null {
  if (!brut) return null
  const valeur = Number(brut)
  if (!Number.isFinite(valeur) || valeur < min || valeur > max) return null
  return valeur
}

export function lisFiltres(params: URLSearchParams): Filtres {
  const rayonBrut = params.get('type')
  const langueBrute = params.get('langue')
  const qualiteBrute = params.get('qualite')
  const triBrut = params.get('tri')

  return {
    query: params.get('q')?.trim() ?? '',
    rayon: RAYON_URL[rayonBrut?.toLowerCase() ?? ''] ?? 'tout',
    genre: params.get('genre'),
    decennie: nombre(params.get('decennie'), 1900, 2100),
    langue: langueBrute && ['vf', 'vostfr', 'vo'].includes(langueBrute)
      ? (langueBrute as Langue)
      : null,
    qualite: qualiteBrute && (QUALITES as string[]).includes(qualiteBrute.toLowerCase())
      ? (qualiteBrute.toLowerCase() as Qualite)
      : null,
    note: nombre(params.get('note'), 0, 10),
    plateforme: plateformeParId(params.get('plateforme'))?.id ?? null,
    sort: triBrut && triBrut in TRIS ? (triBrut as SortKey) : 'popular',
    page: nombre(params.get('page'), 1, 20) ?? 1,
  }
}

/** Les filtres vers l'URL. Tout ce qui vaut le défaut est omis. */
export function ecrisFiltres(filtres: Filtres): URLSearchParams {
  const params = new URLSearchParams()
  if (filtres.query) params.set('q', filtres.query)
  if (filtres.rayon !== 'tout') params.set('type', URL_RAYON[filtres.rayon])
  if (filtres.genre) params.set('genre', filtres.genre)
  if (filtres.decennie !== null) params.set('decennie', String(filtres.decennie))
  if (filtres.langue) params.set('langue', filtres.langue)
  if (filtres.qualite) params.set('qualite', filtres.qualite)
  if (filtres.note !== null) params.set('note', String(filtres.note))
  if (filtres.plateforme) params.set('plateforme', filtres.plateforme)
  if (filtres.sort !== 'popular') params.set('tri', filtres.sort)
  if (filtres.page > 1) params.set('page', String(filtres.page))
  return params
}

/**
 * Un changement de filtre ramène à la première page : rester page 7 après
 * avoir resserré sur un genre qui n'en compte que deux affichait du vide.
 */
export function change(filtres: Filtres, patch: Partial<Filtres>): URLSearchParams {
  const suivant: Filtres = { ...filtres, ...patch }
  if (!('page' in patch)) suivant.page = 1
  return ecrisFiltres(suivant)
}

export function nombreActifs(filtres: Filtres): number {
  return (filtres.rayon !== 'tout' ? 1 : 0)
    + (filtres.genre ? 1 : 0)
    + (filtres.decennie !== null ? 1 : 0)
    + (filtres.langue ? 1 : 0)
    + (filtres.qualite ? 1 : 0)
    + (filtres.note !== null ? 1 : 0)
    + (filtres.plateforme ? 1 : 0)
}

/* ---------- les filtres vers l'API ---------- */

export function versCatalogue(filtres: Filtres, rich = 24): FiltresCatalogue {
  const demande: FiltresCatalogue = { sort: filtres.sort, page: filtres.page, rich }

  if (filtres.rayon !== 'tout') demande.famille = filtres.rayon
  /* Le genre affiché peut être un nom de série composé, que l'API ne sait pas
     filtrer : genreFiltrable ramène au nom qui marche. */
  if (filtres.genre) {
    const utilisable = genreFiltrable(filtres.genre)
    if (utilisable) demande.genre = utilisable
  }
  if (filtres.decennie !== null) demande.year = `${filtres.decennie}-${filtres.decennie + 9}`
  if (filtres.langue) demande.lang = filtres.langue
  if (filtres.qualite) demande.quality = filtres.qualite
  if (filtres.note !== null) demande.rating = filtres.note
  if (filtres.plateforme) demande.platform = filtres.plateforme

  return demande
}

/** Le titre de la page, qui dit ce qu'on regarde sans répéter les filtres. */
export function titreDePage(filtres: Filtres): string {
  if (filtres.query) return `Résultats pour « ${filtres.query} »`

  const rayon = filtres.rayon === 'movie' ? 'Films'
    : filtres.rayon === 'tv' ? 'Séries'
    : filtres.rayon === 'anime' ? 'Animés'
    : null

  const plateforme = plateformeParId(filtres.plateforme)?.nom ?? null

  /* On ne nomme que ce qui a été choisi, dans l'ordre où on le lit :
     « Séries · Action · sur Netflix ». Tout cumuler donnerait un titre que
     personne ne finit de lire, donc la note et la qualité restent dans les
     filtres, qui les montrent déjà. */
  const morceaux = [rayon ?? (plateforme || filtres.genre ? 'Titres' : null), filtres.genre].filter(Boolean)
  const base = morceaux.length ? morceaux.join(' · ') : 'Tout le catalogue'
  return plateforme ? `${base} · sur ${plateforme}` : base
}
