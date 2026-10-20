import { fold } from '@/lib/format'

/**
 * The catalogue has two sources of genre names and they disagree: TMDB says
 * "Science-Fiction", "Famille", "Crime"; the hand-written entries say
 * "Science-fiction", "Familial", "Policier". Left alone, the filter strip
 * shows both spellings and each one hides half the titles.
 *
 * One spelling wins per meaning, chosen for how it reads in French rather
 * than for which source is bigger. Keys are folded — case and accents do not
 * matter, so a new import does not need to match exactly.
 */
const CANON: Record<string, string> = {
  'science-fiction': 'Science-Fiction',
  'science fiction': 'Science-Fiction',
  sciencefiction: 'Science-Fiction',
  'sf': 'Science-Fiction',
  famille: 'Familial',
  familial: 'Familial',
  crime: 'Policier',
  policier: 'Policier',
  musical: 'Musique',
  musique: 'Musique',
  comedie: 'Comédie',
  drame: 'Drame',
}

/** One genre name in its canonical spelling. Unknown names pass through. */
export function canonGenre(raw: string): string {
  const name = raw.trim()
  return CANON[fold(name)] ?? name
}

/** A whole list, canonical and deduplicated, original order kept. */
export function canonGenres(list: string[]): string[] {
  const out: string[] = []
  for (const raw of list) {
    const name = canonGenre(raw)
    if (name && !out.includes(name)) out.push(name)
  }
  return out
}
