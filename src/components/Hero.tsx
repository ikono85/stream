import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Icon } from '@/components/Icon'
import { Art } from '@/components/Art'
import { useLibrary } from '@/hooks/libraryContext'
import { bannerArt } from '@/lib/poster'
import { rating, shape } from '@/lib/format'
import { hasVideo } from '@/data/catalog'
import type { Entry } from '@/types'

/** How long one title holds the stage. */
const DWELL = 9000

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

/**
 * Advances through the spotlight on its own, and knows when not to: reduced
 * motion, a pointer resting on it, keyboard focus inside it, or a tab the
 * viewer is no longer looking at.
 */
function useRotation(count: number, reduced: boolean | null, held: boolean) {
  const [index, setIndex] = useState(0)
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    const onVisibility = () => setHidden(document.hidden)
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  const paused = held || hidden || Boolean(reduced) || count < 2

  /* A timeout rather than an interval: picking a title by hand restarts the
     clock instead of cutting the new one short. */
  useEffect(() => {
    if (paused) return
    const id = window.setTimeout(() => setIndex((i) => (i + 1) % count), DWELL)
    return () => window.clearTimeout(id)
  }, [index, paused, count])

  return { index: Math.min(index, Math.max(count - 1, 0)), setIndex, paused }
}

/**
 * One slide's artwork. Mounted under its own key inside AnimatePresence, so
 * each title gets its own fresh loop state and the outgoing one keeps its
 * image until the crossfade is over.
 */
function Backdrop({ entry, reduced, eager }: {
  entry: Entry
  reduced: boolean | null
  eager: boolean
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const showVideo = useBackgroundVideo(entry.heroVideo, reduced)
  const [videoReady, setVideoReady] = useState(false)

  useEffect(() => {
    if (!showVideo) return
    const el = videoRef.current
    if (!el) return
    el.play().catch(() => setVideoReady(false))
  }, [showVideo])

  return (
    <motion.div
      className="grain absolute inset-0 -z-10"
      initial={{ opacity: 0, scale: reduced ? 1 : 1.05 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduced ? 0 : 0.95, ease: [0.22, 1, 0.36, 1] }}
    >
      <Art
        src={entry.backdrop}
        fallback={bannerArt(entry.id)}
        alt=""
        fetchPriority={eager ? 'high' : 'auto'}
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
  )
}

export function Hero({ entries }: { entries: Entry[] }) {
  const reduced = useReducedMotion()
  const { inList, toggleList } = useLibrary()
  const [held, setHeld] = useState(false)
  const slides = entries.slice(0, 6)
  const { index, setIndex } = useRotation(slides.length, reduced, held)

  const entry = slides[index] ?? slides[0]

  /* Warm the next backdrop so a change of title is not a change of colour
     followed, a beat later, by an image. */
  useEffect(() => {
    const next = slides[(index + 1) % slides.length]
    if (!next || slides.length < 2) return
    const img = new Image()
    img.src = next.backdrop ?? bannerArt(next.id)
  }, [index, slides])

  if (!entry) return null

  const saved = inList(entry.id)
  const playable = hasVideo(entry)

  const step = (i: number) => ({
    initial: { opacity: 0, y: reduced ? 0 : 16 },
    animate: { opacity: 1, y: 0 },
    transition: {
      duration: reduced ? 0 : 0.55,
      delay: reduced ? 0 : 0.06 + i * 0.07,
      ease: [0.22, 1, 0.36, 1] as const,
    },
  })

  const meta = [
    String(entry.year),
    shape(entry),
    entry.rating > 0 ? `${rating(entry.rating)}/10` : null,
    entry.genres.slice(0, 2).join(', '),
  ].filter(Boolean) as string[]

  return (
    <section
      className="relative isolate min-h-[62vh] overflow-hidden sm:min-h-[70vh] lg:min-h-[80vh]"
      /* A tap on a touch screen fires pointerenter and then never fires
         pointerleave, which would hold the spotlight still for good. Only a
         pointer that can actually rest on something pauses it. */
      onPointerEnter={(e) => { if (e.pointerType !== 'touch') setHeld(true) }}
      onPointerLeave={() => setHeld(false)}
      onFocusCapture={() => setHeld(true)}
      onBlurCapture={() => setHeld(false)}
    >
      {/* Both backdrops live here for the length of one crossfade. */}
      <AnimatePresence initial={false}>
        <Backdrop key={entry.id} entry={entry} reduced={reduced} eager={index === 0} />
      </AnimatePresence>

      {/* Readability scrims: just enough to carry text, not enough to kill the art. */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-ink-950 via-ink-950/35 via-45% to-transparent" />
      <div className="absolute inset-0 -z-10 hidden bg-gradient-to-r from-ink-950/90 via-ink-950/35 via-40% to-transparent lg:block" />

      <div className="gutter mx-auto flex min-h-[62vh] max-w-[90rem] flex-col justify-end pb-10 pt-28 sm:min-h-[70vh] lg:min-h-[80vh] lg:pb-16">
        <AnimatePresence mode="wait">
          <motion.div
            key={entry.id}
            className="max-w-[46rem]"
            exit={{ opacity: 0, transition: { duration: reduced ? 0 : 0.22 } }}
          >
            <motion.h1
              {...step(0)}
              className="font-wide text-[clamp(2.1rem,7vw,4.6rem)] font-extrabold leading-[0.95] tracking-[-0.015em] text-paper"
            >
              {/* A title treatment, when the import found one, carries the
                  film's own lettering; the text stays as its alt. */}
              {entry.logo ? (
                <img
                  src={entry.logo}
                  alt={entry.title}
                  className="h-auto max-h-24 w-auto max-w-[min(100%,34rem)] object-contain object-left lg:max-h-32"
                />
              ) : (
                entry.title
              )}
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
          </motion.div>
        </AnimatePresence>

        {slides.length > 1 && (
          <div
            className="mt-9 flex items-center gap-2"
            role="group"
            aria-label="Titres mis en avant"
          >
            {slides.map((slide, i) => (
              <button
                key={slide.id}
                type="button"
                onClick={() => setIndex(i)}
                aria-current={i === index}
                aria-label={slide.title}
                className={`h-1.5 rounded-full transition-[width,background-color] duration-300 ${
                  i === index ? 'w-9 bg-lamp-500' : 'w-4 bg-paper/30 hover:bg-paper/55'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
