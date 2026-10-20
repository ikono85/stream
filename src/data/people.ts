import { CATALOG } from '@/data/catalog'
import { fold } from '@/lib/format'
import type { Entry } from '@/types'

/**
 * PEOPLE
 * ======
 * The catalogue stores credits on each title; nothing stores a person. This
 * turns the one into the other, so a name on a fiche can lead somewhere.
 *
 * Two sources per entry, in order of richness: `people` carries portraits and
 * roles when the import found them, and `cast` is the plain-text fallback the
 * hand-written entries use. `director` adds a credit behind the camera.
 *
 * Built on first use rather than at import time: the home page never asks for
 * it, and it would otherwise walk the whole catalogue before the first paint.
 */

/** One title a person is credited in. */
export interface Credit {
  entry: Entry
  /** Role played, when the source named one. */
  character?: string
}

export interface PersonRecord {
  slug: string
  name: string
  /** First portrait found across their credits. */
  photo?: string
  directed: Entry[]
  acted: Credit[]
}

/** djb2, base 36 — short and stable, for names a slug cannot represent. */
function hash(value: string): string {
  let h = 5381
  for (let i = 0; i < value.length; i += 1) h = ((h << 5) + h + value.charCodeAt(i)) >>> 0
  return h.toString(36)
}

/**
 * A URL-safe slug. Accents fold, spaces become dashes. A name written in a
 * script with no Latin letters — the catalogue has a few — leaves nothing to
 * fold, so it falls back to a hash of the name instead of an empty path.
 */
export function personSlug(name: string): string {
  const base = fold(name).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return base || `p-${hash(name)}`
}

interface Index {
  bySlug: Map<string, PersonRecord>
  byName: Map<string, PersonRecord>
  all: PersonRecord[]
}

let cache: Index | null = null

function build(): Index {
  const bySlug = new Map<string, PersonRecord>()
  const byName = new Map<string, PersonRecord>()

  const record = (name: string, photo?: string): PersonRecord | null => {
    const clean = name.trim()
    /* The catalogue writes an unknown director as an em dash. */
    if (!clean || clean === '—' || clean === '-') return null

    const existing = byName.get(clean)
    if (existing) {
      if (!existing.photo && photo) existing.photo = photo
      return existing
    }

    /* Two different names can fold to the same slug. The first keeps it. */
    let slug = personSlug(clean)
    if (bySlug.has(slug)) slug = `${slug}-${hash(clean)}`

    const created: PersonRecord = { slug, name: clean, photo, directed: [], acted: [] }
    bySlug.set(slug, created)
    byName.set(clean, created)
    return created
  }

  for (const entry of CATALOG) {
    const billed = entry.people?.length
      ? entry.people
      : entry.cast.map((name) => ({ name, character: undefined, photo: undefined }))

    for (const person of billed) {
      const r = record(person.name, person.photo)
      if (!r || r.acted.some((c) => c.entry.id === entry.id)) continue
      r.acted.push({ entry, ...(person.character ? { character: person.character } : {}) })
    }

    const director = record(entry.director)
    if (director && !director.directed.some((e) => e.id === entry.id)) director.directed.push(entry)
  }

  /* Newest first: a filmography reads backwards from now. */
  const recent = (a: Entry, b: Entry) => b.year - a.year || b.popularity - a.popularity
  for (const r of bySlug.values()) {
    r.directed.sort(recent)
    r.acted.sort((a, b) => recent(a.entry, b.entry))
  }

  return { bySlug, byName, all: [...bySlug.values()] }
}

function index(): Index {
  cache ??= build()
  return cache
}

export function personBySlug(slug: string): PersonRecord | undefined {
  return index().bySlug.get(slug)
}

/** The record behind a credited name, for building a link to their page. */
export function personByName(name: string): PersonRecord | undefined {
  return index().byName.get(name.trim())
}

/** Every title a person is credited in, each counted once. */
export function creditCount(person: PersonRecord): number {
  const ids = new Set([...person.directed.map((e) => e.id), ...person.acted.map((c) => c.entry.id)])
  return ids.size
}
