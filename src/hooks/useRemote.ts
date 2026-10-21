import { useEffect, useRef, useState } from 'react'
import { ErreurHeiwa } from '@/lib/heiwa'

/**
 * UN APPEL, TROIS ÉTATS
 * =====================
 * Le catalogue est distant : chaque page vit entre « ça charge », « voilà »
 * et « ça n'a pas marché ». Ce crochet tient ces trois états au même endroit,
 * annule la requête quand la page se démonte ou que les paramètres changent,
 * et garde la donnée précédente le temps du rechargement — sans quoi filtrer
 * ferait clignoter la grille à chaque frappe.
 */

export interface Distant<T> {
  data: T | undefined
  /** Vrai au premier chargement comme aux suivants. */
  loading: boolean
  /** Vrai seulement tant que rien n'est encore arrivé. */
  vide: boolean
  error: ErreurHeiwa | null
  /** Relance l'appel, après une erreur par exemple. */
  recharge: () => void
}

/**
 * `charge` reçoit un signal d'annulation et doit le passer au client. Les
 * dépendances jouent le rôle des dépendances de useEffect : l'appel repart
 * quand elles changent.
 */
export function useRemote<T>(
  charge: (signal: AbortSignal) => Promise<T>,
  deps: readonly unknown[],
): Distant<T> {
  const [data, setData] = useState<T | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<ErreurHeiwa | null>(null)
  const [essai, setEssai] = useState(0)

  /* `charge` est redéfinie à chaque rendu : la garder dans une ref évite de
     relancer l'appel pour cette seule raison. */
  const chargeRef = useRef(charge)
  chargeRef.current = charge

  useEffect(() => {
    const controleur = new AbortController()
    let vivant = true

    setLoading(true)
    setError(null)

    chargeRef.current(controleur.signal).then(
      (resultat) => {
        if (!vivant) return
        setData(resultat)
        setLoading(false)
      },
      (erreur: unknown) => {
        if (!vivant) return
        /* Une annulation est voulue : ni erreur, ni fin de chargement. */
        if (erreur instanceof DOMException && erreur.name === 'AbortError') return
        setError(
          erreur instanceof ErreurHeiwa
            ? erreur
            : new ErreurHeiwa(0, 'injoignable', String((erreur as Error)?.message ?? erreur)),
        )
        setLoading(false)
      },
    )

    return () => {
      vivant = false
      controleur.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, essai])

  return {
    data,
    loading,
    vide: data === undefined,
    error,
    recharge: () => setEssai((n) => n + 1),
  }
}
