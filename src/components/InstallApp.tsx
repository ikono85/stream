import { useInstallation } from '@/lib/install'
import { openInstallGuide } from '@/lib/install-guide'

export function InstallApp() {
  const state = useInstallation()
  if (state === 'installed') return null
  return <button type="button" onClick={openInstallGuide}
    className="mt-5 min-h-11 rounded-full border border-ink-600 px-4 text-sm font-semibold text-paper transition-colors hover:border-lamp-500 hover:text-lamp-400">
    Installer l’application
  </button>
}