import type { Entry, Langue } from '@/types'

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
 * La ligne qui dit quelle forme a un titre : une durée pour un film, un
 * nombre de saisons pour une série. Vide quand la fiche détaillée n'a pas
 * encore été demandée — ce qui se lit mieux qu'un « 1 saison » que rien
 * n'atteste.
 */
export function shape(entry: Entry): string {
  if (entry.kind === 'film') return entry.runtime ? runtime(entry.runtime) : ''
  if (entry.seasons?.length) return seasonCount(entry.seasons.length)
  return ''
}

/** « S1 E2 », tel que le lecteur et les listes l'écrivent. */
export function episodeLabel(season: number, episode: number): string {
  return `S${season} E${episode}`
}

/**
 * Les pistes d'un titre, dans un ordre stable : la VF d'abord, parce que
 * c'est ce que la plupart cherchent, et l'ordre de l'API varie.
 */
const ORDRE: Langue[] = ['VF', 'VFSTFR', 'VOSTFR', 'VO']

export function langues(liste: Langue[]): string {
  return [...liste]
    .sort((a, b) => ORDRE.indexOf(a) - ORDRE.indexOf(b))
    .join(' · ')
}

const NOTE = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

export function rating(value: number): string {
  return NOTE.format(value)
}

/** 2026-10-21 → « 21 octobre ». Les dates de l'API sont en ISO. */
const JOUR = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' })

export function jour(iso: string | null | undefined): string {
  if (!iso) return ''
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '' : JOUR.format(date)
}

/* ---------- dates relatives ---------- */

/** Aujourd'hui, au format que l'API emploie pour ses dates. */
export function aujourdhui(): string {
  const d = new Date()
  /* Construit à la main : toISOString bascule en UTC et, passé 22 h à Paris,
     annonçait déjà demain. */
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** La même date, décalée de n jours. */
export function dansNJours(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Nombre de jours entre aujourd'hui et une date ISO. Négatif pour le passé,
 * null si la date est illisible. Compté sur les jours civils, pas sur
 * vingt-quatre heures : « demain » doit rester vrai à 23 h 50.
 */
export function ecartEnJours(iso: string | null | undefined): number | null {
  if (!iso) return null
  const cible = new Date(`${iso.slice(0, 10)}T00:00:00`)
  if (Number.isNaN(cible.getTime())) return null
  const maintenant = new Date()
  const debut = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate())
  return Math.round((cible.getTime() - debut.getTime()) / 86400000)
}

const JOUR_LONG = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

/**
 * « aujourd'hui », « demain », « samedi 25 octobre ». Les deux premiers
 * valent mieux qu'une date qu'il faut comparer mentalement à la sienne.
 */
export function jourRelatif(iso: string | null | undefined): string {
  const ecart = ecartEnJours(iso)
  if (ecart === null) return ''
  if (ecart === 0) return "aujourd'hui"
  if (ecart === 1) return 'demain'
  if (ecart === -1) return 'hier'
  const date = new Date(`${(iso as string).slice(0, 10)}T00:00:00`)
  const texte = JOUR_LONG.format(date)
  /* Au-delà d'une semaine, le jour de la semaine ne situe plus rien. */
  return ecart > 7 || ecart < -7 ? texte.replace(/^\S+\s/, 'le ') : texte
}

/** Strip accents and case so "criee" finds "La Criée". */
export function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}
