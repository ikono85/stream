import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageTransition } from '@/components/layout/PageTransition'
import { Hero } from '@/components/Hero'
import { Row } from '@/components/Row'
import { PosterCard, ResumeCard, PosterSkeleton, ResumeSkeleton } from '@/components/Card'
import { Icon } from '@/components/Icon'
import { useLibrary } from '@/hooks/libraryContext'
import { CATALOG, byId, hasVideo, HAS_ANIME } from '@/data/catalog'
import { recommend } from '@/lib/recommend'
import type { Entry } from '@/types'

const byPopularity = (a: Entry, b: Entry) => b.popularity - a.popularity
const byRating = (a: Entry, b: Entry) => b.rating - a.rating || b.popularity - a.popularity
const byYear = (a: Entry, b: Entry) => b.year - a.year || b.popularity - a.popularity

/** Titles in one row. A carousel past this is scrolling for its own sake. */
const ROW = 16
/** A genre thinner than this does not deserve a shelf of its own. */
const GENRE_MIN = 8
/** Genre rows in total, and how many more appear each time you reach the end. */
const GENRE_MAX = 10
const GENRE_STEP = 3
const GENRE_FIRST = 3

/**
 * One shelf per genre, biggest first. Grouping once here beats filtering the
 * whole catalogue inside every row.
 */
function shelvesByGenre(): { genre: string; items: Entry[] }[] {
  const groups = new Map<string, Entry[]>()
  for (const entry of CATALOG) {
    for (const genre of entry.genres) {
      const list = groups.get(genre)
      if (list) list.push(entry)
      else groups.set(genre, [entry])
    }
  }

  return [...groups.entries()]
    .filter(([, list]) => list.length >= GENRE_MIN)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, GENRE_MAX)
    .map(([genre, list]) => ({ genre, items: [...list].sort(byPopularity).slice(0, ROW) }))
}

/**
 * The spotlight: something that actually plays first — the point of the whole
 * thing — then the best-looking artwork the import brought back.
 */
function spotlight(): Entry[] {
  const withArt = CATALOG.filter((e) => Boolean(e.backdrop)).sort(byPopularity).slice(0, 4)
  const playable = CATALOG.filter(hasVideo).sort(byPopularity)[0]
  const rest = withArt.filter((e) => e.id !== playable?.id)
  return playable ? [playable, ...rest] : withArt
}

