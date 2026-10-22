import { Link } from 'react-router-dom'
import { useLibrary } from '@/hooks/libraryContext'
import { useRemote } from '@/hooks/useRemote'
import { nouveautes, episodeIdDe } from '@/lib/heiwa'
import { episodeLabel, jour } from '@/lib/format'
import { Icon } from '@/components/Icon'
import type { Upcoming } from '@/types'

/** Ma liste reste la source unique du suivi, sur le navigateur ou le compte. */
export function SeriesSuivies({ prochaines }: { prochaines: Upcoming[] }) {
  const { ready, myList, watched } = useLibrary()
  const ids = myList.filter((id) => id.startsWith('tv-'))
  const cle = [...ids].sort().join(',')
  const nouvelles = useRemote(
    (signal) => ready && cle
      ? nouveautes({ famille: 'tv', rich: 0 }, signal)
      : Promise.resolve([]),
    [ready, cle],
  )
  if (!ready) return null
  const suivies = new Set(ids)
  const ouverts = new Set(watched)
  const uniques = new Set<string>()
  const ajouts = (nouvelles.data ?? []).filter((e) => {
    if (!suivies.has(e.id) || !e.addedEpisode) return false
    const ep = episodeIdDe(e.tmdb, e.addedEpisode.season, e.addedEpisode.episode)
    if (ouverts.has(ep) || uniques.has(ep)) return false
    uniques.add(ep)
    return true
  }).slice(0, 8)
  const attendus = prochaines.filter((e) => suivies.has(e.id)).slice(0, 5)

  return (
    <section className="gutter py-5" aria-labelledby="series-suivies">
      <div className="rounded-2xl border border-ink-700 bg-ink-900/60 p-4 sm:p-6">
        <h2 id="series-suivies" className="font-wide text-base font-bold text-paper lg:text-lg">Du nouveau dans vos séries</h2>
        <p className="mt-1 text-xs leading-relaxed text-haze-400">Ajoutez une série à <Link to="/ma-liste" className="text-lamp-500 underline">Ma liste</Link> pour la suivre ici. Les épisodes marqués comme vus sont masqués.</p>
        {!ids.length ? <p className="mt-4 text-sm text-haze-300">Votre prochaine série vous attend. <Link to="/catalogue?type=serie" className="text-lamp-500">Découvrir les séries →</Link></p>
          : nouvelles.loading ? <p role="status" className="mt-4 text-sm text-haze-400">Recherche des derniers ajouts…</p>
          : nouvelles.error ? <div role="status" className="mt-4 text-sm text-haze-300">Les nouveautés sont momentanément indisponibles. <button type="button" onClick={nouvelles.recharge} className="min-h-10 text-lamp-500">Réessayer</button></div>
          : ajouts.length ? <ul className="mt-4 divide-y divide-ink-700">
            {ajouts.map((e) => {
              const ep = e.addedEpisode!
              return <li key={`${e.id}-${ep.season}-${ep.episode}`}>
                <Link to={`/lecture/${e.id}?episode=${episodeIdDe(e.tmdb, ep.season, ep.episode)}`} className="flex items-center gap-3 rounded-lg py-3 hover:bg-ink-800">
                  <Icon name="play" size={18} className="shrink-0 text-lamp-500" />
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-paper">{e.title}</span><span className="text-xs text-haze-400">{episodeLabel(ep.season, ep.episode)} · Ajouté récemment</span></span>
                  <Icon name="chevronRight" size={16} className="shrink-0 text-haze-400" />
                </Link>
              </li>
            })}
          </ul> : <p className="mt-4 text-sm text-haze-300">Aucun épisode non vu de vos séries parmi les derniers ajouts du catalogue.</p>}
        {attendus.length > 0 && <div className="mt-4 border-t border-ink-700 pt-4">
          <h3 className="text-xs font-semibold text-haze-300">Prochaines sorties attendues</h3>
          <ul className="mt-2 space-y-2">{attendus.map((e) => <li key={`${e.id}-${e.season}-${e.episode}`}><Link to={`/titre/${e.id}`} className="block text-sm text-paper hover:text-lamp-500">{e.title} <span className="text-xs text-haze-400">· {episodeLabel(e.season, e.episode)} · {jour(e.date)}</span></Link></li>)}</ul>
          <p className="mt-2 text-xs text-haze-400">Dates annoncées : la disponibilité peut varier.</p>
        </div>}
      </div>
    </section>
  )
}
