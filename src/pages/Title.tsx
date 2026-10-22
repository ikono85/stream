import { FilmAmbiance } from '@/components/FilmAmbiance'
import { EpisodeVu } from '@/components/EpisodeVu'
import { FavoriteIcon } from '@/components/FavoriteIcon'
import { useSpoilers } from '@/hooks/useSpoilers'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PageTransition } from '@/components/layout/PageTransition'
import { Row } from '@/components/Row'
import { PosterCard, PosterSkeleton } from '@/components/Card'
import { Icon } from '@/components/Icon'
import { Art } from '@/components/Art'
import { Panne } from '@/components/RangeeDistante'
import { TrailerOverlay } from '@/components/Trailer'
import { useLibrary } from '@/hooks/libraryContext'
import { useRemote } from '@/hooks/useRemote'
import { episodes as chargeEpisodes, fiche, lisEntryId, semblables } from '@/lib/heiwa'
import { posterArt, bannerArt } from '@/lib/poster'
import { image, TAILLES } from '@/lib/images'
import { genreFiltrable } from '@/lib/genres'
import { NOM_AFFICHE, transitionsDeVue } from '@/lib/transitions'
import { suit } from '@/lib/suivi'
import { clock, ecartEnJours, jour, jourRelatif, langues, rating, shape } from '@/lib/format'
import { NotFound } from '@/pages/NotFound'

/**
 * LA FICHE
 * ========
 * Trois appels, et aucun ne bloque les autres :
 *
 *   /media/{type}/{tmdb}            le titre, ses visuels, ses saisons
 *   /tv/{tmdb}/{saison}             les épisodes de la saison regardée
 *   /media/{type}/{tmdb}/similar    « dans le même esprit »
 *
 * Les épisodes sont demandés saison par saison, et non d'un bloc : certaines
 * séries en comptent plus de mille, et /tv/{tmdb} sans numéro les renvoie
 * toutes.
 *
 * Ce que l'API ne donne pas, la fiche ne prétend pas l'avoir : il n'existe
 * aucune route de distribution ni de réalisation, donc aucun générique ici.
 */
