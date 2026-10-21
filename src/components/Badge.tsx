import type { Entry } from '@/types'

/**
 * Ce qu'une affiche peut dire d'utile avant le clic : la définition quand
 * elle sort de l'ordinaire, et la présence d'une VF. Rien d'autre — un
 * bandeau sur chaque vignette serait pire que l'ignorance qu'il comble.
 *
 * Tout ce que le catalogue HeiwaStream renvoie est lisible par construction :
 * il ne contient que des titres pour lesquels des liens existent. Un badge
 * « lisible » serait donc vrai partout, donc muet.
 */
export function StatusBadge({ entry, className = '' }: { entry: Entry; className?: string }) {
  const haute = entry.quality === '4K' || entry.quality === '2160p'
  const vf = entry.languages.includes('VF')

  if (!haute && !vf) return null

  return (
    <span className={`flex flex-col items-start gap-1 ${className}`}>
      {haute && (
        <span className="inline-flex items-center rounded-full bg-lamp-500/95 px-1.5 py-0.5 font-wide text-[0.58rem] font-bold uppercase tracking-[0.08em] text-ink-950">
          4K
        </span>
      )}
      {vf && (
        <span className="inline-flex items-center rounded-full border border-ink-500/80 bg-ink-950/80 px-1.5 py-0.5 font-wide text-[0.58rem] font-bold uppercase tracking-[0.08em] text-haze-300 backdrop-blur-sm">
          VF
        </span>
      )}
    </span>
  )
}
