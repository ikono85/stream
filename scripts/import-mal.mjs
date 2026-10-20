#!/usr/bin/env node
/**
 * IMPORT MYANIMELIST
 * ==================
 * Builds `src/data/anime.ts` from the official MyAnimeList API, which feeds
 * the Anime category of the site.
 *
 * Usage:
 *   node scripts/import-mal.mjs --id=VOTRE_CLIENT_ID
 *   MAL_CLIENT_ID=... node scripts/import-mal.mjs --pages=3 --classement=tv
 *
 * Options (defaults in brackets):
 *   --id=          MAL client id, or the MAL_CLIENT_ID environment variable.
 *   --pages=       Pages of 100 titles to walk.                         [2]
 *   --classement=  bypopularity | all | airing | upcoming | favorite
 *                  | tv | movie | ova | special                [bypopularity]
 *   --delai=       Milliseconds between requests.                     [400]
 *   --export=      Name of the exported constant.                   [ANIME]
 *   --out=         Destination file.              [src/data/anime.ts]
 *
 * ONE REQUEST PER HUNDRED TITLES. The ranking endpoint returns whole records
 * when asked for them through `fields`, so unlike a REST API that makes you
 * fetch each title separately, two hundred anime cost two calls. The spacing
 * below is politeness, not necessity.
 *
 * The client id travels in a header and stays on this machine. The browser
 * never sees it; do not move these calls into the application.
 *
 * WHAT THIS SOURCE DOES NOT HAVE, and what the catalogue does about it:
 *
 *   Episode lists — the v2 API exposes none. A series therefore arrives with
 *     its episode COUNT and no episodes. The fiche says so rather than
 *     inventing a thousand rows of "Épisode 417".
 *   Landscape artwork, trailers, cast — none of it exists here either. The
 *     generated artwork covers the backdrop; the rest is simply absent.
 *   French — synopses come in English only. That seam is real, and the footer
 *     admits it.
 *
 * In exchange it knows anime better than anything else, which is the whole
 * reason this file exists.
 */

import { writeFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'

const API = 'https://api.myanimelist.net/v2'

/* Everything worth having, asked for in one go. */
const FIELDS = [
  'id', 'title', 'alternative_titles', 'main_picture', 'start_date', 'synopsis',
  'mean', 'popularity', 'num_list_users', 'nsfw', 'genres', 'media_type',
  'num_episodes', 'start_season', 'average_episode_duration', 'studios',
].join(',')

export const OPTIONS = ['id', 'pages', 'classement', 'delai', 'export', 'out']

/** Options, strictly: an unknown one stops the run rather than being ignored. */
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
 * MyAnimeList answers in English, and this catalogue speaks French.
 *
 * The table is also the allow list: a label with no French spelling here does
 * not come in at all. MAL files themes and demographics among the genres —
 * School, Shounen, Time Travel, Idols, some eighty labels — and letting them
 * through would bury the filter strip under English. Better a short, certain
 * vocabulary than a long, half-translated one.
 */
const GENRES = {
  action: 'Action',
  adventure: 'Aventure',
  'avant garde': 'Expérimental',
  'boys love': 'Romance',
  comedy: 'Comédie',
  drama: 'Drame',
  fantasy: 'Fantastique',
  'girls love': 'Romance',
  gourmet: 'Cuisine',
  horror: 'Horreur',
  mystery: 'Mystère',
  romance: 'Romance',
  'sci-fi': 'Science-Fiction',
  'slice of life': 'Tranche de vie',
  sports: 'Sport',
  supernatural: 'Surnaturel',
  suspense: 'Thriller',
}

export function toGenres(list) {
  /* Animation first: it files these titles with everything else that is
     drawn. The Anime category itself comes from the file they land in, not
     from a genre. */
  const out = ['Animation']
  for (const g of list ?? []) {
    const name = GENRES[(g?.name ?? '').trim().toLowerCase()]
    if (name && !out.includes(name)) out.push(name)
  }
  return out
}

/**
 * Durations arrive in seconds per episode. A film has one "episode", so the
 * same field carries the whole running time.
 */
export function toMinutes(seconds) {
  if (!seconds || seconds < 30) return 0
  return Math.round(seconds / 60)
}

/**
 * A series or a film? Only "movie" is unambiguous. A single-episode OVA or
 * special is a short film in all but MAL's filing, and giving it a season
 * would make the fiche lie about its shape.
 */
export function kindOf(node) {
  if (node.media_type === 'movie') return 'film'
  const type = node.media_type
  if (type !== 'tv' && type !== 'ona' && node.num_episodes === 1) return 'film'
  return 'serie'
}

/** One MAL record as a catalogue entry literal, or nothing. */
export function toEntry(node, { popularityOf, addedAt }) {
  /* nsfw: 'white' is safe, 'gray' borderline, 'black' explicit. */
  if (node.nsfw && node.nsfw !== 'white') return null

  const year = node.start_season?.year ?? Number((node.start_date ?? '').slice(0, 4))
  const poster = node.main_picture?.large ?? node.main_picture?.medium
  const synopsis = (node.synopsis ?? '').replace(/\s+/g, ' ').trim()
  if (!year || !poster || !synopsis) return null

  const kind = kindOf(node)
  const minutes = toMinutes(node.average_episode_duration)
  const studio = (node.studios ?? [])[0]?.name

  return {
    kind,
    id: `mal-${node.id}`,
    title: node.alternative_titles?.en || node.title,
    year,
    genres: toGenres(node.genres),
    rating: Math.round((node.mean ?? 0) * 10) / 10,
    /* MAL credits studios, never a director. The fiche hides the dash. */
    director: '—',
    ...(studio ? { studio } : {}),
    cast: [],
    synopsis,
    popularity: popularityOf(node.num_list_users ?? 0),
    addedAt,
    artwork: poster,
    ...(kind === 'film'
      ? { runtime: minutes || undefined }
      : { episodeCount: node.num_episodes || undefined }),
  }
}

/**
 * MAL counts how many people have a title on a list — hundreds of thousands
 * for a hit, a few dozen for the obscure. The catalogue sorts on a 0-100
 * field, so the imported set is rescaled against itself.
 */
export function rescale(values) {
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const span = max - min || 1
  return (v) => Math.round(((v - min) / span) * 99) + 1
}

const s = (v) => JSON.stringify(v)

export function render(entries, { source, when, exportName = 'ANIME' }) {
  const body = entries.map((e) => `  {
    kind: '${e.kind}',
    id: ${s(e.id)},
    title: ${s(e.title)},
    year: ${e.year},${e.runtime ? `\n    runtime: ${e.runtime},` : ''}${e.episodeCount ? `\n    episodeCount: ${e.episodeCount},` : ''}
    rating: ${e.rating}, popularity: ${e.popularity}, addedAt: ${s(e.addedAt)},
    genres: [${e.genres.map(s).join(', ')}],
    director: ${s(e.director)},${e.studio ? `\n    studio: ${s(e.studio)},` : ''}
    cast: [],
    synopsis: ${s(e.synopsis)},
    artwork: ${s(e.artwork)},${e.kind === 'film' ? '\n    sources: [],' : ''}
    demo: false,
  },`).join('\n')

  return `/* eslint-disable */
/**
 * GENERATED — do not edit by hand.
 *
 * ${entries.length} anime from MyAnimeList (${source}),
 * imported on ${when} by scripts/import-mal.mjs. Run it again to refresh.
 *
 * Metadata and artwork only: nothing here is playable, and each fiche says so.
 *
 * Synopses are in English — MyAnimeList publishes none in French. Series
 * carry their episode COUNT rather than a list: the API exposes no episodes,
 * and inventing them would be worse than admitting the gap.
 *
 * Données de MyAnimeList. MyAnimeList n'approuve ni ne certifie ce projet.
 * Les affiches appartiennent à leurs ayants droit.
 */
import type { Entry } from '@/types'

export const ${exportName}: Entry[] = [
${body}
]
`
}

/* ---------- the network side ---------- */

let lastCall = 0
let spacing = 400

async function get(path, params, id, attempt = 0) {
  const wait = lastCall + spacing - Date.now()
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  lastCall = Date.now()

  const url = new URL(API + path)
  for (const [k, v] of Object.entries(params ?? {})) {
    if (v !== undefined && v !== '') url.searchParams.set(k, String(v))
  }

  let res
  try {
    res = await fetch(url, { headers: { 'X-MAL-CLIENT-ID': id } })
  } catch (err) {
    const why = err.cause?.code ?? err.cause?.message ?? err.message
    if (attempt >= 2) throw new Error(`réseau injoignable sur ${path} — ${why}`)
    process.stdout.write(`\n  échec réseau (${why}), nouvelle tentative\n`)
    await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)))
    return get(path, params, id, attempt + 1)
  }

  if (res.status === 401 || res.status === 403) {
    throw new Error(`identifiant client refusé (${res.status}) — vérifiez --id`)
  }
  if (res.status === 429) {
    if (attempt >= 3) throw new Error('MAL limite le débit (429) — relancez avec --delai=1500')
    process.stdout.write('\n  429 — pause\n')
    await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)))
    return get(path, params, id, attempt + 1)
  }
  if (!res.ok) throw new Error(`MAL a répondu ${res.status} sur ${path}`)
  return res.json()
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const id = args.id ?? process.env.MAL_CLIENT_ID
  if (!id) {
    console.error(`
Il manque l'identifiant client MyAnimeList.

  1. Connectez-vous sur https://myanimelist.net
  2. Paramètres du compte → onglet API → Create ID
  3. Une fois l'application créée, « Edit » affiche le Client ID
  4. node scripts/import-mal.mjs --id=VOTRE_CLIENT_ID

Seul le Client ID est nécessaire : les données publiques d'anime ne passent
pas par OAuth. Le Client Secret ne sert pas ici.
`)
    process.exit(1)
  }

  const pages = Number(args.pages ?? 2)
  const ranking = args.classement ?? 'bypopularity'
  const exportName = args.export ?? 'ANIME'
  const out = args.out ?? 'src/data/anime.ts'
  spacing = Number(args.delai ?? 400)

  process.stdout.write(`MyAnimeList · ${ranking} · ${pages} page(s) de 100\n`)

  const nodes = []
  for (let page = 0; page < pages; page += 1) {
    const data = await get('/anime/ranking', {
      ranking_type: ranking,
      limit: 100,
      offset: page * 100,
      fields: FIELDS,
    }, id)
    const batch = (data.data ?? []).map((row) => row.node).filter(Boolean)
    nodes.push(...batch)
    process.stdout.write(`  page ${page + 1}/${pages} — ${nodes.length} titres\n`)
    if (!batch.length || !data.paging?.next) break
  }

  const unique = nodes.filter((n, i) => nodes.findIndex((o) => o.id === n.id) === i)
  if (unique.length !== nodes.length) {
    process.stdout.write(`  ${nodes.length - unique.length} doublon(s) écarté(s)\n`)
  }

  const popularityOf = rescale(unique.map((n) => n.num_list_users ?? 0))
  const addedAt = new Date().toISOString().slice(0, 10)
  const entries = unique.map((n) => toEntry(n, { popularityOf, addedAt })).filter(Boolean)

  const file = render(entries, { source: ranking, when: addedAt, exportName })
  await mkdir(dirname(out), { recursive: true })
  await writeFile(out, file, 'utf8')

  const films = entries.filter((e) => e.kind === 'film').length
  /* Measured on this project: about 0.65 ko compressed per title. */
  console.log(`\n${entries.length} anime écrits dans ${out}`)
  console.log(`  ${films} film(s), ${entries.length - films} série(s)`)
  console.log(`  ≈ ${Math.round(entries.length * 0.65)} ko compressés ajoutés au paquet`)
  if (unique.length - entries.length) {
    console.log(`  ${unique.length - entries.length} écarté(s) : contenu adulte, ou sans affiche, synopsis ou date`)
  }
  console.log('Relancez npm run dev pour les voir.')
}

if (process.argv[1]?.endsWith('import-mal.mjs')) {
  main().catch((err) => {
    console.error(`\nÉchec : ${err.message}`)
    process.exit(1)
  })
}
