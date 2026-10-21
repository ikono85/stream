import { Row } from '@/components/Row'
import { PosterCard, PosterSkeleton } from '@/components/Card'
import { Icon } from '@/components/Icon'
import { useRemote } from '@/hooks/useRemote'
import type { Entry } from '@/types'

/**
 * UNE ÉTAGÈRE, UN APPEL
 * =====================
 * Chaque rangée de l'accueil charge la sienne. C'est volontaire : l'API
 * limite les rafales, et une page qui attendrait que ses huit rangées soient
 * toutes prêtes resterait grise plusieurs secondes. Là, chacune s'affiche
 * dès qu'elle arrive.
 *
 * Une rangée qui échoue ne dit rien et disparaît. Elle n'est pas le sujet de
 * la page, et une rangée d'erreurs serait pire que son absence — la fiche et
 * le catalogue, eux, annoncent leurs pannes.
 */
interface Props {
  title: string
  href?: string
  charge: (signal: AbortSignal) => Promise<Entry[]>
  deps: readonly unknown[]
  /** Combien de squelettes pendant l'attente. */
  attente?: number
  /** Charge les premières images sans attendre : la rangée du haut. */
  eager?: boolean
}

export function RangeeDistante({ title, href, charge, deps, attente = 7, eager = false }: Props) {
  const { data, loading, error } = useRemote(charge, deps)

  if (error) return null

  if (loading && !data) {
    return (
      <Row title={title} href={href}>
        {Array.from({ length: attente }, (_, i) => <PosterSkeleton key={i} />)}
      </Row>
    )
  }

  if (!data || data.length === 0) return null

  return (
    <Row title={title} href={href}>
      {data.map((entry, i) => (
        <PosterCard key={entry.id} entry={entry} eager={eager && i < 6} />
      ))}
    </Row>
  )
}

/** Le message d'une page qui n'a rien pu charger du tout. */
export function Panne({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="max-w-[48ch]">
      <p className="flex items-center gap-2 font-wide text-lg font-bold text-paper">
        <Icon name="warning" size={19} className="text-lamp-500" />
        Le catalogue ne répond pas
      </p>
      <p className="mt-2 text-sm leading-relaxed text-haze-400">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-lamp-500 px-6 font-semibold text-ink-950 transition-colors hover:bg-lamp-400"
        >
          <Icon name="replay" size={17} />
          Réessayer
        </button>
      )}
    </div>
  )
}