export function Title() {
  const { sansSpoilers } = useSpoilers()
  const { id } = useParams<{ id: string }>()
  const cible = id ? lisEntryId(id) : null
  const { inList, toggleList, progressFor } = useLibrary()
  const [saison, setSaison] = useState<number | null>(null)
  const [bandeAnnonce, setBandeAnnonce] = useState(false)

  const titre = useRemote(
    (signal) => (cible ? fiche(cible.type, cible.tmdb, signal) : Promise.reject(new Error('id'))),
    [cible?.type, cible?.tmdb],
  )

  const entry = titre.data
  const serie = entry?.kind === 'serie'
  const saisons = entry?.seasons ?? []
  /* Sans choix explicite, la première saison que la fiche annonce. */
  const saisonVue = saison ?? saisons[0]?.number ?? 1

  const episodes = useRemote(
    (signal) => (cible && serie
      ? chargeEpisodes(cible.tmdb, saisonVue, signal).then((s) => s.find((x) => x.number === saisonVue)?.episodes ?? [])
      : Promise.resolve([])),
    [cible?.tmdb, serie, saisonVue],
  )

  const proches = useRemote(
    (signal) => (cible ? semblables(cible.type, cible.tmdb, signal) : Promise.resolve([])),
    [cible?.type, cible?.tmdb],
  )

  /* Une fiche réellement affichée, avec son titre : c'est le signal que le
     serveur ne peut pas déduire seul, l'application étant une page unique. */
  useEffect(() => {
    if (entry) suit('fiche', { id: entry.id, titre: entry.title })
  }, [entry])

  if (!cible) return <NotFound />

  /* Un titre absent du catalogue est un 404, pas une panne. */
  if (titre.error?.code === 'not_found') return <NotFound />

  if (titre.error && !entry) {
    return (
      <PageTransition>
        <div className="gutter mx-auto max-w-[90rem] pb-16 pt-32">
          <Panne message={titre.error.explication} onRetry={titre.recharge} />
        </div>
      </PageTransition>
    )
  }

  if (!entry) {
    return (
      <PageTransition>
        <div className="gutter mx-auto max-w-[90rem] pt-28 lg:pt-36">
          <div className="flex flex-col gap-8 lg:flex-row lg:gap-12">
            <div className="skeleton aspect-2/3 w-40 shrink-0 rounded-[var(--radius-poster)] sm:w-48 lg:w-60" />
            <div className="min-w-0 flex-1">
              <div className="skeleton h-12 w-[min(28rem,80%)] rounded-lg" />
              <div className="skeleton mt-4 h-4 w-56 rounded" />
              <div className="skeleton mt-6 h-20 w-full max-w-[62ch] rounded" />
              <div className="skeleton mt-7 h-12 w-64 rounded-full" />
            </div>
          </div>
        </div>
      </PageTransition>
    )
  }

  const saved = inList(entry.id)
  const resume = progressFor(entry.id)
  const forme = shape(entry)

  const meta = [
    entry.year > 0 ? String(entry.year) : null,
    forme,
    entry.rating !== undefined && entry.rating > 0 ? `${rating(entry.rating)}/10` : null,
    entry.quality,
  ].filter(Boolean) as string[]

  const playHref = resume?.episodeId
    ? `/lecture/${entry.id}?episode=${resume.episodeId}`
    : `/lecture/${entry.id}`

  return (
    <PageTransition>
      <div className="relative isolate">
        <div className="grain absolute inset-x-0 top-0 -z-10 h-[60vh] min-h-96 overflow-hidden">
          <Art
            src={image(entry.backdropPath, TAILLES.fondLarge)}
            fallback={bannerArt(entry.id)}
            alt=""
            fetchPriority="high"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-[linear-gradient(to_top,var(--color-ink-950)_0%,var(--color-ink-950)_38%,rgb(4_7_15_/_0.72)_72%,rgb(4_7_15_/_0.45)_100%)]" />
        </div>

        <FilmAmbiance poster={entry.posterPath} />
        <div className="gutter mx-auto max-w-[90rem] pt-28 lg:pt-36">
          <Link
            to="/catalogue"
            className="inline-flex items-center gap-1.5 text-sm text-haze-300 transition-colors hover:text-paper"
          >
            <Icon name="arrowLeft" size={16} />
            Catalogue
          </Link>

          <div className="mt-6 flex flex-col gap-8 lg:flex-row lg:gap-12">
            {/* L'autre extrémité du morphing : c'est le même nom qui relie
                l'affiche de la grille à celle-ci. */}
            <Art
              src={image(entry.posterPath, TAILLES.afficheLarge)}
              fallback={posterArt(entry.id)}
              alt={`Affiche de ${entry.title}`}
              style={transitionsDeVue ? { viewTransitionName: NOM_AFFICHE } : undefined}
              className="aspect-2/3 w-40 shrink-0 self-start rounded-[var(--radius-poster)] object-cover glow-lift sm:w-48 lg:w-60"
            />

            <div className="min-w-0 flex-1">
              <h1 className="font-wide text-[clamp(1.9rem,5.5vw,3.6rem)] font-extrabold leading-[0.98] tracking-[-0.015em] text-paper">
                {entry.title}
              </h1>

              {!sansSpoilers && entry.tagline && (
                <p className="mt-2 font-wide text-sm italic text-lamp-500">{entry.tagline}</p>
              )}

              <p className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-haze-300 nums-tabular">
                {meta.map((m) => <span key={m}>{m}</span>)}
                <span className="text-haze-400">
                  {entry.kind === 'film' ? 'Film' : entry.categorie === 'anime' ? 'Animé' : 'Série'}
                </span>
              </p>

              {entry.genres?.length ? (
                <ul className="mt-4 flex flex-wrap gap-2">
                  {entry.genres.map((g) => {
                    const filtrable = genreFiltrable(g)
                    return (
                      <li key={g}>
                        {filtrable ? (
                          <Link
                            to={`/catalogue?genre=${encodeURIComponent(filtrable)}`}
                            className="inline-flex h-8 items-center rounded-full border border-ink-600 px-3.5 text-xs text-haze-300 transition-colors hover:border-haze-400 hover:text-paper"
                          >
                            {g}
                          </Link>
                        ) : (
                          <span className="inline-flex h-8 items-center rounded-full border border-ink-700 px-3.5 text-xs text-haze-400">
                            {g}
                          </span>
                        )}
                      </li>
                    )
                  })}
                </ul>
              ) : null}

              {sansSpoilers && <p className="mt-6 text-sm text-haze-400">Résumé et bandes-annonces masqués · mode sans spoilers activé.</p>}
              {!sansSpoilers && entry.synopsis && (
                <p className="mt-6 max-w-[62ch] leading-relaxed text-haze-300">{entry.synopsis}</p>
              )}

              {/* Pour qui suit une série en cours, c'est l'information qu'on
                  vient chercher. Elle passe donc avant les boutons. */}
              {entry.nextEpisode && (
                <p className="mt-6 inline-flex flex-wrap items-center gap-x-2 gap-y-1 rounded-[var(--radius-panel)] border border-lamp-500/30 bg-lamp-500/10 px-4 py-2.5 text-sm text-paper">
                  <Icon name="calendar" size={16} className="shrink-0 text-lamp-500" />
                  <span className="font-medium">
                    Prochain épisode · S{entry.nextEpisode.season} E{entry.nextEpisode.episode}
                  </span>
                  {!sansSpoilers && entry.nextEpisode.name && (
                    <span className="text-haze-300">« {entry.nextEpisode.name} »</span>
                  )}
                  {entry.nextEpisode.airDate && (
                    <span className={ecartEnJours(entry.nextEpisode.airDate) === 0 ? 'font-semibold text-lamp-500' : 'text-haze-300'}>
                      {jourRelatif(entry.nextEpisode.airDate)}
                    </span>
                  )}
                </p>
              )}

              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link
                  to={playHref}
                  className="inline-flex h-12 items-center gap-2.5 rounded-full bg-lamp-500 px-7 font-semibold text-ink-950 transition-[background-color,box-shadow] hover:bg-lamp-400 hover:glow-lamp"
                >
                  <Icon name="play" size={19} />
                  {resume ? 'Reprendre' : 'Regarder'}
                </Link>

                {!sansSpoilers && entry.trailer && (
                  <button
                    type="button"
                    onClick={() => setBandeAnnonce(true)}
                    className="inline-flex h-12 items-center gap-2.5 rounded-full border border-ink-500 bg-ink-900/70 px-6 font-medium text-paper transition-colors hover:border-haze-400 hover:bg-ink-800"
                  >
                    <Icon name="play" size={18} />
                    Bande-annonce
                  </button>
                )}

                <button
                  type="button"
                  aria-pressed={saved}
                  onClick={() => toggleList(entry.id)}
                  className="inline-flex h-12 items-center gap-2.5 rounded-full border border-ink-500 bg-ink-900/70 px-6 font-medium text-paper transition-colors hover:border-haze-400 hover:bg-ink-800"
                >
                  <FavoriteIcon saved={saved} />
                  {saved ? 'Dans ma liste' : 'Ma liste'}
                </button>
              </div>

              <dl className="mt-8 grid gap-x-10 gap-y-4 text-sm sm:grid-cols-2">
                {entry.languages.length > 0 && (
                  <div>
                    <dt className="text-haze-400">Pistes disponibles</dt>
                    <dd className="mt-1 text-paper">{langues(entry.languages)}</dd>
                  </div>
                )}
                {entry.quality && (
                  <div>
                    <dt className="text-haze-400">Meilleure définition</dt>
                    <dd className="mt-1 text-paper">{entry.quality}</dd>
                  </div>
                )}
                {serie && saisons.length > 0 && (
                  <div>
                    <dt className="text-haze-400">Saisons</dt>
                    <dd className="mt-1 text-paper nums-tabular">
                      {saisons.length} · {saisons.reduce((n, s) => n + s.episodeCount, 0)} épisodes
                    </dd>
                  </div>
                )}
                {entry.ids.imdb && (
                  <div>
                    <dt className="text-haze-400">Identifiants</dt>
                    <dd className="mt-1 text-paper nums-tabular">
                      TMDB {entry.tmdb} · IMDb {entry.ids.imdb}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          </div>
        </div>
      </div>

      {serie && saisons.length > 0 && (
        <section className="gutter mx-auto mt-16 max-w-[90rem]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="font-wide text-xl font-bold text-paper">Épisodes</h2>
            {saisons.length > 1 && (
              <label className="flex items-center gap-2 text-sm text-haze-400">
                Saison
                <select
                  value={saisonVue}
                  onChange={(e) => setSaison(Number(e.target.value))}
                  className="h-9 rounded-full border border-ink-600 bg-ink-900 px-3 pr-8 text-sm text-paper outline-none transition-colors hover:border-haze-400"
                >
                  {saisons.map((s) => (
                    <option key={s.number} value={s.number}>
                      {sansSpoilers ? `Saison ${s.number}` : s.name ?? `Saison ${s.number}`} ({s.episodeCount})
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          {episodes.loading && !episodes.data && (
            <ul className="mt-5 divide-y divide-ink-700 border-y border-ink-700">
              {Array.from({ length: 6 }, (_, i) => (
                <li key={i} className="py-5">
                  <div className="skeleton h-5 w-64 rounded" />
                  <div className="skeleton mt-2 h-3 w-40 rounded" />
                </li>
              ))}
            </ul>
          )}

          {episodes.error && !episodes.data && (
            <p className="mt-6 text-sm text-haze-400">
              Les épisodes de cette saison n'ont pas pu être chargés. {episodes.error.explication}
            </p>
          )}

          {episodes.data && episodes.data.length > 0 && (
            <ol className="mt-5 divide-y divide-ink-700 border-y border-ink-700">
              {episodes.data.map((ep) => {
                const avance = progressFor(entry.id, ep.id)
                const pct = avance && avance.duration > 0
                  ? Math.min(100, (avance.seconds / avance.duration) * 100)
                  : 0
                const lisible = ep.sources > 0

                return (
                  <li key={ep.id} className="group flex items-start gap-4 py-5">
                    <span className="w-7 shrink-0 pt-0.5 text-right font-wide text-sm font-bold text-haze-400 nums-tabular">
                      {ep.number}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                        <h3 className="font-wide font-semibold text-paper">{sansSpoilers ? `Épisode ${ep.number}` : ep.title}</h3>
                        {ep.airDate && (
                          <span className="text-xs text-haze-400 nums-tabular">{jour(ep.airDate)}</span>
                        )}
                      </div>

                      <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-haze-400">
                        {ep.quality && <span className="nums-tabular">{ep.quality}</span>}
                        {ep.languages.length > 0 && <span>{langues(ep.languages)}</span>}
                        {lisible
                          ? <span>{ep.sources} {ep.sources === 1 ? 'source' : 'sources'}</span>
                          : <span className="text-haze-400/70">Pas encore disponible</span>}
                      </p>

                      {pct > 0 && avance && (
                        <div className="mt-3 flex items-center gap-3">
                          <div className="h-[3px] w-40 overflow-hidden rounded-full bg-ink-600">
                            <div className="h-full bg-lamp-500" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-haze-400 nums-tabular">
                            {clock(avance.seconds)}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center">
                    <EpisodeVu episodeId={ep.id} />
                    {lisible ? (
                      <Link
                        to={`/lecture/${entry.id}?episode=${ep.id}`}
                        aria-label={`Lire l'épisode ${ep.number}, ${sansSpoilers ? `Épisode ${ep.number}` : ep.title}`}
                        className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-ink-600 text-paper transition-colors hover:border-lamp-500 hover:bg-lamp-500 hover:text-ink-950"
                      >
                        <Icon name="play" size={16} className="translate-x-px" />
                      </Link>
                    ) : (
                      <span
                        title="Aucune source en service pour cet épisode"
                        className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-ink-700 text-ink-500"
                      >
                        <Icon name="warning" size={16} />
                      </span>
                    )}
                    </div>
                  </li>
                )
              })}
            </ol>
          )}

          {episodes.data && episodes.data.length === 0 && (
            <p className="mt-6 text-sm text-haze-400">
              Aucun épisode référencé pour cette saison.
            </p>
          )}
        </section>
      )}

      {(proches.loading || (proches.data && proches.data.length > 0)) && (
        <div className="mx-auto mt-14 max-w-[90rem]">
          <Row title="Dans le même esprit">
            {proches.data
              ? proches.data.map((e) => <PosterCard key={e.id} entry={e} />)
              : Array.from({ length: 7 }, (_, i) => <PosterSkeleton key={i} />)}
          </Row>
        </div>
      )}

      {!sansSpoilers && entry.trailer && (
        <TrailerOverlay
          trailer={entry.trailer}
          title={entry.title}
          open={bandeAnnonce}
          onClose={() => setBandeAnnonce(false)}
        />
      )}
    </PageTransition>
  )
}
