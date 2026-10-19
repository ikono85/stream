import { Link } from 'react-router-dom'
import { Icon } from '@/components/Icon'
import { useLibrary } from '@/hooks/libraryContext'
import { runtime, seasonCount, remaining } from '@/lib/format'
import { posterArt, backdropArt } from '@/lib/poster'
import { hasVideo } from '@/data/catalog'
import type { Entry, Progress } from '@/types'

function metaLine(entry: Entry): string {
  if (entry.kind === 'film') return entry.runtime ? runtime(entry.runtime) : ''
  return seasonCount(entry.seasons?.length ?? 1)
}

/** Portrait card — something you have not started. */
export function PosterCard({ entry, eager = false, fluid = false }: {
  entry: Entry
  eager?: boolean
  /** Let the grid decide the width instead of the carousel's fixed step. */
  fluid?: boolean
}) {
  const { inList, toggleList } = useLibrary()
  const saved = inList(entry.id)
  const playable = hasVideo(entry)

  return (
    <article className={`group relative ${fluid ? 'w-full' : 'shrink-0 w-36 sm:w-40 lg:w-44 xl:w-48'}`}>
      <div className="relative overflow-hidden rounded-[var(--radius-poster)] bg-ink-800 transition-[transform,box-shadow] duration-300 ease-[var(--ease-out-soft)] group-hover:scale-[1.045] group-hover:glow-lift group-focus-within:scale-[1.045]">
        <div className="grain relative aspect-2/3">
          <img
            src={entry.artwork ?? posterArt(entry.id)}
            alt=""
            loading={eager ? 'eager' : 'lazy'}
            decoding="async"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-x-0 bottom-0 p-2.5 pt-14 bg-gradient-to-t from-ink-950 via-ink-950/85 via-35% to-transparent">
            <h3 className="font-wide text-[0.8rem] font-bold leading-tight line-clamp-2 text-paper">
              {entry.title}
            </h3>
            <p className="mt-0.5 flex items-center gap-2 text-[0.68rem] text-haze-400 nums-tabular">
              <span>{entry.year}</span>
              {metaLine(entry) && <span>{metaLine(entry)}</span>}
            </p>
          </div>
        </div>

        {/* Pointer-only affordance; everything here is reachable another way. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-end gap-1.5 p-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100 max-[1024px]:hidden">
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); toggleList(entry.id) }}
            aria-label={saved ? `Retirer ${entry.title} de ma liste` : `Ajouter ${entry.title} à ma liste`}
            className="pointer-events-auto grid h-8 w-8 place-items-center rounded-full bg-ink-950/80 text-paper backdrop-blur-sm transition-colors hover:bg-lamp-500 hover:text-ink-950"
          >
            <Icon name={saved ? 'check' : 'plus'} size={16} />
          </button>
        </div>

        {playable && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center opacity-0 transition-opacity duration-200 group-hover:opacity-100 max-[1024px]:hidden">
            <Link
              to={`/lecture/${entry.id}`}
              onClick={(e) => e.stopPropagation()}
              aria-label={`Lire ${entry.title}`}
              className="pointer-events-auto grid h-12 w-12 place-items-center rounded-full bg-lamp-500 text-ink-950 glow-lamp"
            >
              <Icon name="play" size={20} className="translate-x-px" />
            </Link>
          </div>
        )}

        <Link
          to={`/titre/${entry.id}`}
          className="absolute inset-0 rounded-[var(--radius-poster)]"
          aria-label={`${entry.title}, ${entry.year}`}
        >
          <span className="sr-only">{entry.title}</span>
        </Link>
      </div>
    </article>
  )
}

/** Landscape card — something you started. The shape says so. */
export function ResumeCard({ entry, progress }: { entry: Entry; progress: Progress }) {
  const { dropProgress } = useLibrary()
  const pct = progress.duration > 0
    ? Math.min(100, Math.round((progress.seconds / progress.duration) * 100))
    : 0

  const target = progress.episodeId
    ? `/lecture/${entry.id}?episode=${progress.episodeId}`
    : `/lecture/${entry.id}`

  return (
    <article className="group relative shrink-0 w-64 sm:w-72 lg:w-80">
      <div className="relative overflow-hidden rounded-[var(--radius-poster)] bg-ink-800 transition-[transform,box-shadow] duration-300 ease-[var(--ease-out-soft)] group-hover:scale-[1.03] group-hover:glow-lift group-focus-within:scale-[1.03]">
        <div className="grain relative aspect-video">
          <img
            src={entry.backdrop ?? backdropArt(entry.id)}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-ink-950/25 transition-colors group-hover:bg-ink-950/50" />

          <div className="pointer-events-none absolute inset-0 grid place-items-center opacity-0 transition-opacity duration-200 group-hover:opacity-100 max-[1024px]:opacity-100">
            <Link
              to={target}
              aria-label={`Reprendre ${entry.title}`}
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

        <div className="relative h-[3px] bg-ink-600">
          <div className="h-full bg-lamp-500" style={{ width: `${pct}%` }} />
        </div>

        <div className="p-3">
          <h3 className="font-wide text-sm font-bold leading-tight text-paper line-clamp-1">
            {entry.title}
          </h3>
          <p className="mt-1 text-xs text-haze-400 nums-tabular">
            {remaining(progress.seconds, progress.duration)}
          </p>
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
    <div className={fluid ? 'w-full' : 'shrink-0 w-36 sm:w-40 lg:w-44 xl:w-48'}>
      <div className="skeleton aspect-2/3 rounded-[var(--radius-poster)]" />
    </div>
  )
}

export function ResumeSkeleton() {
  return (
    <div className="shrink-0 w-64 sm:w-72 lg:w-80">
      <div className="skeleton aspect-video rounded-t-[var(--radius-poster)]" />
      <div className="skeleton mt-[3px] h-[72px] rounded-b-[var(--radius-poster)]" />
    </div>
  )
}
