import { useState } from 'react'
import { Icon } from '@/components/Icon'
import { GENRES } from '@/lib/genres'
import { PLATEFORMES } from '@/lib/plateformes'
import { DECENNIES, LANGUES, QUALITES, RAYONS, TRIS, type Filtres } from '@/lib/filtres'
import type { SortKey } from '@/types'

interface Props {
  filtres: Filtres
  onChange: (patch: Partial<Filtres>) => void
  onReset: () => void
}

const SELECT = 'mt-2 h-11 w-full rounded-xl border border-ink-600 bg-ink-950 px-3 text-sm text-paper transition-colors hover:border-ink-500'
const LEGEND = 'mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-haze-400'

export function CatalogueFilters({ filtres, onChange, onReset }: Props) {
  const [detailsOuverts, setDetailsOuverts] = useState(false)
  const [categoriesOuvertes, setCategoriesOuvertes] = useState(false)
  const avances = [filtres.langue, filtres.qualite, filtres.decennie, filtres.note].filter((v) => v !== null).length
  const selections: { label: string; patch: Partial<Filtres> }[] = [
    ...(filtres.genre ? [{ label: filtres.genre, patch: { genre: null } }] : []),
    ...(filtres.plateforme ? [{ label: PLATEFORMES.find((p) => p.id === filtres.plateforme)?.nom ?? filtres.plateforme, patch: { plateforme: null } }] : []),
    ...(filtres.langue ? [{ label: filtres.langue.toUpperCase(), patch: { langue: null } }] : []),
    ...(filtres.decennie !== null ? [{ label: `Années ${filtres.decennie}`, patch: { decennie: null } }] : []),
    ...(filtres.qualite ? [{ label: `${filtres.qualite.toUpperCase()} minimum`, patch: { qualite: null } }] : []),
    ...(filtres.note !== null ? [{ label: `Note ≥ ${filtres.note}/10`, patch: { note: null } }] : []),
  ]

  return (
    <section aria-label="Catégories et filtres du catalogue" className="mt-7 overflow-hidden rounded-2xl border border-ink-700 bg-ink-900/60">
      <div className="flex flex-col gap-4 border-b border-ink-700 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
        <div role="group" aria-label="Rayon" className="grid grid-cols-4 gap-1 rounded-xl bg-ink-950 p-1 sm:w-fit">
          {RAYONS.map((r) => (
            <button key={r.value} type="button" aria-pressed={filtres.rayon === r.value}
              onClick={() => onChange({ rayon: r.value })}
              className={`min-h-11 rounded-lg px-3 text-sm transition-colors sm:px-6 ${filtres.rayon === r.value ? 'bg-lamp-500 font-semibold text-ink-950' : 'text-haze-300 hover:bg-ink-800 hover:text-paper'}`}>
              {r.label}
            </button>
          ))}
        </div>
        <label className="flex items-center justify-between gap-3 text-xs text-haze-400 lg:justify-end">
          <span>Trier par</span>
          <select aria-label="Trier le catalogue" value={filtres.sort}
            onChange={(e) => onChange({ sort: e.target.value as SortKey })}
            className="h-11 min-w-48 rounded-xl border border-ink-600 bg-ink-950 px-3 text-sm text-paper hover:border-ink-500">
            {(Object.keys(TRIS) as SortKey[]).map((key) => <option key={key} value={key}>{TRIS[key]}</option>)}
          </select>
        </label>
      </div>

      <button type="button" aria-expanded={categoriesOuvertes} aria-controls="catalogue-categories" onClick={() => setCategoriesOuvertes((v) => !v)}
        className="flex min-h-14 w-full items-center justify-between gap-3 border-b border-ink-700 px-4 text-left text-sm text-haze-300 sm:px-5 lg:hidden">
        <span>Genres et plateformes</span><Icon name="chevronDown" size={16} className={`transition-transform ${categoriesOuvertes ? 'rotate-180' : ''}`} />
      </button>
      <div id="catalogue-categories" className={`gap-6 p-4 sm:p-5 lg:grid lg:grid-cols-[minmax(0,1.65fr)_minmax(15rem,1fr)] lg:gap-8 ${categoriesOuvertes ? 'grid' : 'hidden'}`}>
        <fieldset className="min-w-0">
          <legend className={LEGEND}>Genres</legend>
          <div className="flex flex-wrap gap-2">
            <button type="button" aria-pressed={!filtres.genre} onClick={() => onChange({ genre: null })}
              className={`min-h-10 rounded-lg border px-3 text-sm transition-colors ${!filtres.genre ? 'border-lamp-500/40 bg-lamp-500/10 text-lamp-400' : 'border-ink-600 text-haze-300 hover:border-ink-500 hover:text-paper'}`}>Tous</button>
            {GENRES.map((genre) => {
              const actif = filtres.genre === genre
              return (
                <button key={genre} type="button" aria-pressed={actif}
                  onClick={() => onChange({ genre: actif ? null : genre })}
                  className={`inline-flex min-h-10 items-center gap-1.5 rounded-lg border px-3 text-sm transition-colors ${actif ? 'border-lamp-500/50 bg-lamp-500/15 font-medium text-lamp-400' : 'border-ink-700 bg-ink-950/40 text-haze-300 hover:border-ink-500 hover:bg-ink-800 hover:text-paper'}`}>
                  {actif && <Icon name="check" size={13} />}{genre}
                </button>
              )
            })}
          </div>
        </fieldset>

        <fieldset className="min-w-0 border-t border-ink-700 pt-5 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
          <legend className={LEGEND}>Plateformes</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2">
            {PLATEFORMES.map((plateforme) => {
              const actif = filtres.plateforme === plateforme.id
              return (
                <button key={plateforme.id} type="button" aria-pressed={actif}
                  onClick={() => onChange({ plateforme: actif ? null : plateforme.id })}
                  className={`flex min-h-12 items-center justify-between gap-2 rounded-xl border px-3 text-left text-sm transition-colors ${actif ? 'border-lamp-500/50 bg-lamp-500/10 font-medium text-lamp-400' : 'border-ink-700 bg-ink-950/50 text-haze-300 hover:border-ink-500 hover:bg-ink-800 hover:text-paper'}`}>
                  {plateforme.nom}
                  <span aria-hidden="true" className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border ${actif ? 'border-lamp-500 bg-lamp-500 text-ink-950' : 'border-ink-500'}`}>{actif && <Icon name="check" size={10} />}</span>
                </button>
              )
            })}
          </div>
        </fieldset>
      </div>

      <div className="border-t border-ink-700">
        <button type="button" aria-expanded={detailsOuverts} aria-controls="catalogue-details"
          onClick={() => setDetailsOuverts((v) => !v)}
          className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left text-sm text-haze-300 transition-colors hover:bg-ink-800/60 hover:text-paper sm:px-5">
          <Icon name="quality" size={17} className="shrink-0 text-lamp-400" />
          <span className="flex-1">Affiner la sélection<span className="mt-0.5 block text-xs font-normal text-haze-400 sm:ml-3 sm:mt-0 sm:inline">Langue, période, qualité et note</span></span>
          {avances > 0 && <span className="grid h-6 min-w-6 place-items-center rounded-full bg-lamp-500/15 px-1 text-xs font-semibold text-lamp-400">{avances}</span>}
          <Icon name="chevronDown" size={16} className={`shrink-0 transition-transform ${detailsOuverts ? 'rotate-180' : ''}`} />
        </button>
        <div id="catalogue-details" hidden={!detailsOuverts} className="border-t border-ink-700 p-4 sm:p-5">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <fieldset className="min-w-0">
              <legend className="text-xs font-medium text-haze-300">Langue</legend>
              <div className="mt-2 flex gap-1 rounded-xl border border-ink-600 bg-ink-950 p-1">
                {LANGUES.map((l) => <button key={l.value} type="button" aria-pressed={filtres.langue === l.value}
                  onClick={() => onChange({ langue: filtres.langue === l.value ? null : l.value })}
                  className={`min-h-9 flex-1 rounded-lg px-2 text-xs transition-colors ${filtres.langue === l.value ? 'bg-lamp-500 font-semibold text-ink-950' : 'text-haze-300 hover:bg-ink-800 hover:text-paper'}`}>{l.label}</button>)}
              </div>
            </fieldset>
            <label className="text-xs font-medium text-haze-300">Période
              <select aria-label="Période" value={filtres.decennie ?? ''} onChange={(e) => onChange({ decennie: e.target.value ? Number(e.target.value) : null })} className={SELECT}>
                <option value="">Toutes les années</option>
                {filtres.decennie !== null && !(DECENNIES as readonly number[]).includes(filtres.decennie) && <option value={filtres.decennie}>Années {filtres.decennie}</option>}
                {DECENNIES.map((d) => <option key={d} value={d}>Années {d}</option>)}
              </select>
            </label>
            <label className="text-xs font-medium text-haze-300">Qualité minimale
              <select aria-label="Qualité minimale" value={filtres.qualite ?? ''} onChange={(e) => onChange({ qualite: (e.target.value || null) as Filtres['qualite'] })} className={SELECT}>
                <option value="">Toutes les qualités</option>{QUALITES.map((q) => <option key={q} value={q}>{q.toUpperCase()}</option>)}
              </select>
            </label>
            <fieldset>
              <legend className="text-xs font-medium text-haze-300">Note des spectateurs</legend>
              <button type="button" aria-pressed={filtres.note === 7} onClick={() => onChange({ note: filtres.note === 7 ? null : 7 })}
                className={`mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border px-3 text-sm transition-colors ${filtres.note === 7 ? 'border-lamp-500/50 bg-lamp-500/10 text-lamp-400' : 'border-ink-600 bg-ink-950 text-haze-300 hover:border-ink-500'}`}>
                <Icon name="check" size={15} />7/10 et plus
              </button>
            </fieldset>
          </div>
        </div>
      </div>

      {selections.length > 0 && <div className="flex flex-wrap items-center gap-2 border-t border-ink-700 bg-ink-950/40 px-4 py-3 sm:px-5" role="group" aria-label="Filtres actifs">
        <span className="mr-1 text-xs text-haze-400">Votre sélection</span>
        {selections.map((s) => <button key={s.label} type="button" onClick={() => onChange(s.patch)} aria-label={`Retirer le filtre ${s.label}`}
          className="inline-flex min-h-9 items-center gap-2 rounded-full border border-lamp-500/25 bg-lamp-500/10 px-3 text-xs text-lamp-400 hover:bg-lamp-500/20">{s.label}<Icon name="close" size={12} /></button>)}
        <button type="button" onClick={onReset} className="min-h-9 px-2 text-xs text-haze-400 underline underline-offset-4 hover:text-paper sm:ml-auto">Tout réinitialiser</button>
      </div>}
    </section>
  )
}
