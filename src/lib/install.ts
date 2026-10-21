import { useSyncExternalStore } from 'react'
import { rememberGuide } from '@/lib/install-guide'

interface InstallPrompt extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let prompt: InstallPrompt | null = null
let installed = false
const listeners = new Set<() => void>()
const emit = () => { for (const listener of listeners) listener() }
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }
const snapshot = () => installed ? 'installed' : prompt ? 'ready' : 'manual'
let initialized = false

export function prepareInstallation() {
  if (initialized) return
  initialized = true
  const standalone = window.matchMedia('(display-mode: standalone)')
  const update = () => {
    installed = standalone.matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
    if (installed) { try { rememberGuide('installed', localStorage) } catch { /* stockage facultatif */ } }
    emit()
  }
  update()
  standalone.addEventListener('change', update)
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    prompt = event as InstallPrompt
    emit()
  })
  window.addEventListener('appinstalled', () => {
    installed = true; prompt = null
    try { rememberGuide('installed', localStorage) } catch { /* stockage facultatif */ }
    emit()
  })
  if ('serviceWorker' in navigator && window.isSecureContext) {
    const register = () => { void navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(() => {
      // Une indisponibilité du mode hors connexion ne bloque pas le site.
    }) }
    if (document.readyState === 'complete') register()
    else window.addEventListener('load', register, { once: true })
  }
}

export function useInstallation() {
  return useSyncExternalStore(subscribe, snapshot, () => 'manual')
}

export async function installeLucarne() {
  const invitation = prompt
  if (!invitation) return
  prompt = null
  emit()
  await invitation.prompt()
  return (await invitation.userChoice).outcome
}
