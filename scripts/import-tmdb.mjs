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
 *   node scripts/import-tmdb.mjs --key=... --series --pages=3 \\
 *     --export=TMDB_SERIES --out=src/data/tmdb.series.ts
 *
 * Options (defaults in brackets):
 *   --key=       TMDB v3 API key, or the TMDB_KEY environment variable.
 *   --series     Import series instead of films.                    [off]
 *   --saisons=   Fetch episodes for each series.                   [true]
 *   --saisons-max= Stop after this many seasons of one series.        [10]
 *   --sans-genres= TMDB genre ids to exclude, comma separated.
 *   --titres=    Named films instead of a list: "Titre (année); Titre".
 *   --export=    Name of the exported constant.               [TMDB_FILMS]
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

/** Every option this script accepts. Anything else stops the run. */
export const OPTIONS = [
  'key', 'pages', 'list', 'lang', 'out', 'export', 'titres',
  'series', 'saisons', 'saisons-max', 'sans-genres',
]

/**
 * Options, strictly.
 *
 * The first version of this required an `=`, so a flag written on its own
 * matched nothing and was dropped without a word; the script then ran its
 * default import and wrote the result wherever the caller had pointed it,
 * which looked plausible and was wrong. Silence is the bug, not the typo. A
 * flag may now stand alone, a name may carry a hyphen, and anything
 * unrecognised stops the run instead of being quietly ignored.
 */
export function parseArgs(argv, known = OPTIONS) {
  const allowed = new Set(known)
  const out = {}
  for (const arg of argv) {
    const m = /^--([a-z][a-z-]*)(?:=(.*))?$/.exec(arg)
    if (!m) throw new Error(`argument non reconnu : ${arg}`)
    if (!allowed.has(m[1])) {
      throw new Error(`option inconnue : --${m[1]}\nOptions acceptées : ${[...allowed].join(', ')}`)
    }
    out[m[1]] = m[2] ?? 'true'
  }
  return out
}

/**
 * "Pulp Fiction (1994); Titanic (1997)" into something to search for.
 *
 * Semicolons rather than commas, because titles contain commas. The year is
 * optional and only there to separate two films sharing a name; it is passed
 * to TMDB as a hint, not as a filter, so a re-release still matches.
 */
export function parseTitles(value) {
  return value
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const m = /^(.*?)\s*\((\d{4})\)$/.exec(part)
      return m ? { title: m[1].trim(), year: Number(m[2]) } : { title: part }
    })
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

/**
 * The best title treatment — the film's lettering on transparency — or
 * nothing. A French logo wins over an English one, which wins over a
 * language-neutral one; PNG wins over SVG because the hero scales it down and
 * some of the SVGs carry their own background.
 *
 * Nothing is a perfectly good answer: the hero typesets the title instead.
 */
export function pickLogo(images) {
  const logos = (images?.logos ?? []).filter((l) => l.file_path)
  const score = (l) =>
    (l.iso_639_1 === 'fr' ? 4 : l.iso_639_1 === 'en' ? 2 : 0) +
    (l.file_path.endsWith('.png') ? 1 : 0) +
    Math.min(l.vote_average ?? 0, 10) / 100
  return logos.sort((a, b) => score(b) - score(a))[0]?.file_path
}

/** One TMDB record (details + credits + videos + images) as a catalogue entry literal. */
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
  const logo = pickLogo(movie.images)
  /* Comes with the details call; no append needed. */
  const saga = movie.belongs_to_collection

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
    ...(logo ? { logo: `${imageBase}w500${logo}` } : {}),
    ...(saga?.id && saga.name ? { collection: { id: saga.id, name: saga.name } } : {}),
    ...(trailer ? { trailer } : {}),
    ...(people.length ? { people } : {}),
  }
}

/**
 * One TMDB series as a catalogue entry literal.
 *
 * TMDB files series under their own names for everything: `name` not
 * `title`, `first_air_date` not `release_date`, a creator instead of a
 * director. The id carries a `tv-` of its own because a film and a series
 * can share a number, and the catalogue keys on the id alone.
 */
