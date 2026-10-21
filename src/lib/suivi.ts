/**
 * LE SUIVI D'USAGE
 * ================
 * Quelques signaux que seul le navigateur connaît : quelle fiche a été
 * ouverte, quelle lecture lancée, quel mot cherché. Le serveur voit passer
 * les appels à l'API, mais pas les pages — l'application est une page unique.
 *
 * Ce qui part : le type, l'identifiant et le titre concernés. Le serveur y
 * ajoute l'heure, l'adresse IP, l'appareil et le compte s'il y en a un. Les
 * visiteurs en sont informés dans le pied de page du site ; c'est la moindre
 * des choses, et c'est ce que la loi attend.
 *
 * Ce qui ne peut pas partir, et qu'il est inutile de chercher : la durée
 * réellement regardée. Le lecteur est une iframe de HeiwaStream qui ne
 * rapporte rien.
 */

type TypeEvenement = 'fiche' | 'lecture' | 'recherche' | 'page'

interface Details {
  id?: string
  titre?: string
  terme?: string
  episode?: string
  chemin?: string
}

/** Le dernier envoi par clé, pour ne pas compter dix fois le même geste. */
const derniers = new Map<string, number>()
const REPETITION_MS = 30_000

/**
 * Envoie un signal. Ne renvoie rien, n'échoue jamais, et ne retarde aucune
 * page : une mesure qui casse l'affichage serait une mesure de trop.
 */
export function suit(type: TypeEvenement, details: Details = {}): void {
  const cle = `${type}|${details.id ?? ''}|${details.terme ?? ''}|${details.episode ?? ''}`
  const dernier = derniers.get(cle)
  const maintenant = Date.now()
  /* Revenir deux fois sur la même fiche en dix secondes, c'est une visite,
     pas deux. */
  if (dernier && maintenant - dernier < REPETITION_MS) return
  derniers.set(cle, maintenant)

  try {
    void fetch('/api/evenements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, ...details }),
      /* keepalive : le signal part même si la page se ferme juste après. */
      keepalive: true,
    }).catch(() => {})
  } catch {
    /* Rien à faire. */
  }
}
