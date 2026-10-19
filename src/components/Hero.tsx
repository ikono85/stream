import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'motion/react'
import { Icon } from '@/components/Icon'
import { useLibrary } from '@/hooks/libraryContext'
import { bannerArt } from '@/lib/poster'
import { runtime, seasonCount, rating } from '@/lib/format'
import { hasVideo } from '@/data/catalog'
import type { Entry } from '@/types'

/**
 * Only fetch the background loop when it is clearly welcome: a wide screen,
 * motion allowed, and the browser not asking us to save data.
 */
function useBackgroundVideo(src: string | undefined, reduced: boolean | null): boolean {
  const [allowed, setAllowed] = useState(false)

  useEffect(() => {
    if (!src || reduced) return
    const wide = window.matchMedia('(min-width: 1024px)')
    const conn = (navigator as { connection?: { saveData?: boolean } }).connection
    if (!wide.matches || conn?.saveData) return
    /* Let the page settle and the poster paint before pulling a video down. */
    const id = window.setTimeout(() => setAllowed(true), 2200)
    return () => window.clearTimeout(id)
  }, [src, reduced])

  return allowed
}

export function Hero({ entry }: { entry: Entry }) {
  const reduced = useReducedMotion()
  const { inList, toggleList } = useLibrary()
  const saved = inList(entry.id)
  const playable = hasVideo(entry)
  const videoRef = useRef<HTMLVideoElement>(null)
  const showVideo = useBackgroundVideo(entry.heroVideo, reduced)
  const [videoReady, setVideoReady] = useState(false)

  useEffect(() => {
    if (!showVideo) return
    const el = videoRef.current
    if (!el) return
    el.play().catch(() => setVideoReady(false))
  }, [showVideo])

  const step = (i: number) => ({
    initial: { opacity: 0, y: reduced ? 0 : 16 },
    animate: { opacity: 1, y: 0 },
    transition: {
      duration: reduced ? 0 : 0.6,
      delay: reduced ? 0 : 0.12 + i * 0.075,
      ease: [0.22, 1, 0.36, 1] as const,
    },
  })

  const meta = [
    String(entry.year),
    entry.kind === 'film' ? runtime(entry.runtime ?? 0) : seasonCount(entry.seasons?.length ?? 1),
    entry.rating > 0 ? `${rating(entry.rating)}/10` : null,
    entry.genres.slice(0, 2).join(', '),
  ].filter(Boolean) as string[]

  return (
    <section className="relative isolate min-h-[62vh] overflow-hidden sm:min-h-[70vh] lg:min-h-[80vh]">
      <motion.div
        className="grain absolute inset-0 -z-10"
        initial={{ opacity: 0, scale: reduced ? 1 : 1.06 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: reduced ? 0 : 1.1, ease: [0.22, 1, 0.36, 1] }}
      >
        <img
          src={entry.backdrop ?? bannerArt(entry.id)}
          alt=""
          fetchPriority="high"
          decoding="async"
          className="h-full w-full object-cover"
        />
        {showVideo && entry.heroVideo && (
          <video
            ref={videoRef}
            src={entry.heroVideo}
            muted
            loop
            playsInline
            preload="none"
            tabIndex={-1}
            aria-hidden="true"
            onPlaying={() => setVideoReady(true)}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${
              videoReady ? 'opacity-100' : 'opacity-0'
            }`}
          />
        )}
      </motion.div>

      {/* Readability scrims: just enough to carry text, not enough to kill the art. */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-ink-950 via-ink-950/35 via-45% to-transparent" />
      <div className="absolute inset-0 -z-10 hidden bg-gradient-to-r from-ink-950/90 via-ink-950/35 via-40% to-transparent lg:block" />

      <div className="gutter mx-auto flex min-h-[62vh] max-w-[90rem] flex-col justify-end pb-10 pt-28 sm:min-h-[70vh] lg:min-h-[80vh] lg:pb-16">
        <div className="max-w-[46rem]">
          <motion.h1
            {...step(0)}
            className="font-wide text-[clamp(2.1rem,7vw,4.6rem)] font-extrabold leading-[0.95] tracking-[-0.015em] text-paper"
          >
            {entry.title}
          </motion.h1>

          <motion.p
            {...step(1)}
            className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-haze-300 nums-tabular"
          >
            {meta.map((m) => <span key={m}>{m}</span>)}
          </motion.p>

          <motion.p
            {...step(2)}
            className="mt-4 max-w-[52ch] text-[0.95rem] leading-relaxed text-haze-300 line-clamp-3 sm:text-base"
          >
            {entry.synopsis}
          </motion.p>

          <motion.div {...step(3)} className="mt-7 flex flex-wrap items-center gap-3">
            {playable ? (
              <Link
                to={`/lecture/${entry.id}`}
                className="inline-flex h-12 items-center gap-2.5 rounded-full bg-lamp-500 px-7 font-semibold text-ink-950 transition-[background-color,box-shadow] hover:bg-lamp-400 hover:glow-lamp"
              >
                <Icon name="play" size={19} />
                Regarder
              </Link>
            ) : (
              <Link
                to={`/titre/${entry.id}`}
                className="inline-flex h-12 items-center gap-2.5 rounded-full bg-lamp-500 px-7 font-semibold text-ink-950 transition-[background-color,box-shadow] hover:bg-lamp-400 hover:glow-lamp"
              >
                <Icon name="info" size={19} />
                Voir la fiche
              </Link>
            )}

            <button
              type="button"
              onClick={() => toggleList(entry.id)}
              className="inline-flex h-12 items-center gap-2.5 rounded-full border border-ink-500 bg-ink-900/70 px-6 font-medium text-paper backdrop-blur-sm transition-colors hover:border-haze-400 hover:bg-ink-800"
            >
              <Icon name={saved ? 'check' : 'plus'} size={18} />
              {saved ? 'Dans ma liste' : 'Ma liste'}
            </button>

            {playable && (
              <Link
                to={`/titre/${entry.id}`}
                className="inline-flex h-12 items-center gap-2 rounded-full px-4 text-sm text-haze-300 transition-colors hover:text-paper"
              >
                <Icon name="info" size={17} />
                Plus d'informations
              </Link>
            )}
          </motion.div>
        </div>
      </div>
    </section>
  )
}