export function toSerie(show, { imageBase, popularityOf, addedAt, seasons = [] }) {
  const year = Number((show.first_air_date ?? '').slice(0, 4))
  if (!year || !show.poster_path || !show.overview) return null

  const billed = (show.credits?.cast ?? []).slice(0, 8)
  const people = billed.map((c) => ({
    name: c.name,
    ...(c.character ? { character: c.character } : {}),
    ...(c.profile_path ? { photo: `${imageBase}w185${c.profile_path}` } : {}),
  }))

  /* A series is made by its creator; failing that, by whoever TMDB credits
     as director. Some have neither, and the fiche copes. */
  const director = show.created_by?.[0]?.name
    ?? (show.credits?.crew ?? []).find((c) => c.job === 'Director')?.name
    ?? '—'

  const genres = (show.genres ?? []).map((g) => g.name).filter(Boolean)
  const logo = pickLogo(show.images)
  const trailer = pickTrailer(show.videos?.results)

  return {
    kind: 'serie',
    id: `tmdb-tv-${show.id}`,
    title: show.name,
    year,
    genres: genres.length ? genres : ['Non classé'],
    rating: Math.round((show.vote_average ?? 0) * 10) / 10,
    director,
    cast: billed.slice(0, 4).map((c) => c.name),
    synopsis: show.overview.trim(),
    popularity: popularityOf(show.popularity ?? 0),
    addedAt,
    artwork: `${imageBase}w500${show.poster_path}`,
    ...(show.backdrop_path ? { backdrop: `${imageBase}w1280${show.backdrop_path}` } : {}),
    ...(logo ? { logo: `${imageBase}w500${logo}` } : {}),
    ...(trailer ? { trailer } : {}),
    ...(people.length ? { people } : {}),
    seasons,
  }
}

/**
 * One fetched season into the catalogue's shape. Season 0 — TMDB's bucket for
 * specials and recaps — is dropped by the caller, not here.
 */
export function toSeason(entryId, season, fallbackRuntime) {
  const episodes = (season.episodes ?? [])
    .filter((ep) => ep.episode_number > 0)
    .map((ep) => ({
      id: `${entryId}-s${season.season_number}e${ep.episode_number}`,
      number: ep.episode_number,
      title: ep.name || `Épisode ${ep.episode_number}`,
      synopsis: (ep.overview ?? '').trim(),
      runtime: ep.runtime || fallbackRuntime || 0,
    }))
  return episodes.length ? { number: season.season_number, episodes } : null
}

/* ---------- rendering the TypeScript file ---------- */

const s = (v) => JSON.stringify(v)

