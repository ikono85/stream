export type DeviceGuide = 'desktop' | 'android' | 'ios'
export interface GuidePreferences { hidden?: boolean; nextVisit?: number; installed?: boolean }
export const GUIDE_KEY = 'lucarne.install-guide.v1'
export const GUIDE_EVENT = 'lucarne:install-guide'
export const SNOOZE_MS = 3 * 24 * 3600 * 1000

export function deviceGuide(userAgent: string, touchPoints = 0): DeviceGuide {
  if (/iPhone|iPad|iPod/i.test(userAgent) || (/Macintosh/i.test(userAgent) && touchPoints > 1)) return 'ios'
  return /Android/i.test(userAgent) ? 'android' : 'desktop'
}
export function readGuidePreferences(storage: Pick<Storage, 'getItem'>): GuidePreferences {
  try { return JSON.parse(storage.getItem(GUIDE_KEY) ?? '{}') ?? {} } catch { return {} }
}
export function shouldShowGuide(preferences: GuidePreferences, now = Date.now()): boolean {
  return preferences.hidden !== true && preferences.installed !== true
    && !(typeof preferences.nextVisit === 'number' && preferences.nextVisit > now)
}
export function rememberGuide(choice: 'later' | 'never' | 'installed', storage: Pick<Storage, 'getItem' | 'setItem'>, now = Date.now()) {
  try {
    const previous = readGuidePreferences(storage)
    const preferences = choice === 'installed' ? { ...previous, installed: true }
      : choice === 'never' ? { ...previous, hidden: true }
      : { ...previous, nextVisit: now + SNOOZE_MS }
    storage.setItem(GUIDE_KEY, JSON.stringify(preferences))
  } catch { /* Le tutoriel se ferme aussi si le stockage est bloqué. */ }
}
export function openInstallGuide() { window.dispatchEvent(new Event(GUIDE_EVENT)) }
