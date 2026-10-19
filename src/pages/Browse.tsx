import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PageTransition } from '@/components/layout/PageTransition'
import { PosterCard } from '@/components/Card'
import { Icon } from '@/components/Icon'
import { CATALOG, GENRES } from '@/data/catalog'
import { applyFilters, filtersActive, DECADES, type Filters } from '@/lib/search'
import type { Kind, SortKey } from '@/types'

const PAGE = 24

const SORT_LABELS: Record<SortKey, string> = {
  popularite: 'Les plus regardés',
  recent: 'Ajoutés récemment',
  note: 'Les mieux notés',
  alpha: 'Ordre alphabétique',
}

const KINDS: { value: Kind | 'tout'; label: string }[] = [
  { value: 'tout', label: 'Tout' },
  { value: 'film', label: 'Films' },
  { value: 'serie', label: 'Séries' },
]

function chip(active: boolean): string {
  return `h-9 shrink-0 rounded-full border px-4 text-sm transition-colors ${
    active
      ? 'border-lamp-500 bg-lamp-500 font-medium text-ink-950'
      : 'border-ink-600 text-haze-300 hover:border-haze-400 hover:text-paper'
  }`
}

export function Browse() {
  const [params, setParams] = useSearchParams()
  const sentinel = useRef<HTMLDivElement>(null)

  /* Reveal count resets whenever the filters change — derived, not an effect. */
  const signature = params.toString()
  const [page, setPage] = useState({ signature, shown: PAGE })
  const shown = page.signature === signature ? page.shown : PAGE
  const setShown = useCallback((next: (n: number) => number) => {
    setPage((current) => ({
      signature,
      shown: next(current.signature === signature ? current.shown : PAGE),
    }))
  }, [signature])

  const filters = useMemo<Filters>(() => ({
    query: params.get('q') ?? '',
    kind: (params.get('type') as Kind | null) ?? 'tout',
    genres: params.getAll('genre'),
    decade: params.get('decennie') ? Number(params.get('decennie')) : null,
    sort: (params.get('tri') as SortKey | null) ?? 'popularite',
  }), [params])

  const results = useMemo(() => applyFilters(CATALOG, filters), [filters])
  const active = filtersActive(filters)

  /* Reveal the next page as the sentinel comes into view. */
  useEffect(() => {
    const el = sentinel.current
    if (!el || shown >= results.length) return
    const io = new IntersectionObserver(
      ([e]) => { if (e?.isIntersecting) setShown((n) => n + PAGE) },
      { rootMargin: '600px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [shown, results.length, setShown])

  function update(patch: (next: URLSearchParams) => void) {
    const next = new URLSearchParams(params)
    patch(next)
    setParams(next, { replace: true })
  }

  const heading = filters.query
    ? `Résultats pour « ${filters.query} »`
    : filters.kind === 'film' ? 'Films'
    : filters.kind === 'serie' ? 'Séries'
    : 'Tout le catalogue'

  return (
    <PageTransition>
      <div className="gutter mx-auto max-w-[90rem] pb-16 pt-28 lg:pt-32">
        <h1 className="font-wide text-[clamp(1.75rem,4vw,2.75rem)] font-extrabold leading-tight text-paper">
          {heading}
        </h1>
        <p className="mt-2 text-sm text-haze-400 nums-tabular">
          {results.length} {results.length === 1 ? 'titre' : 'titres'}
        </p>

        <div className="mt-7 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div role="group" aria-label="Type de contenu" className="flex gap-1 rounded-full border border-ink-600 p-1">
              {KINDS.map((k) => (
                <button
                  key={k.value}
                  type="button"
                  aria-pressed={filters.kind === k.value}
                  onClick={() => update((n) => {
                    if (k.value === 'tout') n.delete('type')
                    else n.set('type', k.value)
                  })}
                  className={`h-8 rounded-full px-4 text-sm transition-colors ${
                    filters.kind === k.value
                      ? 'bg-paper font-medium text-ink-950'
                      : 'text-haze-300 hover:text-paper'
                  }`}
                >
                  {k.label}
                </button>
              ))}
            </div>

            <label className="ml-auto flex items-center gap-2 text-sm text-haze-400">
              <span className="hidden sm:inline">Trier par</span>
              <select
                value={filters.sort}
                onChange={(e) => update((n) => n.set('tri', e.target.value))}
                className="h-9 rounded-full border border-ink-600 bg-ink-900 px-3 pr-8 text-sm text-paper outline-none transition-colors hover:border-haze-400"
              >
                {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
                  <option key={key} value={key}>{SORT_LABELS[key]}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="hide-scrollbar fade-end -mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label="Genres">
            {GENRES.map((g) => {
              const on = filters.genres.includes(g)
              return (
                <button
                  key={g}
                  type="button"
                  aria-pressed={on}
                  onClick={() => update((n) => {
                    const current = n.getAll('genre')
                    n.delete('genre')
                    const next = on ? current.filter((x) => x !== g) : [...current, g]
                    next.forEach((x) => n.append('genre', x))
                  })}
                  className={chip(on)}
                >
                  {g}
                </button>
              )
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Décennie">
            {DECADES.map((d) => {
              const on = filters.decade === d
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={on}
                  onClick={() => update((n) => {
                    if (on) n.delete('decennie')
                    else n.set('decennie', String(d))
                  })}
                  className={`${chip(on)} nums-tabular`}
                >
                  {d}s
                </button>
              )
            })}

            {(active > 0 || filters.query) && (
              <button
                type="button"
                onClick={() => setParams(new URLSearchParams(), { replace: true })}
                className="ml-1 inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm text-haze-400 transition-colors hover:text-paper"
              >
                <Icon name="close" size={15} />
                Réinitialiser
              </button>
            )}
          </div>
        </div>

        {results.length === 0 ? (
          <div className="mt-16 max-w-[46ch]">
            <p className="font-wide text-lg font-bold text-paper">Aucun titre ne correspond</p>
            <p className="mt-2 text-sm leading-relaxed text-haze-400">
              Retirez un filtre, ou cherchez autrement. Le catalogue compte {CATALOG.length} titres
              en tout.
            </p>
            <button
              type="button"
              onClick={() => setParams(new URLSearchParams(), { replace: true })}
              className="mt-6 inline-flex h-11 items-center rounded-full bg-lamp-500 px-6 font-semibold text-ink-950 transition-colors hover:bg-lamp-400"
            >
              Tout afficher
            </button>
          </div>
        ) : (
          <>
            <div className="mt-8 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6 lg:gap-4 xl:grid-cols-7">
              {results.slice(0, shown).map((entry, i) => (
                <PosterCard key={entry.id} entry={entry} fluid eager={i < 14} />
              ))}
            </div>
            {shown < results.length && (
              <div ref={sentinel} className="h-20" aria-hidden="true" />
            )}
          </>
        )}
      </div>
    </PageTransition>
  )
}
