import { useSpoilers } from '@/hooks/useSpoilers'
import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { PageTransition } from '@/components/layout/PageTransition'
import { Panne } from '@/components/RangeeDistante'
import { Icon } from '@/components/Icon'
import { useLibrary } from '@/hooks/libraryContext'
import { useRemote } from '@/hooks/useRemote'
import { CALENDRIER_MAX_JOURS, calendrier } from '@/lib/heiwa'
import { aujourdhui, dansNJours, ecartEnJours, episodeLabel, jourRelatif } from '@/lib/format'
import type { Upcoming } from '@/types'

/**
 * LE CALENDRIER
 * =============
 * Ce que l'API appelle `/calendar` : les épisodes attendus, dans une fenêtre
 * de 31 jours au plus. L'accueil en montre les sept premiers jours en vrac ;
 * ici ils sont groupés par date, et la fenêtre se règle.
 *
 * Le filtre « seulement ma liste » est appliqué dans le navigateur, et c'est
 * volontaire : l'API ne sait pas ce qu'il y a dans votre liste, et lui
 * demander trente et un jours pour n'en garder que trois lignes coûte la
 * même requête que de tout afficher.
 */

const FENETRES = [7, 14, CALENDRIER_MAX_JOURS] as const

function Jour({ date, sorties, dansMaListe }: {
  date: string
  sorties: Upcoming[]
  dansMaListe: (id: string) => boolean
}) {
  const { sansSpoilers } = useSpoilers()
  const ecart = ecartEnJours(date)
  const cestAujourdhui = ecart === 0

  return (
    <section className="py-5">
      <h2
        className={`font-wide text-sm font-bold uppercase tracking-[0.12em] ${
          cestAujourdhui ? 'text-lamp-500' : 'text-haze-400'
        }`}
      >
        {jourRelatif(date)}
      </h2>

      <ul className="mt-3 divide-y divide-ink-700 border-y border-ink-700">
        {sorties.map((sortie) => {
          const suivi = dansMaListe(sortie.id)
          return (
            <li key={`${sortie.id}-${sortie.season}-${sortie.episode}`}>
              <Link
                to={`/titre/${sortie.id}`}
                className="flex items-center gap-4 py-3.5 transition-colors hover:bg-ink-900/60"
              >
                <span className="w-16 shrink-0 text-xs text-haze-400 nums-tabular">
                  {episodeLabel(sortie.season, sortie.episode)}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-paper">{sortie.title}</span>
                    {suivi && (
                      <span className="shrink-0 rounded-full bg-lamp-500/15 px-2 py-0.5 font-wide text-[0.6rem] font-bold uppercase tracking-[0.08em] text-lamp-500">
                        Ma liste
                      </span>
                    )}
                  </span>
                  {!sansSpoilers && sortie.episodeTitle && (
                    <span className="mt-0.5 block truncate text-xs text-haze-400">
                      {sortie.episodeTitle}
                    </span>
                  )}
                </span>

                <Icon name="chevronRight" size={16} className="shrink-0 text-haze-400" />
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export function Calendrier() {
  const [params, setParams] = useSearchParams()
  const { myList, ready } = useLibrary()

  const fenetreBrute = Number(params.get('jours'))
  const fenetre = (FENETRES as readonly number[]).includes(fenetreBrute) ? fenetreBrute : 7
  const seulementMaListe = params.get('liste') === '1'

  const depuis = aujourdhui()
  const jusqua = dansNJours(fenetre)

  const sorties = useRemote(
    (signal) => calendrier({ from: depuis, to: jusqua }, signal),
    [depuis, jusqua],
  )

  const dansMaListe = useMemo(() => {
    const ids = new Set(myList)
    return (id: string) => ids.has(id)
  }, [myList])

  /* Groupé par date, dans l'ordre où les jours viennent. L'API les rend déjà
     triés, mais rien ne le garantit : on trie. */
  const parJour = useMemo(() => {
    const retenues = (sorties.data ?? []).filter((s) => !seulementMaListe || dansMaListe(s.id))
    const groupes = new Map<string, Upcoming[]>()
    for (const sortie of retenues) {
      const liste = groupes.get(sortie.date)
      if (liste) liste.push(sortie)
      else groupes.set(sortie.date, [sortie])
    }
    return [...groupes.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [sorties.data, seulementMaListe, dansMaListe])

  const total = parJour.reduce((n, [, liste]) => n + liste.length, 0)

  function change(patch: Record<string, string | null>) {
    const next = new URLSearchParams(params)
    for (const [cle, valeur] of Object.entries(patch)) {
      if (valeur === null) next.delete(cle)
      else next.set(cle, valeur)
    }
    setParams(next, { replace: true })
  }

  return (
    <PageTransition>
      <div className="gutter mx-auto max-w-[90rem] pb-16 pt-28 lg:pt-32">
        <h1 className="font-wide text-[clamp(1.75rem,4vw,2.75rem)] font-extrabold leading-tight text-paper">
          Calendrier
        </h1>
        <p className="mt-2 text-sm text-haze-400 nums-tabular">
          {sorties.loading && !sorties.data
            ? 'Chargement…'
            : `${total} ${total === 1 ? 'épisode attendu' : 'épisodes attendus'} sur ${fenetre} jours`}
        </p>

        <div className="mt-7 flex flex-wrap items-center gap-3">
          <div role="group" aria-label="Fenêtre" className="flex gap-1 rounded-full border border-ink-600 p-1">
            {FENETRES.map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={fenetre === n}
                onClick={() => change({ jours: n === 7 ? null : String(n) })}
                className={`h-8 rounded-full px-4 text-sm transition-colors nums-tabular ${
                  fenetre === n ? 'bg-paper font-medium text-ink-950' : 'text-haze-300 hover:text-paper'
                }`}
              >
                {n} jours
              </button>
            ))}
          </div>

          <button
            type="button"
            aria-pressed={seulementMaListe}
            onClick={() => change({ liste: seulementMaListe ? null : '1' })}
            className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm transition-colors ${
              seulementMaListe
                ? 'border-lamp-500 bg-lamp-500 font-medium text-ink-950'
                : 'border-ink-600 text-haze-300 hover:border-haze-400 hover:text-paper'
            }`}
          >
            <Icon name="check" size={13} />
            Seulement ma liste
          </button>
        </div>

        {/* La borne vient de l'API, pas d'un choix de design : le dire évite
            de chercher le bouton « 3 mois » qui n'existera pas. */}
        {fenetre === CALENDRIER_MAX_JOURS && (
          <p className="mt-3 text-xs text-haze-400">
            {CALENDRIER_MAX_JOURS} jours est la fenêtre la plus large que l'API couvre.
          </p>
        )}

        {sorties.error && !sorties.data && (
          <div className="mt-14">
            <Panne message={sorties.error.explication} onRetry={sorties.recharge} />
          </div>
        )}

        {sorties.loading && !sorties.data && (
          <div className="mt-8 space-y-6">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i}>
                <div className="skeleton h-4 w-40 rounded" />
                <div className="skeleton mt-3 h-24 w-full rounded-lg" />
              </div>
            ))}
          </div>
        )}

        {sorties.data && total === 0 && (
          <div className="mt-14 max-w-[46ch]">
            <p className="font-wide text-lg font-bold text-paper">
              {seulementMaListe ? 'Rien de votre liste ne sort' : 'Aucun épisode annoncé'}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-haze-400">
              {seulementMaListe
                ? ready && myList.length === 0
                  ? "Votre liste est vide : ajoutez-y des séries et leurs sorties apparaîtront ici."
                  : `Aucune série de votre liste n'a d'épisode prévu dans les ${fenetre} prochains jours. Essayez une fenêtre plus large.`
                : `Rien n'est annoncé sur ${fenetre} jours. Essayez une fenêtre plus large.`}
            </p>
            {seulementMaListe && (
              <button
                type="button"
                onClick={() => change({ liste: null })}
                className="mt-6 inline-flex h-11 items-center rounded-full bg-lamp-500 px-6 font-semibold text-ink-950 transition-colors hover:bg-lamp-400"
              >
                Voir tout le calendrier
              </button>
            )}
          </div>
        )}

        {total > 0 && (
          <div className={`mt-6 transition-opacity duration-200 ${sorties.loading ? 'opacity-50' : 'opacity-100'}`}>
            {parJour.map(([date, liste]) => (
              <Jour key={date} date={date} sorties={liste} dansMaListe={dansMaListe} />
            ))}
          </div>
        )}
      </div>
    </PageTransition>
  )
}
