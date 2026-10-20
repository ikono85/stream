import type { Entry } from '@/types'

/** 107 → "1 h 47". Minutes under an hour stay as "47 min". */
export function runtime(minutes: number): string {
  if (!minutes) return ''
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (!h) return `${m} min`
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`
}

/** 3725 → "1:02:05". Used in the player, where every second shows. */
export function clock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const s = Math.floor(seconds % 60)
  const m = Math.floor((seconds / 60) % 60)
  const h = Math.floor(seconds / 3600)
  const mm = h ? String(m).padStart(2, '0') : String(m)
  return `${h ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`
}

/** "Il reste 34 min" on a half-watched title. */
/**
 * "Il reste 34 min". Rounding straight to minutes claimed a 32-second clip was
 * almost over after seven seconds, so anything under a minute counts seconds.
 */
export function remaining(seconds: number, duration: number): string {
  const left = Math.max(0, duration - seconds)
  if (left < 10) return 'Presque terminé'
  if (left < 60) return `Il reste ${Math.round(left)} s`
  return `Il reste ${runtime(Math.round(left / 60))}`
}

export function seasonCount(n: number): string {
  return n === 1 ? '1 saison' : `${n} saisons`
}

export function episodeCount(n: number): string {
  return n === 1 ? '1 épisode' : `${n} épisodes`
}

/**
 * The one line that says what shape a title has: a running time for a film,
 * a count of seasons for a series that carries them, a count of episodes for
 * one that only knows how many there are. Empty when nothing is known, which
 * reads better than a confident "1 saison" that no data supports.
 */
export function shape(entry: Entry): string {
  if (entry.kind === 'film') return entry.runtime ? runtime(entry.runtime) : ''
  if (entry.seasons?.length) return seasonCount(entry.seasons.length)
  if (entry.episodeCount) return episodeCount(entry.episodeCount)
  return ''
}

const RATING = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

export function rating(value: number): string {
  return RATING.format(value)
}

/** Strip accents and case so "criee" finds "La Criée". */
export function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}