export function render(entries, { list, lang, when, exportName = 'TMDB_FILMS' }) {
  /* Plain object literals rather than the `film()` helper: the helper lives
     in catalog.ts, and importing it back from here would make the two files
     import each other. A generated file can afford to be verbose. */
  const body = entries.map((e) => `  {
    kind: '${e.kind ?? 'film'}',
    id: ${s(e.id)},
    title: ${s(e.title)},
    year: ${e.year},${e.runtime ? `\n    runtime: ${e.runtime},` : ''}
    rating: ${e.rating}, popularity: ${e.popularity}, addedAt: ${s(e.addedAt)},
    genres: [${e.genres.map(s).join(', ')}],
    director: ${s(e.director)},
    cast: [${e.cast.map(s).join(', ')}],
    synopsis: ${s(e.synopsis)},
    artwork: ${s(e.artwork)},${e.backdrop ? `\n    backdrop: ${s(e.backdrop)},` : ''}${e.logo ? `\n    logo: ${s(e.logo)},` : ''}${e.collection ? `\n    collection: { id: ${e.collection.id}, name: ${s(e.collection.name)} },` : ''}${e.trailer ? `\n    trailer: ${s(e.trailer)},` : ''}${e.people?.length ? `
    people: [
${e.people.map((p) => `      { name: ${s(p.name)}${p.character ? `, character: ${s(p.character)}` : ''}${p.photo ? `, photo: ${s(p.photo)}` : ''} },`).join('\n')}
    ],` : ''}${e.seasons?.length ? `
    seasons: [
${e.seasons.map((season) => `      {
        number: ${season.number},
        episodes: [
${season.episodes.map((ep) => `          { id: ${s(ep.id)}, number: ${ep.number}, title: ${s(ep.title)}, synopsis: ${s(ep.synopsis)}, runtime: ${ep.runtime}, sources: [] },`).join('\n')}
        ],
      },`).join('\n')}
    ],` : ''}${e.kind === 'serie' ? '' : '\n    sources: [],'}
    demo: false,
  },`).join('\n')

  return `/* eslint-disable */
/**
 * GENERATED — do not edit by hand.
 *
 * ${entries.length} titles from The Movie Database (${list}, ${lang}),
 * imported on ${when} by scripts/import-tmdb.mjs. Run it again to refresh.
 *
 * Metadata, artwork and title treatments only: none of these has a video
 * source, and the fiche
 * of each says so. They are here to give the grid, the filters and the search
 * realistic material to work on.
 *
 * Ce produit utilise l'API de TMDB mais n'est ni approuvé ni certifié par
 * TMDB. Les affiches appartiennent à leurs distributeurs respectifs.
 */
import type { Entry } from '@/types'

export const ${exportName}: Entry[] = [
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

/**
 * SERIES
 * ======
 * Films and series share nothing at TMDB but a host name: different
 * endpoints, different field names, and episodes that only arrive one season
 * at a time. A series therefore costs one request for itself and one per
 * season, where a film costs one. That is the price of real episode titles
 * and real French synopses for them.
 */
async function seriesRun({ args, key, lang, imageBase, out, exportName, pages }) {
  const wantSeasons = args.saisons !== 'false'
  const maxSeasons = Number(args['saisons-max'] ?? 10)
  const without = args['sans-genres'] ?? ''
  const addedAt = new Date().toISOString().slice(0, 10)

  process.stdout.write(`TMDB · séries · ${lang} · ${pages} page(s)${without ? ` · hors genres ${without}` : ''}\n`)

  const listed = []
  for (let page = 1; page <= pages; page += 1) {
    const data = await get('/discover/tv', {
      language: lang,
      page,
      sort_by: 'popularity.desc',
      include_adult: false,
      ...(without ? { without_genres: without } : {}),
    }, key)
    listed.push(...(data.results ?? []))
    process.stdout.write(`  page ${page}/${pages} — ${listed.length} séries\r`)
    if (data.total_pages && page >= data.total_pages) break
  }
  process.stdout.write('\n')

  const unique = listed.filter((t, i) => listed.findIndex((o) => o.id === t.id) === i)
  if (unique.length !== listed.length) {
    process.stdout.write(`  ${listed.length - unique.length} doublon(s) écarté(s)\n`)
  }

  const popularityOf = rescale(unique.map((t) => t.popularity ?? 0))
  let done = 0

  const built = await pool(unique, 4, async (t) => {
    const show = await get(`/tv/${t.id}`, {
      language: lang,
      append_to_response: 'credits,videos,images',
      include_video_language: 'fr,en,null',
      include_image_language: 'fr,en,null',
    }, key)

    const seasons = []
    if (wantSeasons) {
      const numbers = (show.seasons ?? [])
        /* Season 0 is TMDB's bucket for specials and recaps. */
        .map((x) => x.season_number)
        .filter((n) => n > 0)
        .slice(0, maxSeasons)
      for (const n of numbers) {
        const season = await get(`/tv/${show.id}/season/${n}`, { language: lang }, key)
        const shaped = toSeason(`tmdb-tv-${show.id}`, { ...season, season_number: n }, show.episode_run_time?.[0])
        if (shaped) seasons.push(shaped)
      }
    }

    process.stdout.write(`  détails ${++done}/${unique.length}\r`)
    return toSerie(show, { imageBase, popularityOf, addedAt, seasons })
  })
  process.stdout.write('\n')

  const entries = built.filter(Boolean)
  const file = render(entries, { list: 'séries populaires', lang, when: addedAt, exportName })
  await mkdir(dirname(out), { recursive: true })
  await writeFile(out, file, 'utf8')

  const episodes = entries.reduce((n, e) => n + e.seasons.reduce((m, x) => m + x.episodes.length, 0), 0)
  /* Measured on this project: about 0.65 ko compressed per title, 27 octets
     per episode. Printed because the catalogue is compiled into the bundle,
     so every import has a weight the visitor pays on first paint. */
  const poids = Math.round(entries.length * 0.65 + episodes * 0.027)

  console.log(`\n${entries.length} séries écrites dans ${out}`)
  console.log(`  ${episodes} épisode(s)`)
  console.log(`  ≈ ${poids} ko compressés ajoutés au paquet`)
  console.log('Relancez npm run dev pour les voir.')
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

  const exportName = args.export ?? 'TMDB_FILMS'
  const source = args.titres ? 'titres choisis' : list

  process.stdout.write(args.titres
    ? `TMDB · titres choisis · ${lang}\n`
    : `TMDB · ${list} · ${lang} · ${pages} page(s)\n`)

  const config = await get('/configuration', {}, key)
  const imageBase = config.images?.secure_base_url ?? 'https://image.tmdb.org/t/p/'

  if (args.series) {
    await seriesRun({ args, key, lang, imageBase, out, exportName, pages })
    return
  }

  const genreList = await get('/genre/movie/list', { language: lang }, key)
  const genreNames = new Map((genreList.genres ?? []).map((g) => [g.id, g.name]))

  const summaries = []

  if (args.titres) {
    /* Named films. Every match is printed, so a wrong one is visible before
       it lands in the catalogue rather than after. */
    for (const wanted of parseTitles(args.titres)) {
      const found = await get('/search/movie', {
        language: lang,
        query: wanted.title,
        include_adult: false,
        ...(wanted.year ? { year: wanted.year } : {}),
      }, key)

      const hit = (found.results ?? [])[0]
      const asked = `${wanted.title}${wanted.year ? ` (${wanted.year})` : ''}`
      if (!hit) {
        console.log(`  introuvable : ${asked}`)
        continue
      }
      console.log(`  ${asked} → ${hit.title} (${(hit.release_date ?? '').slice(0, 4)}) #${hit.id}`)
      summaries.push(hit)
    }
  } else {
    for (let page = 1; page <= pages; page++) {
      const data = await get(`/movie/${list}`, { language: lang, page }, key)
      summaries.push(...(data.results ?? []))
      process.stdout.write(`  page ${page}/${pages} — ${summaries.length} titres\r`)
    }
    process.stdout.write('\n')
  }

  /* The list shifts while we walk it, so a film can land on two pages. */
  const unique = summaries.filter((m, i) => summaries.findIndex((o) => o.id === m.id) === i)
  const duplicates = summaries.length - unique.length
  if (duplicates) process.stdout.write(`  ${duplicates} doublon(s) écarté(s)\n`)

  /* Runtime, director and cast only come with the details call. */
  let done = 0
  const details = await pool(unique, 8, async (m) => {
    const full = await get(`/movie/${m.id}`, { language: lang, append_to_response: 'credits,videos,images', include_video_language: 'fr,en,null', include_image_language: 'fr,en,null' }, key)
    process.stdout.write(`  détails ${++done}/${unique.length}\r`)
    return full
  })
  process.stdout.write('\n')

  const popularityOf = rescale(details.map((m) => m.popularity ?? 0))
  const addedAt = new Date().toISOString().slice(0, 10)
  const entries = details
    .map((m) => toEntry(m, { genreNames, imageBase, popularityOf, addedAt }))
    .filter(Boolean)

  const skipped = details.length - entries.length
  const file = render(entries, { list: source, lang, when: addedAt, exportName })
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
