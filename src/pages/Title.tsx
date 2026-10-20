import { useMemo, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PageTransition } from '@/components/layout/PageTransition'
import { Row } from '@/components/Row'
import { PosterCard } from '@/components/Card'
import { Icon } from '@/components/Icon'
import { Art } from '@/components/Art'
import { TrailerOverlay } from '@/components/Trailer'
import { useLibrary } from '@/hooks/libraryContext'
import { CATALOG, byId, hasVideo, episodesOf, sagaOf } from '@/data/catalog'
import { personByName } from '@/data/people'
import { posterArt, bannerArt } from '@/lib/poster'
import { runtime, rating, clock, shape } from '@/lib/format'
import { NotFound } from '@/pages/NotFound'
import type { Entry } from '@/types'

/** Two letters for a missing portrait — better than an empty disc. */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('')
}

/**
 * A credited name becomes a link only when the catalogue has a page behind
 * it. An unknown name reads as plain text rather than as a dead end.
 */
function PersonLink({ name, className, children }: {
  name: string
  className?: string
  children: ReactNode
}) {
  const record = personByName(name)
  if (!record) return <span className={className}>{children}</span>
  return <Link to={`/personne/${record.slug}`} className={className}>{children}</Link>
}

const nameLink = 'underline-offset-2 transition-colors hover:text-lamp-500 hover:underline'

/**
 * TMDB files a series under names like "Avengers (Collection)" or "Harry
 * Potter - Saga". Left alone, the heading would read "La saga Harry Potter
 * Saga", so the word is stripped before it is added back properly.
 */
function sagaTitle(name: string): string {
  const clean = name
    .replace(/\s*[([]\s*(?:collection|saga)\s*[)\]]\s*$/i, '')
    .replace(/\s*[-–—:]?\s*(?:collection|saga)\s*$/i, '')
    .replace(/^\s*(?:collection|saga)\s*[-–—:]?\s*/i, '')
    .trim()
  return `La saga ${clean || name}`
}

function similar(entry: Entry): Entry[] {
  return CATALOG
    .filter((e) => e.id !== entry.id)
    .map((e) => ({ e, overlap: e.genres.filter((g) => entry.genres.includes(g)).length }))
    .filter(({ overlap }) => overlap > 0)
    .sort((a, b) => b.overlap - a.overlap || b.e.popularity - a.e.popularity)
    .slice(0, 12)
    .map(({ e }) => e)
}

