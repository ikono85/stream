import { FavoriteIcon } from '@/components/FavoriteIcon'
import { useSpoilers } from '@/hooks/useSpoilers'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Icon } from '@/components/Icon'
import { Art } from '@/components/Art'
import { StatusBadge } from '@/components/Badge'
import { useLibrary } from '@/hooks/libraryContext'
import { remaining, rating, shape, langues, ecartEnJours, jourRelatif } from '@/lib/format'
import { lisEpisodeId } from '@/lib/heiwa'
import { NOM_AFFICHE, avecTransition, clicOrdinaire, transitionsDeVue } from '@/lib/transitions'
import { posterArt, backdropArt } from '@/lib/poster'
import { image, TAILLES } from '@/lib/images'
import type { Entry, Progress } from '@/types'

/**
 * Une carte peut recevoir un titre complet, venu d'une fiche /media, ou un
 * titre nu, venu d'une page de catalogue au-delà de ce que le proxy enrichit.
 * Chaque bloc ci-dessous ne s'affiche donc que s'il a de quoi : l'affiche
 * dessinée remplace celle qui manque, et le résumé absent ne laisse pas de
 * trou.
 */
export function PosterCard({ entry, eager = false, fluid = false }: {
  entry: Entry
  eager?: boolean
  /** Let the grid decide the width instead of the carousel's fixed step. */
  fluid?: boolean
}) {
  const { sansSpoilers } = useSpoilers()
  const { inList, toggleList } = useLibrary()
  const saved = inList(entry.id)
  const forme = shape(entry)

  /* Un nom de transition doit être unique à l'écran : le poser sur cinquante
     cartes ferait échouer la transition en silence. Seule la carte cliquée
     le porte, et seulement le temps du changement de page. */
  const navigate = useNavigate()
  const [enTransition, setEnTransition] = useState(false)
  const fiche = `/titre/${entry.id}`
  const nomDeTransition = enTransition ? ({ viewTransitionName: NOM_AFFICHE } as const) : undefined

  /**
   * La fiche s'ouvre avec ce que la carte sait déjà — affiche, titre, année.
   * Sans cela, la page d'arrivée afficherait un rectangle gris le temps de
   * son appel, et l'affiche n'aurait nulle part où atterrir : la transition
   * se dégraderait en simple fondu.
   */
  const apercu = {
    id: entry.id,
    title: entry.title,
    year: entry.year,
    kind: entry.kind,
    categorie: entry.categorie,
    posterPath: entry.posterPath ?? null,
    backdropPath: entry.backdropPath ?? null,
  }

  function ouvre(e: React.MouseEvent) {
    if (!transitionsDeVue || !clicOrdinaire(e)) return
    e.preventDefault()
    void avecTransition(
      setEnTransition,
      () => navigate(fiche, { state: { apercu } }),
      () => import('@/pages/Title'),
    )
  }

  /* Un épisode qui sort aujourd'hui ou demain mérite d'être vu depuis
     l'affiche. Au-delà, l'information appartient à la fiche et au
     calendrier : une pastille « dans onze jours » n'aide personne. */
  const ecartProchain = ecartEnJours(entry.nextEpisode?.airDate)
  const sortieProche = ecartProchain !== null && ecartProchain >= 0 && ecartProchain <= 1

  return (
    <article className={`group relative ${fluid ? 'w-full' : 'shrink-0 snap-start w-36 sm:w-40 lg:w-44 xl:w-48'}`}>
      <div className="relative overflow-hidden rounded-[var(--radius-poster)] bg-ink-800 transition-[transform,box-shadow] duration-300 ease-[var(--ease-out-soft)] group-hover:scale-[1.045] group-hover:glow-warm group-focus-within:scale-[1.045] group-focus-within:glow-warm">
        <div className="grain relative aspect-2/3">
          <Art
            src={image(entry.posterPath, TAILLES.affiche)}
            fallback={posterArt(entry.id)}
            alt=""
            loading={eager ? 'eager' : 'lazy'}
            decoding="async"
            style={nomDeTransition}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-x-0 bottom-0 p-2.5 pt-14 bg-gradient-to-t from-ink-950 via-ink-950/85 via-35% to-transparent">
            <h3 className="font-wide text-[0.8rem] font-bold leading-tight line-clamp-2 text-paper">
              {entry.title}
            </h3>
            <p className="mt-0.5 flex items-center gap-2 text-[0.68rem] text-haze-400 nums-tabular">
              {entry.year > 0 && <span>{entry.year}</span>}
              {forme && <span>{forme}</span>}
            </p>
          </div>
        </div>

        {/* The whole card leads to the detail page. It comes FIRST so the
            controls below paint on top of it: among absolutely positioned
            siblings the last one wins the stack, and this link would
            otherwise swallow every click meant for a button. */}
        <Link
          to={fiche}
          state={{ apercu }}
          onClick={ouvre}
          className="absolute inset-0 rounded-[var(--radius-poster)]"
          aria-label={entry.year > 0 ? `${entry.title}, ${entry.year}` : entry.title}
        >
          <span className="sr-only">{entry.title}</span>
        </Link>

        <StatusBadge entry={entry} className="pointer-events-none absolute left-2 top-2 z-10" />

        {sortieProche && entry.nextEpisode && (
          <span className="pointer-events-none absolute right-2 top-2 z-10 rounded-full bg-lamp-500 px-2 py-0.5 font-wide text-[0.58rem] font-bold uppercase tracking-[0.06em] text-ink-950">
            S{entry.nextEpisode.season} E{entry.nextEpisode.episode} {jourRelatif(entry.nextEpisode.airDate)}
          </span>
        )}

        {/* Pointer-only panel: everything it offers is reachable another way,
            so touch screens — where a hover state sticks — never see it. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 translate-y-2 p-2 opacity-0 transition-[opacity,transform] duration-200 ease-[var(--ease-out-soft)] group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100 max-[1024px]:hidden">
          <div className="pointer-events-auto rounded-[var(--radius-poster)] border border-ink-600/80 bg-ink-950/95 p-2.5 backdrop-blur-md">
            {/* The panel hides the resting title, and a generated poster
                carries none of its own — so it has to be repeated here. */}
            <h3 className="font-wide text-[0.78rem] font-bold leading-tight line-clamp-2 text-paper">
              {entry.title}
            </h3>

            <p className="mt-1 flex items-center gap-2 text-[0.66rem] text-haze-400 nums-tabular">
              {entry.year > 0 && <span>{entry.year}</span>}
              {forme && <span>{forme}</span>}
              {entry.rating !== undefined && entry.rating > 0 && (
                <span className="text-lamp-500">{rating(entry.rating)}</span>
              )}
              {entry.quality && <span>{entry.quality}</span>}
            </p>

            {entry.genres?.length ? (
              <p className="mt-1 truncate text-[0.66rem] text-haze-300">{entry.genres.join(' · ')}</p>
            ) : entry.languages.length > 0 ? (
              <p className="mt-1 truncate text-[0.66rem] text-haze-300">{langues(entry.languages)}</p>
            ) : null}

            {!sansSpoilers && entry.synopsis && (
              <p className="mt-1.5 text-[0.68rem] leading-snug line-clamp-2 text-haze-400">
                {entry.synopsis}
              </p>
            )}

            <div className="mt-2.5 flex items-center gap-1.5">
              <Link
                to={`/lecture/${entry.id}`}
                aria-label={`Lire ${entry.title}`}
                className="grid h-8 w-8 place-items-center rounded-full bg-lamp-500 text-ink-950 transition-colors hover:bg-lamp-400"
              >
                <Icon name="play" size={15} className="translate-x-px" />
              </Link>
              <button
                type="button"
                aria-pressed={saved}
                  onClick={() => toggleList(entry.id)}
                aria-label={saved ? `Retirer ${entry.title} de ma liste` : `Ajouter ${entry.title} à ma liste`}
                className={`grid h-8 w-8 place-items-center rounded-full border transition-colors ${
                  saved
                    ? 'border-lamp-500 text-lamp-500 hover:bg-lamp-500 hover:text-ink-950'
                    : 'border-ink-500 text-paper hover:border-haze-400 hover:bg-ink-800'
                }`}
              >
                <FavoriteIcon saved={saved} size={15} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </article>
  )
}

