/**
 * LES TRANSITIONS DE VUE
 * ======================
 * Le navigateur sait faire une chose que React ne sait pas : photographier
 * l'écran avant et après un changement de page, et animer l'un vers l'autre.
 * Deux éléments qui portent le même `view-transition-name` de part et
 * d'autre sont reliés — l'affiche cliquée glisse jusqu'à sa place sur la
 * fiche, au lieu de disparaître pour réapparaître ailleurs.
 *
 * Pris en charge par Chrome, Edge et Safari 18. Firefox, non : il n'y a
 * alors ni morphing ni erreur, on retombe sur le fondu de motion. C'est la
 * raison pour laquelle ce module existe plutôt qu'un appel direct : le reste
 * du code pose la question une fois et s'adapte.
 *
 * La transition est pilotée à la main plutôt que par React Router : son
 * intégration (`viewTransition` sur les liens, `useViewTransitionState`)
 * exige un « data router », que ce projet n'utilise pas — et l'appeler sans
 * lui fait planter l'application entière. Trente lignes ici valent mieux
 * qu'une migration de tout le routage pour une animation.
 */

import { flushSync } from 'react-dom'

/**
 * Enchaîne : poser le nom, photographier, naviguer, retirer le nom.
 *
 * Les `flushSync` ne sont pas décoratifs. Le navigateur photographie l'écran
 * au moment où `startViewTransition` est appelé : si React n'a pas encore
 * appliqué le nom, il n'y a rien à relier. Et il photographie la nouvelle
 * page dès que le rappel rend la main : si la navigation est différée, il
 * photographie l'ancienne.
 */
export async function avecTransition(
  poseLeNom: (actif: boolean) => void,
  navigue: () => void,
  precharge?: () => Promise<unknown>,
): Promise<void> {
  if (!transitionsDeVue) { navigue(); return }

  /* Le module de la page d'arrivée doit être là avant la photo, sinon c'est
     l'écran d'attente qui est photographié. */
  if (precharge) {
    try { await precharge() } catch { /* on continue : au pire, pas de morphing */ }
  }

  flushSync(() => poseLeNom(true))

  const transition = document.startViewTransition(() => {
    flushSync(() => navigue())
  })

  try {
    await transition.finished
  } catch {
    /* Une transition interrompue n'est pas une erreur. */
  } finally {
    poseLeNom(false)
  }
}

/** Un clic que le navigateur doit traiter lui-même : nouvel onglet, etc. */
export function clicOrdinaire(e: { metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean; button: number }): boolean {
  return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey
}

/** Le navigateur sait-il animer un changement de page ? */
export const transitionsDeVue: boolean =
  typeof document !== 'undefined' && 'startViewTransition' in document

/**
 * Le nom porté par l'affiche pendant la transition.
 *
 * Un nom doit être **unique à l'écran** : le poser sur cinquante cartes à la
 * fois ferait échouer la transition en silence. Il n'est donc attribué qu'à
 * la carte effectivement cliquée, le temps du changement de page.
 */
export const NOM_AFFICHE = 'affiche-active'
