import { Icon } from '@/components/Icon'
import { hasVideo } from '@/lib/playable'
import type { Entry } from '@/types'

/**
 * Three kinds of title share the same shelves, and from the outside they look
 * identical. The badge says which is which before a click finds out:
 *
 *   Lisible — a source is attached, it plays.
 *   Démo    — invented for the layout; there is nothing behind it.
 *   nothing — real metadata, no file yet. The fiche says so in full.
 *
 * Deliberately quiet: an overlay on every poster would be worse than the
 * confusion it fixes.
 */
export function StatusBadge({ entry, className = '' }: { entry: Entry; className?: string }) {
  if (hasVideo(entry)) {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full bg-lamp-500/95 px-1.5 py-0.5 font-wide text-[0.58rem] font-bold uppercase tracking-[0.08em] text-ink-950 ${className}`}
      >
        <Icon name="play" size={9} />
        Lisible
      </span>
    )
  }

  if (entry.demo) {
    return (
      <span
        className={`inline-flex items-center rounded-full border border-ink-500/80 bg-ink-950/80 px-1.5 py-0.5 font-wide text-[0.58rem] font-bold uppercase tracking-[0.08em] text-haze-400 backdrop-blur-sm ${className}`}
      >
        Démo
      </span>
    )
  }

  return null
}