/** Landscape card — something you started. The shape says so. */
export function ResumeCard({ entry, progress }: { entry: Entry; progress: Progress }) {
  const { dropProgress } = useLibrary()

  /* Une durée connue, donc une vraie progression. Sans elle, on sait
     seulement ce qui a été lancé et quand : pas de barre, pas de « il reste
     34 min » qu'aucune mesure n'appuie. */
  const mesuree = progress.duration > 0
  const pct = mesuree
    ? Math.min(100, Math.round((progress.seconds / progress.duration) * 100))
    : 0

  const episode = progress.episodeId ? lisEpisodeId(progress.episodeId) : null
  const legende = mesuree
    ? remaining(progress.seconds, progress.duration)
    : [
        episode ? `S${episode.season} E${episode.number}` : null,
        jourRelatif(new Date(progress.updatedAt).toISOString()),
      ].filter(Boolean).join(' · ')

  const target = progress.episodeId
    ? `/lecture/${entry.id}?episode=${progress.episodeId}`
    : `/lecture/${entry.id}`

  return (
    <article className="group relative shrink-0 snap-start w-64 sm:w-72 lg:w-80">
      <div className="relative overflow-hidden rounded-[var(--radius-poster)] bg-ink-800 transition-[transform,box-shadow] duration-300 ease-[var(--ease-out-soft)] group-hover:scale-[1.03] group-hover:glow-warm group-focus-within:scale-[1.03] group-focus-within:glow-warm">
        <div className="grain relative aspect-video">
          <Art
            src={image(entry.backdropPath, TAILLES.fond)}
            fallback={backdropArt(entry.id)}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-ink-950/25 transition-colors group-hover:bg-ink-950/50" />

          <div className="pointer-events-none absolute inset-0 grid place-items-center opacity-0 transition-opacity duration-200 group-hover:opacity-100 max-[1024px]:opacity-100">
            <Link
              to={target}
              aria-label={mesuree ? `Reprendre ${entry.title}` : `Relancer ${entry.title}`}
              className="pointer-events-auto grid h-14 w-14 place-items-center rounded-full bg-lamp-500/95 text-ink-950 glow-lamp"
            >
              <Icon name="play" size={22} className="translate-x-px" />
            </Link>
          </div>

          <button
            type="button"
            onClick={(e) => { e.preventDefault(); dropProgress(entry.id) }}
            aria-label={`Retirer ${entry.title} de la reprise`}
            className="absolute right-2 top-2 z-10 grid h-8 w-8 place-items-center rounded-full bg-ink-950/80 text-haze-300 opacity-0 backdrop-blur-sm transition-[opacity,color,background-color] hover:bg-ink-700 hover:text-paper group-hover:opacity-100 group-focus-within:opacity-100 max-[1024px]:opacity-100"
          >
            <Icon name="close" size={15} />
          </button>
        </div>

        {/* La barre n'apparaît que si elle dit quelque chose. */}
        {mesuree ? (
          <div className="relative h-[3px] bg-ink-600">
            <div className="h-full bg-lamp-500" style={{ width: `${pct}%` }} />
          </div>
        ) : (
          <div className="h-[3px] bg-ink-700" />
        )}

        <div className="p-3">
          <h3 className="font-wide text-sm font-bold leading-tight text-paper line-clamp-1">
            {entry.title}
          </h3>
          <p className="mt-1 text-xs text-haze-400 nums-tabular">{legende}</p>
        </div>

        <Link
          to={`/titre/${entry.id}`}
          className="absolute inset-x-0 bottom-0 top-auto h-[72px] rounded-b-[var(--radius-poster)]"
          aria-label={`Fiche de ${entry.title}`}
        >
          <span className="sr-only">Voir la fiche</span>
        </Link>
      </div>
    </article>
  )
}

export function PosterSkeleton({ fluid = false }: { fluid?: boolean }) {
  return (
    <div className={fluid ? 'w-full' : 'shrink-0 snap-start w-36 sm:w-40 lg:w-44 xl:w-48'}>
      <div className="skeleton aspect-2/3 rounded-[var(--radius-poster)]" />
    </div>
  )
}

export function ResumeSkeleton() {
  return (
    <div className="shrink-0 snap-start w-64 sm:w-72 lg:w-80">
      <div className="skeleton aspect-video rounded-t-[var(--radius-poster)]" />
      <div className="skeleton mt-[3px] h-[72px] rounded-b-[var(--radius-poster)]" />
    </div>
  )
}
