import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { PageTransition } from '@/components/layout/PageTransition'
import { RadioCard } from '@/components/RadioCard'
import { Icon } from '@/components/Icon'
import { useLibrary } from '@/hooks/libraryContext'
import { useRadio } from '@/hooks/radioContext'
import { demandeRadio, pays, type RadioOptions, type StationsPage } from '@/lib/radio'

const SELECT = 'mt-2 h-12 w-full rounded-xl border border-ink-600 bg-ink-900 px-3 text-sm text-paper'
const LANGUES: Record<string, string> = { french: 'Français', english: 'Anglais', german: 'Allemand', spanish: 'Espagnol', italian: 'Italien', portuguese: 'Portugais', arabic: 'Arabe', russian: 'Russe', dutch: 'Néerlandais', japanese: 'Japonais', chinese: 'Chinois' }

export function Radio() {
  const [params, setParams] = useSearchParams()
  const radio = useRadio()
  const { compte, compteEnCours } = useLibrary()
  const [options, setOptions] = useState<RadioOptions | null>(null)
  const [optionsError, setOptionsError] = useState(false)
  const [revision, setRevision] = useState(0)
  const [showFilters, setShowFilters] = useState(false)
  const [resultat, setResultat] = useState<{ key: string; data?: StationsPage; error?: string }>({ key: '' })
  const favoris = params.get('vue') === 'favoris'
  const page = Math.min(417, Math.max(1, Math.floor(Number(params.get('page')) || 1)))
  const q = params.get('q') ?? ''
  const country = params.get('country') ?? ''
  const genre = params.get('genre') ?? ''
  const language = params.get('language') ?? ''
  const filtre = new URLSearchParams({ q, country, genre, language, offset: String((page - 1) * 24) })
  if (favoris) { filtre.set('ids', radio.favoris.join(',')); filtre.delete('offset') }
  const key = `${compte?.id ?? ''}:${favoris}:${filtre}`
  const query = filtre.toString()
  const attendreFavoris = favoris && (!compte || !radio.favorisReady)
  const data = resultat.key === key ? resultat.data : undefined
  const error = resultat.key === key ? resultat.error : undefined
  const loading = !data && !error

  useEffect(() => {
    const controller = new AbortController()
    setOptionsError(false)
    void demandeRadio<RadioOptions>('radio/options', controller.signal).then(setOptions).catch(() => { if (!controller.signal.aborted) setOptionsError(true) })
    return () => controller.abort()
  }, [revision])

  useEffect(() => {
    if (attendreFavoris) return
    const controller = new AbortController()
    setResultat({ key })
    void demandeRadio<StationsPage>(`radio/stations?${query}`, controller.signal)
      .then((data) => { if (!controller.signal.aborted) setResultat({ key, data }) })
      .catch((e: Error) => { if (!controller.signal.aborted) setResultat({ key, error: e.message }) })
    return () => controller.abort()
  }, [key, query, attendreFavoris, revision])

  function change(name: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(name, value)
    else next.delete(name)
    next.delete('page')
    setParams(next)
  }
  function cherche(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    change('q', String(new FormData(e.currentTarget).get('q') ?? '').trim())
  }
  const actifs = Boolean(q || country || genre || language)
  const countries = [...(options?.countries ?? [])].sort((a, b) => pays(a.name).localeCompare(pays(b.name), 'fr'))

  return (
    <PageTransition>
      <div className="gutter mx-auto max-w-[90rem] pb-12 pt-28 lg:pt-32">
        <div className="flex flex-wrap items-end justify-between gap-6 border-b border-ink-700 pb-8">
          <div>
            <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-lamp-400"><Icon name="radio" size={16} /> Le monde en direct</p>
            <h1 className="font-wide text-[clamp(2.5rem,6vw,4.5rem)] font-extrabold leading-none">Radio</h1>
            <p className="mt-4 max-w-[48ch] text-sm leading-relaxed text-haze-300">Une voix familière ou un son venu d’ailleurs. Trouvez votre station et emportez-la partout sur Lucarne.</p>
          </div>
          <div className="flex rounded-full border border-ink-600 bg-ink-900 p-1" role="group" aria-label="Stations radio">
            <button type="button" aria-pressed={!favoris} onClick={() => setParams({})} className={`min-h-11 rounded-full px-5 text-sm ${!favoris ? 'bg-lamp-500 font-semibold text-ink-950' : 'text-haze-300'}`}>Explorer</button>
            <button type="button" aria-pressed={favoris} onClick={() => setParams({ vue: 'favoris' })} className={`inline-flex min-h-11 items-center gap-2 rounded-full px-5 text-sm ${favoris ? 'bg-lamp-500 font-semibold text-ink-950' : 'text-haze-300'}`}><Icon name="heart" size={16} /> Mes favoris</button>
          </div>
        </div>

        {!favoris && <>
          <form onSubmit={cherche} className="mt-7 flex max-w-2xl gap-2" role="search" aria-label="Rechercher une radio">
            <label className="relative min-w-0 flex-1"><span className="sr-only">Nom de la station</span><span className="pointer-events-none absolute left-4 top-4 text-haze-400"><Icon name="search" size={18} /></span>
              <input key={q} name="q" type="search" defaultValue={q} maxLength={100} placeholder="Chercher une station…" className="h-12 w-full rounded-full border border-ink-600 bg-ink-900 pl-11 pr-4 text-sm" />
            </label>
            <button className="min-h-12 rounded-full bg-lamp-500 px-5 text-sm font-semibold text-ink-950 hover:bg-lamp-400" type="submit">Rechercher</button>
          </form>
          <button type="button" aria-expanded={showFilters} aria-controls="radio-filters" onClick={() => setShowFilters((v) => !v)} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full border border-ink-600 px-4 text-sm text-haze-300 sm:hidden"><Icon name="quality" size={16} />{showFilters ? 'Masquer les filtres' : 'Filtrer les stations'}{(country || genre || language) ? ' · actifs' : ''}</button>
          <div id="radio-filters" className={`mt-5 gap-4 sm:grid sm:grid-cols-3 ${showFilters ? 'grid' : 'hidden'}`}>
            <label className="text-xs font-medium text-haze-300">Pays<select aria-label="Pays" value={country} onChange={(e) => change('country', e.target.value)} className={SELECT}><option value="">Tous les pays</option>{countries.map((c) => <option key={c.name} value={c.name}>{pays(c.name)}</option>)}</select></label>
            <label className="text-xs font-medium text-haze-300">Genre<select aria-label="Genre" value={genre} onChange={(e) => change('genre', e.target.value)} className={SELECT}><option value="">Tous les genres</option>{options?.genres.map((g) => <option key={g.name} value={g.name}>{g.name}</option>)}</select></label>
            <label className="text-xs font-medium text-haze-300">Langue<select aria-label="Langue" value={language} onChange={(e) => change('language', e.target.value)} className={SELECT}><option value="">Toutes les langues</option>{options?.languages.map((l) => <option key={l.name} value={l.name}>{LANGUES[l.name.toLowerCase()] ?? l.name}</option>)}</select></label>
          </div>
          {optionsError && <p className="mt-3 text-sm text-haze-400" role="alert">Les filtres n’ont pas pu être chargés. <button type="button" onClick={() => setRevision((n) => n + 1)} className="min-h-11 text-lamp-400 underline">Réessayer</button></p>}
          {actifs && <button type="button" onClick={() => setParams({})} className="mt-3 min-h-11 text-sm text-lamp-400">Effacer les filtres</button>}
        </>}

        {radio.favorisError && <div role="alert" className="mt-5 rounded-xl border border-lamp-500/30 p-4 text-sm text-lamp-400">{radio.favorisError} <button type="button" onClick={radio.rechargeFavoris} className="min-h-11 underline">Recharger les favoris</button></div>}
        {compte && radio.favoris.length >= 100 && <p className="mt-4 text-sm text-haze-400">Vous avez atteint la limite de 100 favoris. Retirez-en un pour ajouter une autre station.</p>}
        {favoris && !compte && !compteEnCours ? (
          <div className="py-16 text-center"><Icon name="heart" className="mx-auto text-lamp-400" size={32} /><h2 className="mt-5 font-wide text-xl font-bold">Vos radios, toujours à portée de main</h2><p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-haze-400">Connectez-vous pour retrouver vos stations favorites sur tous vos appareils.</p><Link to="/connexion" className="mt-6 inline-flex min-h-12 items-center rounded-full bg-lamp-500 px-6 font-semibold text-ink-950">Se connecter</Link></div>
        ) : attendreFavoris && radio.favorisError ? null : (
          <>
            <div className="mb-5 mt-9 flex items-center justify-between gap-4"><h2 className="font-wide text-lg font-bold">{favoris ? 'Vos stations favorites' : actifs ? 'Les stations qui vous ressemblent' : 'À l’écoute en ce moment'}</h2>{data && <span className="text-xs text-haze-400">{data.stations.length} stations{!favoris ? ` · page ${page}` : ''}</span>}</div>
            {error && <div role="alert" className="rounded-2xl border border-ink-600 p-8"><p className="text-sm text-haze-300">{error}</p><button type="button" onClick={() => setRevision((n) => n + 1)} className="mt-4 min-h-11 rounded-full bg-lamp-500 px-5 text-sm font-semibold text-ink-950">Réessayer</button></div>}
            {(loading || attendreFavoris) && <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" role="status" aria-label="Chargement des stations">{Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton h-56 rounded-2xl" />)}</div>}
            {data && !attendreFavoris && <>
              {data.stations.length ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{data.stations.map((station) => <RadioCard key={station.id} station={station} />)}</div> : <div className="rounded-2xl border border-ink-700 p-10 text-center"><h3 className="font-wide text-lg font-bold">{favoris ? 'Votre sélection commence ici' : 'Aucune station trouvée'}</h3><p className="mt-3 text-sm text-haze-400">{favoris ? 'Appuyez sur le cœur d’une station pour la retrouver ici.' : 'Essayez un autre nom ou élargissez vos filtres.'}</p></div>}
              {!favoris && (page > 1 || data.hasMore) && <nav aria-label="Pages des stations" className="mt-8 flex justify-center gap-3">{page > 1 && <button type="button" onClick={() => { const next = new URLSearchParams(params); next.set('page', String(page - 1)); setParams(next) }} className="min-h-11 rounded-full border border-ink-600 px-5 text-sm">Précédent</button>}{data.hasMore && page < 417 && <button type="button" onClick={() => { const next = new URLSearchParams(params); next.set('page', String(page + 1)); setParams(next) }} className="min-h-11 rounded-full border border-ink-600 px-5 text-sm">Suivant</button>}</nav>}
            </>}
          </>
        )}
        <p className="mt-10 border-t border-ink-700 pt-5 text-xs leading-relaxed text-haze-400">Stations proposées par <a href="https://www.radio-browser.info/" target="_blank" rel="noreferrer" className="text-haze-300 underline">Radio Browser</a>, un annuaire libre et communautaire. Les flux sont diffusés directement par les stations ; leur disponibilité peut varier.</p>
      </div>
    </PageTransition>
  )
}
