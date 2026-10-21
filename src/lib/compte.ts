/**
 * LE CLIENT DES COMPTES
 * =====================
 * Le site est ouvert : on peut tout parcourir et tout regarder sans compte.
 * S'inscrire sert à garder sa liste et ses reprises d'un appareil à l'autre.
 *
 * La session vit dans un cookie `HttpOnly` posé par le serveur : ce fichier
 * ne la voit jamais et ne peut pas la lire. Il demande simplement « qui
 * suis-je ? » et le serveur répond d'après le cookie que le navigateur a
 * joint tout seul.
 */

export interface Compte {
  id: string
  nom: string
  role: 'membre' | 'admin'
  creeA: string
  derniereConnexionA: string | null
}

export interface EtatCompte {
  compte: Compte | null
  inscriptionOuverte: boolean
}

export class ErreurCompte extends Error {
  readonly code: string
  constructor(code: string, message: string) {
    super(message)
    this.name = 'ErreurCompte'
    this.code = code
  }
}

async function demande<T>(chemin: string, options: RequestInit = {}): Promise<T> {
  let reponse: Response
  try {
    reponse = await fetch(`/api${chemin}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers },
    })
  } catch {
    throw new ErreurCompte('injoignable', 'Le serveur ne répond pas.')
  }

  const corps: unknown = await reponse.json().catch(() => null)
  if (!reponse.ok) {
    const details = (corps ?? {}) as { erreur?: string; message?: string }
    throw new ErreurCompte(details.erreur ?? 'erreur', details.message ?? "La requête a échoué.")
  }
  return corps as T
}

export function moi(): Promise<EtatCompte> {
  return demande<EtatCompte>('/compte/moi')
}

export function inscription(nom: string, motDePasse: string): Promise<{ compte: Compte }> {
  return demande('/compte/inscription', { method: 'POST', body: JSON.stringify({ nom, motDePasse }) })
}

export function connexion(nom: string, motDePasse: string): Promise<{ compte: Compte }> {
  return demande('/compte/session', { method: 'POST', body: JSON.stringify({ nom, motDePasse }) })
}

export function deconnexion(): Promise<{ compte: null }> {
  return demande('/compte/session', { method: 'DELETE' })
}

export function changeMotDePasse(actuel: string, nouveau: string): Promise<{ ok: true }> {
  return demande('/compte/motdepasse', { method: 'PUT', body: JSON.stringify({ actuel, nouveau }) })
}

/** Supprime le compte, sa bibliothèque et ses traces. Sans retour possible. */
export function supprimeMonCompte(): Promise<{ ok: true }> {
  return demande('/compte/moi', { method: 'DELETE' })
}
