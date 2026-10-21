import { useEffect, useRef } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Icon } from '@/components/Icon'
import { useModalFocus } from '@/hooks/useModalFocus'

/**
 * TRAILER OVERLAY
 * ===============
 * A trailer is not a source. It plays here, over the detail page, and never
 * in the player: the player belongs to your library, and this one is served
 * from somebody else's machine.
 *
 * The embed goes through youtube-nocookie.com, which holds its cookies back
 * until the viewer actually presses play, and `rel=0` keeps the end screen on
 * the same channel rather than wherever YouTube would rather send them.
 */
interface Props {
  /** YouTube key — the `v=` part of a watch URL. */
  trailer: string
  title: string
  open: boolean
  onClose: () => void
}

export function TrailerOverlay({ trailer, title, open, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  useModalFocus(open, dialogRef, onClose, closeRef)
  const reduced = useReducedMotion()

  useEffect(() => {
    if (!open) return


    /* The page behind must not scroll under the overlay. */
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="trailer"
          ref={dialogRef}
          tabIndex={-1}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduced ? 0 : 0.18 }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label={`Bande-annonce de ${title}`}
          className="fixed inset-0 z-50 grid place-items-center bg-ink-950/92 p-4 backdrop-blur-sm sm:p-8"
        >
          {/* Clicking the backdrop closes; clicking the player must not. */}
          <div className="w-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between gap-4">
              <p className="min-w-0 truncate font-wide text-sm font-bold text-paper">
                Bande-annonce — {title}
              </p>
              <button
                ref={closeRef}
                type="button"
                onClick={onClose}
                aria-label="Fermer la bande-annonce"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ink-900 text-paper transition-colors hover:bg-ink-800"
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            <div className="aspect-video overflow-hidden rounded-[var(--radius-panel)] bg-black glow-lift">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${trailer}?autoplay=1&rel=0`}
                title={`Bande-annonce de ${title}`}
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
                className="h-full w-full border-0"
              />
            </div>

            <p className="mt-3 text-xs text-haze-400">
              Lue depuis YouTube, en dehors de votre bibliothèque.
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
