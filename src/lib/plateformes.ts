/**
 * Les plateformes sur lesquelles /catalog sait filtrer.
 *
 * Il n'existe pas de route qui les liste : cette table est écrite à la main,
 * et chaque identifiant a été vérifié contre l'API — ceux qui ne renvoient
 * rien n'y figurent pas, parce qu'un filtre qui ouvre une page vide est pire
 * que pas de filtre. Les volumes relevés le 21 octobre 2026 sont indicatifs ;
 * ils bougent, l'identifiant non.
 *
 * Le filtre signifie « inclus dans l'abonnement de cette plateforme », pas
 * « hébergé par elle » : la lecture reste celle de HeiwaStream.
 */
export interface Plateforme {
  /** Ce que l'API attend dans `platform`. */
  id: string
  /** Ce que l'interface affiche. */
  nom: string
}

export const PLATEFORMES: Plateforme[] = [
  { id: 'netflix', nom: 'Netflix' },
  { id: 'prime-video', nom: 'Prime Video' },
  { id: 'disney-plus', nom: 'Disney+' },
  { id: 'max', nom: 'Max' },
  { id: 'canal-plus', nom: 'Canal+' },
  { id: 'crunchyroll', nom: 'Crunchyroll' },
]

export function plateformeParId(id: string | null | undefined): Plateforme | null {
  if (!id) return null
  return PLATEFORMES.find((p) => p.id === id) ?? null
}
