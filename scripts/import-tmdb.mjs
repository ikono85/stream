#!/usr/bin/env node
/**
 * IMPORT TMDB
 * ===========
 * Builds `src/data/tmdb.generated.ts` from The Movie Database, so the
 * catalogue has a few hundred real titles — real posters, real credits, real
 * synopses — to try the grid, the filters and the search against.
 *
 * It imports METADATA ONLY. TMDB has no video, so every entry lands without a
 * source and the fiche says so. This fills the shelves; it does not fill them
 * with anything watchable.
 *
 * Usage:
 *   node scripts/import-tmdb.mjs --key=VOTRE_CLE
 *   TMDB_KEY=... node scripts/import-tmdb.mjs --pages=10 --list=top_rated
 *
 * Options (defaults in brackets):
 *   --key=       TMDB v3 API key, or the TMDB_KEY environment variable.
 *   --pages=     Pages of 20 titles to walk.                            [5]
 *   --list=      popular | top_rated | now_playing | upcoming     [popular]
 *   --lang=      Metadata language.                                [fr-FR]
 *   --out=       Destination file.        [src/data/tmdb.generated.ts]
 *
 * The key stays on this machine: the script runs once, writes a plain file,
 * and the browser never sees it. Do not move these calls into the app.
 *
 * TMDB asks that anything using their data says so. If you keep this import,
 * put this line in the footer:
 *   « Ce produit utilise l'API de TMDB mais n'est ni approuvé ni certifié
 *     par TMDB. »
 */

import { writeFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'

const API = 'https://api.themoviedb.org/3'

/* ---------- argument handling ---------- */

export function parseArgs(argv) {
  const out = {}
  for (const arg of argv) {
    const m = /^--([a-z]+)=(.*)$/.exec(arg)
    if (m) out[m[1]] = m[2]
  }
  return out
}

/* ---------- shaping one TMDB movie into a Lucarne entry ---------- */

/**
 * TMDB popularity is an unbounded score — a few hundred for a blockbuster,
 * under one for an obscure title. The catalogue sorts on a 0-100 field, so
 * the imported set is rescaled against itself. Mixed with hand-written
 * entries it stays comparable instead of burying them.
 */
export function rescale(values) {
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const span = max - min || 1
  return (v) => Math.round(((v - min) / span) * 99) + 1
}

/**
 * The best YouTube trailer among a title's videos, or nothing.
 *
 * TMDB returns everything from full trailers to behind-the-scenes clips, in
 * whatever languages exist. Only trailers and teasers are considered, and a
 * French official trailer wins over an English fan upload. Picking nothing is
 * a valid answer — the button simply does not appear.
 */
export function pickTrailer(videos) {
  const candidates = (videos ?? []).filter(
    (v) => v.site === 'YouTube' && v.key && (v.type === 'Trailer' || v.type === 'Teaser'),
  )
  const score = (v) =>
    (v.type === 'Trailer' ? 2 : 0) + (v.official ? 1 : 0) + (v.iso_639_1 === 'fr' ? 2 : 0)
  return candidates.sort((a, b) => score(b) - score(a))[0]?.key
}

/** One TMDB record (details + credits + videos) as a catalogue entry literal. */
export function toEntry(movie, { genreNames, imageBase, popularityOf, addedAt }) {
  const year = Number((movie.release_date ?? '').slice(0, 4))
  if (!year || !movie.poster_path || !movie.overview) return null

  const crew = movie.credits?.crew ?? []
  const director = crew.find((c) => c.job === 'Director')?.name ?? '—'
  const billed = (movie.credits?.cast ?? []).slice(0, 8)
  const cast = billed.slice(0, 4).map((c) => c.name)

  /* Portraits are 2:3 like the posters; w185 is plenty at the size shown. */
  const people = billed.map((c) => ({
    name: c.name,
    ...(c.character ? { character: c.character } : {}),
    ...(c.profile_path ? { photo: `${imageBase}w185${c.profile_path}` } : {}),
  }))
  const trailer = pickTrailer(movie.videos?.results)

  const genres = (movie.genres ?? [])
    .map((g) => (typeof g === 'number' ? genreNames.get(g) : g.name))
    .filter(Boolean)

  return {
    id: `tmdb-${movie.id}`,
    title: movie.title,
    year,
    runtime: movie.runtime || undefined,
    genres: genres.length ? genres : ['Non classé'],
    rating: Math.round((movie.vote_average ?? 0) * 10) / 10,
    director,
    cast,
    synopsis: movie.overview.trim(),
    popularity: popularityOf(movie.popularity ?? 0),
    addedAt,
    artwork: `${imageBase}w500${movie.poster_path}`,
    ...(movie.backdrop_path ? { backdrop: `${imageBase}w1280${movie.backdrop_path}` } : {}),
    ...(trailer ? { trailer } : {}),
    ...(people.length ? { people } : {}),
  }
}

/* ---------- rendering the TypeScript file ---------- */

const s = (v) => JSON.stringify(v)

export function render(entries, { list, lang, when }) {
  /* Plain object literals rather than the `film()` helper: the helper lives
     in catalog.ts, and importing it back from here would make the two files
     import each other. A generated file can afford to be verbose. */
  const body = entries.map((e) => `  {
    kind: 'film',
    id: ${s(e.id)},
    title: ${s(e.title)},
    year: ${e.year},${e.runtime ? `\n    runtime: ${e.runtime},` : ''}
    rating: ${e.rating}, popularity: ${e.popularity}, addedAt: ${s(e.addedAt)},
    genres: [${e.genres.map(s).join(', ')}],
    director: ${s(e.director)},
    cast: [${e.cast.map(s).join(', ')}],
    synopsis: ${s(e.synopsis)},
    artwork: ${s(e.artwork)},${e.backdrop ? `\n    backdrop: ${s(e.backdrop)},` : ''}${e.trailer ? `\n    trailer: ${s(e.trailer)},` : ''}${e.people?.length ? `
    people: [
${e.people.map((p) => `      { name: ${s(p.name)}${p.character ? `, character: ${s(p.character)}` : ''}${p.photo ? `, photo: ${s(p.photo)}` : ''} },`).join('\n')}
    ],` : ''}
    sources: [],
    demo: false,
  },`).join('\n')

  return `/* eslint-disable */
/**
 * GENERATED — do not edit by hand.
 *
 * ${entries.length} titles from The Movie Database (${list}, ${lang}),
 * imported on ${when} by scripts/import-tmdb.mjs. Run it again to refresh.
 *
 * Metadata and artwork only: none of these has a video source, and the fiche
 * of each says so. They are here to give the grid, the filters and the search
 * realistic material to work on.
 *
 * Ce produit utilise l'API de TMDB mais n'est ni approuvé ni certifié par
 * TMDB. Les affiches appartiennent à leurs distributeurs respectifs.
 */
import type { Entry } from '@/types'

export const TMDB_FILMS: Entry[] = [
${body}
]
`
}

/* ---------- the network side ---------- */

async function get(path, params, key) {
  const url = new URL(API + path)
  url.searchParams.set('api_key', key)
  for (const [k, v] of Object.entries(params ?? {})) url.searchParams.set(k, String(v))

  const res = await fetch(url)
  if (res.status === 401) throw new Error("clé TMDB refusée (401) — vérifiez --key")
  if (res.status === 429) throw new Error('TMDB limite le débit (429) — relancez dans une minute')
  if (!res.ok) throw new Error(`TMDB a répondu ${res.status} sur ${path}`)
  return res.json()
}

/** Details one by one, a few at a time: polite to TMDB, fast enough. */
async function pool(items, size, worker) {
  const out = []
  for (let i = 0; i < items.length; i += size) {
    out.push(...await Promise.all(items.slice(i, i + size).map(worker)))
  }
  return out
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const key = args.key ?? process.env.TMDB_KEY
  if (!key) {
    console.error(`
Il manque la clé TMDB.

  1. Créez un compte gratuit sur https://www.themoviedb.org/signup
  2. Paramètres du compte → API → demandez une clé (usage personnel)
  3. node scripts/import-tmdb.mjs --key=VOTRE_CLE
`)
    process.exit(1)
  }

  const pages = Number(args.pages ?? 5)
  const list = args.list ?? 'popular'
  const lang = args.lang ?? 'fr-FR'
  const out = args.out ?? 'src/data/tmdb.generated.ts'

  process.stdout.write(`TMDB · ${list} · ${lang} · ${pages} page(s)\n`)

  const config = await get('/configuration', {}, key)
  const imageBase = config.images?.secure_base_url ?? 'https://image.tmdb.org/t/p/'

  const genreList = await get('/genre/movie/list', { language: lang }, key)
  const genreNames = new Map((genreList.genres ?? []).map((g) => [g.id, g.name]))

  const summaries = []
  for (let page = 1; page <= pages; page++) {
    const data = await get(`/movie/${list}`, { language: lang, page }, key)
    summaries.push(...(data.results ?? []))
    process.stdout.write(`  page ${page}/${pages} — ${summaries.length} titres\r`)
  }
  process.stdout.write('\n')

  /* Runtime, director and cast only come with the details call. */
  let done = 0
  const details = await pool(summaries, 8, async (m) => {
    const full = await get(`/movie/${m.id}`, { language: lang, append_to_response: 'credits,videos', include_video_language: 'fr,en,null' }, key)
    process.stdout.write(`  détails ${++done}/${summaries.length}\r`)
    return full
  })
  process.stdout.write('\n')

  const popularityOf = rescale(details.map((m) => m.popularity ?? 0))
  const addedAt = new Date().toISOString().slice(0, 10)
  const entries = details
    .map((m) => toEntry(m, { genreNames, imageBase, popularityOf, addedAt }))
    .filter(Boolean)

  const skipped = details.length - entries.length
  const file = render(entries, { list, lang, when: addedAt })
  await mkdir(dirname(out), { recursive: true })
  await writeFile(out, file, 'utf8')

  console.log(`\n${entries.length} titres écrits dans ${out}`)
  if (skipped) console.log(`${skipped} ignorés (sans affiche, sans synopsis ou sans date)`)
  console.log('Relancez npm run dev pour les voir.')
}

if (process.argv[1]?.endsWith('import-tmdb.mjs')) {
  main().catch((err) => {
    console.error(`\nÉchec : ${err.message}`)
    process.exit(1)
  })
}
