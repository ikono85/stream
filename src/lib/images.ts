/**
 * Les images du catalogue.
 *
 * HeiwaStream renvoie les chemins TMDB (`/pEoqbqt….jpg`) sans les assembler.
 * Ils se servent depuis le CDN d'images de TMDB, qui ne demande ni clé ni
 * compte : c'est un serveur de fichiers, pas une API. Rien d'autre que ces
 * images ne sort d'ici.
 *
 * Choisir la taille compte : une affiche de carte en `original` fait dix fois
 * le poids utile. Les constantes ci-dessous nomment les tailles par usage
 * plutôt que par largeur, pour qu'un appel se relise.
 */

const CDN = 'https://image.tmdb.org/t/p'

export const TAILLES = {
  /** Affiche de carte, de suggestion ou de liste. */
  affiche: 'w342',
  /** Affiche de fiche, affichée jusqu'à 15 rem de large. */
  afficheLarge: 'w500',
  /** Fond de carte « reprendre », en 16:9. */
  fond: 'w780',
  /** Fond de bandeau, pleine largeur. */
  fondLarge: 'w1280',
  /** Lettrage du titre, sur transparence. */
  logo: 'w500',
  /** Vignette de saison. */
  vignette: 'w300',
} as const

export type Taille = (typeof TAILLES)[keyof typeof TAILLES]

/**
 * Un chemin TMDB en URL servable. Renvoie undefined quand il n'y a pas de
 * chemin, afin que l'appelant retombe sur l'artwork dessiné par lib/poster
 * plutôt que de demander une image vide.
 */
export function image(chemin: string | null | undefined, taille: Taille = TAILLES.affiche): string | undefined {
  if (!chemin) return undefined
  /* Déjà une URL complète : une source qui sert ses propres fichiers. */
  if (/^https?:\/\//.test(chemin)) return chemin
  return `${CDN}/${taille}${chemin.startsWith('/') ? '' : '/'}${chemin}`
}
