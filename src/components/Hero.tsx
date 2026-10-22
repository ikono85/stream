import { FavoriteIcon } from '@/components/FavoriteIcon'
import { useSpoilers } from '@/hooks/useSpoilers'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Icon } from '@/components/Icon'
import { Art } from '@/components/Art'
import { useLibrary } from '@/hooks/libraryContext'
import { bannerArt } from '@/lib/poster'
import { image, TAILLES } from '@/lib/images'
import { rating, shape, langues } from '@/lib/format'
import type { Entry } from '@/types'

/** How long one title holds the stage. */
const DWELL = 9000

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
 * the outgoing one keeps its image until the crossfade is over.
 */
function Backdrop({ entry, reduced, eager }: {
  entry: Entry
  reduced: boolean | null
  eager: boolean
}) {
  return (
    <motion.div
      className="grain absolute inset-0 -z-10"
      initial={{ opacity: 0, scale: reduced ? 1 : 1.05 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduced ? 0 : 0.95, ease: [0.22, 1, 0.36, 1] }}
    >
      <Art
        src={image(entry.backdropPath, TAILLES.fondLarge)}
        fallback={bannerArt(entry.id)}
        alt=""
        fetchPriority={eager ? 'high' : 'auto'}
        decoding="async"
        className="h-full w-full object-cover"
      />
    </motion.div>
  )
}

export function HeroSkeleton() {
  return (
    <section className="relative min-h-[62vh] overflow-hidden bg-ink-900 sm:min-h-[70vh] lg:min-h-[80vh]">
      <div className="gutter mx-auto flex min-h-[62vh] max-w-[90rem] flex-col justify-end pb-10 pt-28 sm:min-h-[70vh] lg:min-h-[80vh] lg:pb-16">
        <div className="skeleton h-14 w-[min(32rem,80%)] rounded-lg" />
        <div className="skeleton mt-5 h-4 w-64 rounded" />
        <div className="skeleton mt-4 h-16 w-[min(40rem,90%)] rounded" />
        <div className="skeleton mt-7 h-12 w-48 rounded-full" />
      </div>
    </section>
  )
}

export function Hero({ entries }: { entries: Entry[] }) {
  const { sansSpoilers } = useSpoilers()
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
    img.src = image(next.backdropPath, TAILLES.fondLarge) ?? bannerArt(next.id)
  }, [index, slides])

  if (!entry) return null

  const saved = inList(entry.id)

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
    entry.year > 0 ? String(entry.year) : null,
    shape(entry),
    entry.rating !== undefined && entry.rating > 0 ? `${rating(entry.rating)}/10` : null,
    entry.quality,
    entry.languages.length > 0 ? langues(entry.languages) : null,
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
              {/* Le lettrage du titre, quand la fiche en porte un : c'est
                  l'image du film, et le texte reste son alternative. */}
              {entry.logoPath ? (
                <img
                  src={image(entry.logoPath, TAILLES.logo)}
                  alt={entry.title}
                  className="h-auto max-h-24 w-auto max-w-[min(100%,34rem)] object-contain object-left lg:max-h-32"
                />
              ) : (
                entry.title
              )}
            </motion.h1>

            {!sansSpoilers && entry.tagline && (
              <motion.p {...step(1)} className="mt-3 font-wide text-sm italic text-lamp-500">
                {entry.tagline}
              </motion.p>
            )}

            <motion.p
              {...step(2)}
              className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-haze-300 nums-tabular"
            >
              {meta.map((m) => <span key={m}>{m}</span>)}
            </motion.p>

            {!sansSpoilers && entry.synopsis && (
              <motion.p
                {...step(3)}
                className="mt-4 max-w-[52ch] text-[0.95rem] leading-relaxed text-haze-300 line-clamp-3 sm:text-base"
              >
                {entry.synopsis}
              </motion.p>
            )}

            <motion.div {...step(4)} className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                to={`/lecture/${entry.id}`}
                className="inline-flex h-12 items-center gap-2.5 rounded-full bg-lamp-500 px-7 font-semibold text-ink-950 transition-[background-color,box-shadow] hover:bg-lamp-400 hover:glow-lamp"
              >
                <Icon name="play" size={19} />
                Regarder
              </Link>

              <button
                type="button"
                aria-pressed={saved}
                  onClick={() => toggleList(entry.id)}
                className="inline-flex h-12 items-center gap-2.5 rounded-full border border-ink-500 bg-ink-900/70 px-6 font-medium text-paper backdrop-blur-sm transition-colors hover:border-haze-400 hover:bg-ink-800"
              >
                <FavoriteIcon saved={saved} />
                {saved ? 'Dans ma liste' : 'Ma liste'}
              </button>

              <Link
                to={`/titre/${entry.id}`}
                className="inline-flex h-12 items-center gap-2 rounded-full px-4 text-sm text-haze-300 transition-colors hover:text-paper"
              >
                <Icon name="info" size={17} />
                Plus d'informations
              </Link>
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
