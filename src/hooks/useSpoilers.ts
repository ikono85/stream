import { useSyncExternalStore } from 'react'

const KEY = 'lucarne:sans-spoilers'
let actif = (() => { try { return localStorage.getItem(KEY) === '1' } catch { return false } })()
const abonnes = new Set<() => void>()
function notifie() { for (const rappel of abonnes) rappel() }
window.addEventListener('storage', (e) => {
  if (e.key === KEY || e.key === null) { actif = e.newValue === '1'; notifie() }
})
export function useSpoilers() {
  const sansSpoilers = useSyncExternalStore((rappel) => { abonnes.add(rappel); return () => { abonnes.delete(rappel) } }, () => actif)
  return { sansSpoilers, bascule: () => {
    actif = !actif
    try { localStorage.setItem(KEY, actif ? '1' : '0') } catch { /* Préférence conservée pour la session. */ }
    notifie()
  } }
}
