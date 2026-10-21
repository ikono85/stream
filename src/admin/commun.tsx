import type { ReactNode } from 'react'

/** Les briques partagées par les écrans du panneau. */

export const nombre = new Intl.NumberFormat('fr-FR')
export const heure = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
export const dateHeure = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
export const jourCourt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' })

export function Carte({ titre, children, large = false, action }: {
  titre: string
  children: ReactNode
  large?: boolean
  action?: ReactNode
}) {
  return (
    <section className={`rounded-[var(--radius-panel)] border border-ink-600 bg-ink-900/60 p-5 ${large ? 'lg:col-span-2' : ''}`}>
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-wide text-xs font-bold uppercase tracking-[0.14em] text-haze-400">{titre}</h2>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  )
}

export function Chiffre({ valeur, legende, ton = 'neutre' }: {
  valeur: string
  legende: string
  ton?: 'neutre' | 'bon' | 'alerte'
}) {
  const couleur = ton === 'alerte' ? 'text-[#F0B7A8]' : ton === 'bon' ? 'text-lamp-500' : 'text-paper'
  return (
    <div>
      <p className={`font-wide text-2xl font-extrabold nums-tabular ${couleur}`}>{valeur}</p>
      <p className="mt-0.5 text-xs text-haze-400">{legende}</p>
    </div>
  )
}

/** Un classement : un libellé, une barre, un total. */
export function Palmares({ lignes, vide }: {
  lignes: { cle: string; libelle: string; n: number; lien?: string }[]
  vide: string
}) {
  if (lignes.length === 0) return <p className="text-sm text-haze-400">{vide}</p>
  const sommet = Math.max(...lignes.map((l) => l.n))

  return (
    <ul className="space-y-1.5">
      {lignes.map((ligne) => (
        <li key={ligne.cle} className="relative">
          {/* La barre est un fond, pas un graphique : elle donne l'ordre de
              grandeur sans voler la lecture au texte. */}
          <div
            className="absolute inset-y-0 left-0 rounded bg-lamp-500/12"
            style={{ width: `${(ligne.n / sommet) * 100}%` }}
            aria-hidden="true"
          />
          <div className="relative flex items-center justify-between gap-4 px-2 py-1.5 text-sm">
            {ligne.lien ? (
              <a href={ligne.lien} target="_blank" rel="noreferrer" className="min-w-0 truncate text-haze-200 hover:text-paper">
                {ligne.libelle}
              </a>
            ) : (
              <span className="min-w-0 truncate text-haze-200">{ligne.libelle}</span>
            )}
            <span className="shrink-0 text-paper nums-tabular">{nombre.format(ligne.n)}</span>
          </div>
        </li>
      ))}
    </ul>
  )
}

export function Onglet({ actif, onClick, children }: {
  actif: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={actif}
      className={`h-8 rounded-full px-4 text-sm transition-colors ${
        actif ? 'bg-paper font-medium text-ink-950' : 'text-haze-300 hover:text-paper'
      }`}
    >
      {children}
    </button>
  )
}