export function Home() {
  const { ready, progress, myList } = useLibrary()

  const featured = useMemo(() => spotlight(), [])
  const genres = useMemo(() => shelvesByGenre(), [])
  const playableCount = useMemo(() => CATALOG.filter(hasVideo).length, [])

  const rows = useMemo(() => ({
    playable: CATALOG.filter(hasVideo).sort(byPopularity),
    trending: [...CATALOG].sort(byPopularity).slice(0, ROW),
    /* Anime have their own row below; leaving them here as well would make
       these two shelves a duplicate of it. */
    films: CATALOG.filter((e) => e.kind === 'film' && e.origine !== 'anime').sort(byPopularity).slice(0, ROW),
    series: CATALOG.filter((e) => e.kind === 'serie' && e.origine !== 'anime').sort(byRating).slice(0, ROW),
    /* Release year, not the import date: ninety titles share one import date,
       which made the old "Nouveautés" row an arbitrary ninety-way tie. */
    recent: [...CATALOG].sort(byYear).slice(0, ROW),
    anime: CATALOG.filter((e) => e.origine === 'anime').sort(byPopularity).slice(0, ROW),
    short: CATALOG
      .filter((e) => e.kind === 'film' && (e.runtime ?? 0) > 0 && (e.runtime ?? 0) <= 100)
      .sort(byRating)
      .slice(0, ROW),
  }), [])

  const resumable = useMemo(
    () => progress
      .map((p) => ({ p, entry: byId(p.entryId) }))
      .filter((x): x is { p: typeof progress[number]; entry: NonNullable<ReturnType<typeof byId>> } => Boolean(x.entry))
      .sort((a, b) => b.p.updatedAt - a.p.updatedAt)
      .slice(0, 12),
    [progress],
  )

  const suggestions = useMemo(
    () => recommend(CATALOG, myList, progress),
    [myList, progress],
  )

  /* Twelve carousels mounted at once is a lot of DOM for a page most people
     scroll halfway down. The genre shelves arrive as they are needed. */
  const [shownGenres, setShownGenres] = useState(GENRE_FIRST)
  const sentinel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = sentinel.current
    if (!el || shownGenres >= genres.length) return
    const io = new IntersectionObserver(
      ([e]) => { if (e?.isIntersecting) setShownGenres((n) => Math.min(n + GENRE_STEP, genres.length)) },
      { rootMargin: '800px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [shownGenres, genres.length])

  return (
    <PageTransition>
      <Hero entries={featured} />

      <p className="gutter mx-auto flex max-w-[90rem] items-start gap-2.5 border-y border-ink-700 bg-ink-900/40 py-3 text-xs leading-relaxed text-haze-400">
        <Icon name="info" size={15} className="mt-px shrink-0" />
        <span>
          Catalogue de démonstration : {playableCount} titres sur {CATALOG.length} se lisent
          réellement — quatre courts métrages sous licence Creative Commons et une{' '}
          <Link to="/titre/mire-lucarne" className="text-haze-300 underline underline-offset-2 transition-colors hover:text-paper">
            mire de test
          </Link>. Les autres n'ont aucun fichier vidéo associé —{' '}
          <Link to="/catalogue?lisible=1" className="text-haze-300 underline underline-offset-2 transition-colors hover:text-paper">
            n'afficher que ce qui se lit
          </Link>.
        </span>
      </p>

      <div className="mx-auto max-w-[90rem] pb-8">
        {!ready && (
          <Row title="Reprendre la lecture">
            {Array.from({ length: 4 }, (_, i) => <ResumeSkeleton key={i} />)}
          </Row>
        )}

        {ready && resumable.length > 0 && (
          <Row title="Reprendre la lecture">
            {resumable.map(({ p, entry }) => (
              <ResumeCard key={`${p.entryId}-${p.episodeId ?? ''}`} entry={entry} progress={p} />
            ))}
          </Row>
        )}

        <Row title="Disponibles à la lecture" href="/catalogue?lisible=1">
          {rows.playable.map((entry, i) => (
            <PosterCard key={entry.id} entry={entry} eager={i < 6} />
          ))}
        </Row>

        <Row title={suggestions.personal ? 'Recommandé pour vous' : 'Les mieux notés'} href="/catalogue?tri=note">
          {!ready
            ? Array.from({ length: 7 }, (_, i) => <PosterSkeleton key={i} />)
            : suggestions.items.map((entry) => <PosterCard key={entry.id} entry={entry} />)}
        </Row>

        <Row title="Tendances du moment" href="/catalogue">
          {rows.trending.map((entry) => <PosterCard key={entry.id} entry={entry} />)}
        </Row>

        <Row title="Sorties récentes" href="/catalogue?tri=annee">
          {rows.recent.map((entry) => <PosterCard key={entry.id} entry={entry} />)}
        </Row>

        <Row title="Films populaires" href={HAS_ANIME ? '/catalogue?type=film&categorie=autre' : '/catalogue?type=film'}>
          {rows.films.map((entry) => <PosterCard key={entry.id} entry={entry} />)}
        </Row>

        <Row title="Séries à découvrir" href={HAS_ANIME ? '/catalogue?type=serie&categorie=autre' : '/catalogue?type=serie'}>
          {rows.series.map((entry) => <PosterCard key={entry.id} entry={entry} />)}
        </Row>

        {HAS_ANIME && rows.anime.length > 0 && (
          <Row title="Anime" href="/catalogue?categorie=anime">
            {rows.anime.map((entry) => <PosterCard key={entry.id} entry={entry} />)}
          </Row>
        )}

        {rows.short.length >= GENRE_MIN && (
          <Row title="Moins de cent minutes" href="/catalogue?type=film">
            {rows.short.map((entry) => <PosterCard key={entry.id} entry={entry} />)}
          </Row>
        )}

        {genres.slice(0, shownGenres).map(({ genre, items }) => (
          <Row key={genre} title={genre} href={`/catalogue?genre=${encodeURIComponent(genre)}`}>
            {items.map((entry) => <PosterCard key={entry.id} entry={entry} />)}
          </Row>
        ))}

        {shownGenres < genres.length && <div ref={sentinel} className="h-24" aria-hidden="true" />}
      </div>
    </PageTransition>
  )
}
