/**
 * Les genres acceptés par /catalog.
 *
 * HeiwaStream filtre sur le nom français du genre, dans l'orthographe de
 * TMDB. Ce n'est pas une liste que l'API expose : il n'y a pas de route pour
 * l'obtenir, donc elle est écrite ici. Les noms composés propres aux séries
 * (« Action & Adventure », « Science-Fiction & Fantastique ») apparaissent
 * bien dans les fiches, mais ne filtrent rien — l'API répond zéro résultat.
 * Ils sont donc absents de cette liste, et rattrapés plus bas.
 */

/** Dans l'ordre où la barre de filtres les montre. */
export const GENRES = [
  'Action',
  'Aventure',
  'Animation',
  'Comédie',
  'Crime',
  'Documentaire',
  'Drame',
  'Familial',
  'Fantastique',
  'Histoire',
  'Horreur',
  'Musique',
  'Mystère',
  'Romance',
  'Science-Fiction',
  'Thriller',
  'Guerre',
  'Western',
  'Téléfilm',
] as const

export type Genre = (typeof GENRES)[number]

export function estGenre(nom: string): nom is Genre {
  return (GENRES as readonly string[]).includes(nom)
}

/**
 * Une fiche de série annonce « Action & Adventure » là où le catalogue
 * attend « Action ». Sans cette table, cliquer sur le genre d'une série
 * ouvrait une page vide.
 */
const EQUIVALENTS: Record<string, Genre> = {
  'action & adventure': 'Action',
  'science-fiction & fantastique': 'Science-Fiction',
  'sci-fi & fantasy': 'Science-Fiction',
  'war & politics': 'Guerre',
  'guerre & politique': 'Guerre',
  kids: 'Familial',
  enfants: 'Familial',
  soap: 'Drame',
  feuilleton: 'Drame',
  reality: 'Documentaire',
  'réalité': 'Documentaire',
  news: 'Documentaire',
  'actualités': 'Documentaire',
  talk: 'Documentaire',
  policier: 'Crime',
}

/**
 * Le genre sur lequel on peut réellement filtrer, à partir du nom affiché.
 * Null quand aucun filtre ne correspond : le nom reste alors du texte, pas
 * un lien qui ne mènerait nulle part.
 */
export function genreFiltrable(nom: string): Genre | null {
  if (estGenre(nom)) return nom
  return EQUIVALENTS[nom.toLowerCase()] ?? null
}