export function Title() {
  const { id } = useParams<{ id: string }>()
  const entry = id ? byId(id) : undefined
  const { inList, toggleList, progressFor } = useLibrary()
  const [season, setSeason] = useState(1)
  const [trailerOpen, setTrailerOpen] = useState(false)

  const related = useMemo(() => (entry ? similar(entry) : []), [entry])
  const saga = useMemo(() => (entry ? sagaOf(entry) : []), [entry])

  if (!entry) return <NotFound />

  const saved = inList(entry.id)
  const people = entry.people ?? []
  const playable = hasVideo(entry)
  const episodes = episodesOf(entry)
  const current = entry.seasons?.find((s) => s.number === season) ?? entry.seasons?.[0]
  const resume = progressFor(entry.id)

  const meta = [
    String(entry.year),
    shape(entry),
    entry.rating > 0 ? `${rating(entry.rating)}/10` : null,
  ].filter(Boolean) as string[]

  const playHref = resume?.episodeId
    ? `/lecture/${entry.id}?episode=${resume.episodeId}`
    : `/lecture/${entry.id}`

  return (
    <PageTransition>
      <div className="relative isolate">
        <div className="grain absolute inset-x-0 top-0 -z-10 h-[60vh] min-h-96 overflow-hidden">
          <Art
            src={entry.backdrop}
            fallback={bannerArt(entry.id)}
            alt=""
            fetchPriority="high"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-[linear-gradient(to_top,var(--color-ink-950)_0%,var(--color-ink-950)_38%,rgb(4_7_15_/_0.72)_72%,rgb(4_7_15_/_0.45)_100%)]" />
        </div>

        <div className="gutter mx-auto max-w-[90rem] pt-28 lg:pt-36">
          <Link
            to="/catalogue"
            className="inline-flex items-center gap-1.5 text-sm text-haze-300 transition-colors hover:text-paper"
          >
            <Icon name="arrowLeft" size={16} />
            Catalogue
          </Link>

          <div className="mt-6 flex flex-col gap-8 lg:flex-row lg:gap-12">
            <Art
              src={entry.artwork}
              fallback={posterArt(entry.id)}
              alt={`Affiche de ${entry.title}`}
              className="aspect-2/3 w-40 shrink-0 self-start rounded-[var(--radius-poster)] object-cover glow-lift sm:w-48 lg:w-60"
            />

            <div className="min-w-0 flex-1">
              <h1 className="font-wide text-[clamp(1.9rem,5.5vw,3.6rem)] font-extrabold leading-[0.98] tracking-[-0.015em] text-paper">
                {entry.title}
              </h1>

              <p className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-haze-300 nums-tabular">
                {meta.map((m) => <span key={m}>{m}</span>)}
                <span className="text-haze-400">{entry.kind === 'film' ? 'Film' : 'Série'}</span>
              </p>

              <ul className="mt-4 flex flex-wrap gap-2">
                {entry.genres.map((g) => (
                  <li key={g}>
                    <Link
                      to={`/catalogue?genre=${encodeURIComponent(g)}`}
                      className="inline-flex h-8 items-center rounded-full border border-ink-600 px-3.5 text-xs text-haze-300 transition-colors hover:border-haze-400 hover:text-paper"
                    >
                      {g}
                    </Link>
                  </li>
                ))}
              </ul>

              <p className="mt-6 max-w-[62ch] leading-relaxed text-haze-300">{entry.synopsis}</p>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                {playable && (
                  <Link
                    to={playHref}
                    className="inline-flex h-12 items-center gap-2.5 rounded-full bg-lamp-500 px-7 font-semibold text-ink-950 transition-[background-color,box-shadow] hover:bg-lamp-400 hover:glow-lamp"
                  >
                    <Icon name="play" size={19} />
                    {resume ? 'Reprendre' : 'Regarder'}
                  </Link>
                )}

                {/* With nothing to play, the trailer is the only thing on offer,
                    so it takes the prominent button rather than sitting beside
                    a warning as an afterthought. */}
                {entry.trailer && (
                  <button
                    type="button"
                    onClick={() => setTrailerOpen(true)}
                    className={playable ? 'inline-flex h-12 items-center gap-2.5 rounded-full border border-ink-500 bg-ink-900/70 px-6 font-medium text-paper transition-colors hover:border-haze-400 hover:bg-ink-800' : 'inline-flex h-12 items-center gap-2.5 rounded-full bg-lamp-500 px-7 font-semibold text-ink-950 transition-[background-color,box-shadow] hover:bg-lamp-400 hover:glow-lamp'}
                  >
                    <Icon name="play" size={18} />
                    Bande-annonce
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => toggleList(entry.id)}
                  className="inline-flex h-12 items-center gap-2.5 rounded-full border border-ink-500 bg-ink-900/70 px-6 font-medium text-paper transition-colors hover:border-haze-400 hover:bg-ink-800"
                >
                  <Icon name={saved ? 'check' : 'plus'} size={18} />
                  {saved ? 'Dans ma liste' : 'Ma liste'}
                </button>

                {!playable && (
                  <p className="inline-flex h-12 items-center gap-2.5 rounded-full border border-ink-600 bg-ink-900 px-6 text-sm text-haze-400">
                    <Icon name="warning" size={17} />
                    Aucune source vidéo configurée
                  </p>
                )}
              </div>

              <dl className="mt-8 grid gap-x-10 gap-y-4 text-sm sm:grid-cols-2">
                {entry.director !== '—' && (
                  <div>
                    <dt className="text-haze-400">Réalisation</dt>
                    <dd className="mt-1 text-paper">
                      <PersonLink name={entry.director} className={nameLink}>
                        {entry.director}
                      </PersonLink>
                    </dd>
                  </div>
                )}
                {entry.studio && (
                  <div>
                    <dt className="text-haze-400">Studio</dt>
                    <dd className="mt-1 text-paper">{entry.studio}</dd>
                  </div>
                )}
                {entry.cast.length > 0 && people.length === 0 && (
                  <div>
                    <dt className="text-haze-400">Distribution</dt>
                    <dd className="mt-1 text-paper">
                      {entry.cast.map((name, i) => (
                        <span key={name}>
                          {i > 0 && ', '}
                          <PersonLink name={name} className={nameLink}>{name}</PersonLink>
                        </span>
                      ))}
                    </dd>
                  </div>
                )}
                {entry.license && (
                  <div>
                    <dt className="text-haze-400">Licence</dt>
                    <dd className="mt-1 text-paper">
                      {entry.license}
                      {entry.attribution && <span className="block text-haze-400">{entry.attribution}</span>}
                    </dd>
                  </div>
                )}
              </dl>

              {people.length > 0 && (
                <section className="mt-10">
                  <h2 className="font-wide text-xs font-bold uppercase tracking-[0.14em] text-haze-400">
                    Distribution
                  </h2>
                  <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-6">
                    {people.map((person) => (
                      <li key={`${person.name}-${person.character ?? ''}`} className="w-20 sm:w-[5.5rem]">
                        <PersonLink name={person.name} className="group block text-center">
                          {person.photo ? (
                            <img
                              src={person.photo}
                              alt=""
                              loading="lazy"
                              decoding="async"
                              className="mx-auto h-20 w-20 rounded-full bg-ink-800 object-cover ring-0 ring-lamp-500 transition-[box-shadow] group-hover:ring-2 sm:h-[5.5rem] sm:w-[5.5rem]"
                            />
                          ) : (
                            <span
                              aria-hidden="true"
                              className="mx-auto grid h-20 w-20 place-items-center rounded-full border border-ink-600 bg-ink-900 font-wide text-base font-bold text-haze-400 transition-colors group-hover:border-lamp-500 group-hover:text-paper sm:h-[5.5rem] sm:w-[5.5rem]"
                            >
                              {initials(person.name)}
                            </span>
                          )}
                          <p className="mt-2 text-xs font-medium leading-tight text-paper transition-colors group-hover:text-lamp-500">
                            {person.name}
                          </p>
                        </PersonLink>
                        {person.character && (
                          <p className="mt-0.5 text-center text-[0.68rem] leading-tight text-haze-400">
                            {person.character}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {entry.demo && (
                <p className="mt-8 flex max-w-[62ch] items-start gap-2.5 rounded-[var(--radius-panel)] border border-ink-600 bg-ink-900/60 p-4 text-sm leading-relaxed text-haze-400">
                  <Icon name="info" size={16} className="mt-0.5 shrink-0" />
                  <span>
                    Ce titre fait partie du catalogue de démonstration. Il est inventé : ni le film,
                    ni les personnes citées au générique n'existent. Rien n'est lisible tant qu'une
                    source n'est pas branchée.
                  </span>
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {entry.kind === 'serie' && entry.seasons && entry.seasons.length > 0 && (
        <section className="gutter mx-auto mt-16 max-w-[90rem]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="font-wide text-xl font-bold text-paper">Épisodes</h2>
            {entry.seasons.length > 1 && (
              <label className="flex items-center gap-2 text-sm text-haze-400">
                Saison
                <select
                  value={season}
                  onChange={(e) => setSeason(Number(e.target.value))}
                  className="h-9 rounded-full border border-ink-600 bg-ink-900 px-3 pr-8 text-sm text-paper outline-none transition-colors hover:border-haze-400"
                >
                  {entry.seasons.map((s) => (
                    <option key={s.number} value={s.number}>{s.number}</option>
                  ))}
                </select>
              </label>
            )}
          </div>

          <ol className="mt-5 divide-y divide-ink-700 border-y border-ink-700">
            {current?.episodes.map((ep) => {
              const epProgress = progressFor(entry.id, ep.id)
              const pct = epProgress && epProgress.duration > 0
                ? Math.min(100, (epProgress.seconds / epProgress.duration) * 100)
                : 0
              const epPlayable = ep.sources.length > 0

              return (
                <li key={ep.id} className="group flex items-start gap-4 py-5">
                  <span className="w-7 shrink-0 pt-0.5 text-right font-wide text-sm font-bold text-haze-400 nums-tabular">
                    {ep.number}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                      <h3 className="font-wide font-semibold text-paper">{ep.title}</h3>
                      <span className="text-xs text-haze-400 nums-tabular">{runtime(ep.runtime)}</span>
                    </div>
                    {ep.synopsis && (
                      <p className="mt-1.5 max-w-[68ch] text-sm leading-relaxed text-haze-400">
                        {ep.synopsis}
                      </p>
                    )}
                    {pct > 0 && epProgress && (
                      <div className="mt-3 flex items-center gap-3">
                        <div className="h-[3px] w-40 overflow-hidden rounded-full bg-ink-600">
                          <div className="h-full bg-lamp-500" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-haze-400 nums-tabular">
                          {clock(epProgress.seconds)}
                        </span>
                      </div>
                    )}
                  </div>

                  {epPlayable ? (
                    <Link
                      to={`/lecture/${entry.id}?episode=${ep.id}`}
                      aria-label={`Lire l'épisode ${ep.number}, ${ep.title}`}
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-ink-600 text-paper transition-colors hover:border-lamp-500 hover:bg-lamp-500 hover:text-ink-950"
                    >
                      <Icon name="play" size={16} className="translate-x-px" />
                    </Link>
                  ) : (
                    <span
                      title="Aucune source configurée"
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-ink-700 text-ink-500"
                    >
                      <Icon name="warning" size={16} />
                    </span>
                  )}
                </li>
              )
            })}
          </ol>

          {episodes.length === 0 && (
            <p className="mt-6 text-sm text-haze-400">Aucun épisode enregistré pour cette série.</p>
          )}
        </section>
      )}

      {saga.length > 0 && entry.collection && (
        <div className="mx-auto mt-14 max-w-[90rem]">
          <Row title={sagaTitle(entry.collection.name)}>
            {saga.map((e) => (
              <PosterCard key={e.id} entry={e} />
            ))}
          </Row>
        </div>
      )}

      {related.length > 0 && (
        <div className="mx-auto mt-14 max-w-[90rem]">
          <Row title="Dans le même esprit">
            {related.map((e) => <PosterCard key={e.id} entry={e} />)}
          </Row>
        </div>
      )}
      {entry.trailer && (
        <TrailerOverlay
          trailer={entry.trailer}
          title={entry.title}
          open={trailerOpen}
          onClose={() => setTrailerOpen(false)}
        />
      )}
    </PageTransition>
  )
}
