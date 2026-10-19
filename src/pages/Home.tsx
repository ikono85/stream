import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { PageTransition } from '@/components/layout/PageTransition'
import { Hero } from '@/components/Hero'
import { Row } from '@/components/Row'
import { PosterCard, ResumeCard, PosterSkeleton, ResumeSkeleton } from '@/components/Card'
import { Icon } from '@/components/Icon'
import { useLibrary } from '@/hooks/libraryContext'
import { CATALOG, byId, hasVideo } from '@/data/catalog'
import { recommend } from '@/lib/recommend'

const byPopularity = (a: { popularity: number }, b: { popularity: number }) => b.popularity - a.popularity

export function Home() {
  const { ready, progress, myList } = useLibrary()

  const featured = useMemo(
    () => [...CATALOG].filter(hasVideo).sort(byPopularity)[0] ?? CATALOG[0]!,
    [],
  )

  const playableCount = useMemo(() => CATALOG.filter(hasVideo).length, [])

  const rows = useMemo(() => ({
    playable: CATALOG.filter(hasVideo).sort(byPopularity),
    trending: [...CATALOG].sort(byPopularity).slice(0, 14),
    films: CATALOG.filter((e) => e.kind === 'film').sort(byPopularity).slice(0, 14),
    series: CATALOG.filter((e) => e.kind === 'serie').sort((a, b) => b.rating - a.rating).slice(0, 14),
    fresh: [...CATALOG].sort((a, b) => b.addedAt.localeCompare(a.addedAt)).slice(0, 14),
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

  return (
    <PageTransition>
      <Hero entry={featured} />

      <p className="gutter mx-auto flex max-w-[90rem] items-start gap-2.5 border-y border-ink-700 bg-ink-900/40 py-3 text-xs leading-relaxed text-haze-400">
        <Icon name="info" size={15} className="mt-px shrink-0" />
        <span>
          Catalogue de démonstration : {playableCount} titres sur {CATALOG.length} se lisent
          réellement — quatre courts métrages sous licence Creative Commons et une{' '}
          <Link to="/titre/mire-lucarne" className="text-haze-300 underline underline-offset-2 transition-colors hover:text-paper">
            mire de test
          </Link>. Les autres n'ont aucun fichier vidéo associé.
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

        <Row title="Disponibles à la lecture">
          {rows.playable.map((entry, i) => (
            <PosterCard key={entry.id} entry={entry} eager={i < 6} />
          ))}
        </Row>

        <Row title="Tendances du moment" href="/catalogue">
          {rows.trending.map((entry) => <PosterCard key={entry.id} entry={entry} />)}
        </Row>

        <Row title="Films populaires" href="/catalogue?type=film">
          {rows.films.map((entry) => <PosterCard key={entry.id} entry={entry} />)}
        </Row>

        <Row title="Séries à découvrir" href="/catalogue?type=serie">
          {rows.series.map((entry) => <PosterCard key={entry.id} entry={entry} />)}
        </Row>

        <Row title="Nouveautés" href="/catalogue?tri=recent">
          {rows.fresh.map((entry) => <PosterCard key={entry.id} entry={entry} />)}
        </Row>

        <Row title={suggestions.personal ? 'Recommandé pour vous' : 'Les mieux notés'}>
          {!ready
            ? Array.from({ length: 7 }, (_, i) => <PosterSkeleton key={i} />)
            : suggestions.items.map((entry) => <PosterCard key={entry.id} entry={entry} />)}
        </Row>
      </div>
    </PageTransition>
  )
}
