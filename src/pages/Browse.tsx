import { useSearchParams } from 'react-router-dom'
import { PageTransition } from '@/components/layout/PageTransition'
import { PosterCard, PosterSkeleton } from '@/components/Card'
import { Panne } from '@/components/RangeeDistante'
import { Icon } from '@/components/Icon'
import { useRemote } from '@/hooks/useRemote'
import { catalogue, recherche } from '@/lib/heiwa'
import { CatalogueFilters } from '@/components/CatalogueFilters'
import {
  change, lisFiltres, titreDePage, versCatalogue,
  type Filtres,
} from '@/lib/filtres'
import type { Entry } from '@/types'

/**
 * LE CATALOGUE
 * ============
 * Tout l'état est dans l'adresse, et chaque changement est un appel à l'API.
 * Deux conséquences assumées :
 *
 *   — La pagination est celle de l'API : cinquante titres par page, vingt
 *     pages au plus par jeu de filtres, soit mille titres. Au-delà, il faut
 *     resserrer, et la page le dit plutôt que de laisser chercher.
 *   — Le tri porte sur tout le catalogue, pas sur la page affichée. C'est la
 *     raison pour laquelle il est passé à l'API et non appliqué ici.
 *
 * Une recherche par titre emprunte une autre route — /find — qui n'accepte ni
 * genre ni tri. Les filtres sont donc masqués pendant une recherche, au lieu
 * d'être affichés sans effet.
 */

/** Ce que l'API rend par page. */
const PAR_PAGE = 50

interface Resultat {
  entries: Entry[]
  page: number
  pages: number
  total: number
}

export function Browse() {
  const [params, setParams] = useSearchParams()
  const filtres = lisFiltres(params)

  /* La clé de dépendance : une chaîne stable, pour que l'appel ne reparte
     qu'au changement réel d'un filtre. */
  const clef = JSON.stringify(filtres)

  const resultat = useRemote<Resultat>((signal) => {
    if (filtres.query) {
      return recherche(filtres.query, { limit: 20, rich: 20 }, signal).then((entries) => ({
        entries,
        page: 1,
        pages: 1,
        total: entries.length,
      }))
    }
    // La page affiche 50 titres : leurs affiches doivent toutes être chargées,
    // pas seulement celles des 24 premières entrées.
    return catalogue(versCatalogue(filtres, PAR_PAGE), signal)
  }, [clef])

  const data = resultat.data
  const entries = data?.entries ?? []

  function applique(patch: Partial<Filtres>) {
    setParams(change(filtres, patch))
  }

  function reinitialise() {
    setParams(new URLSearchParams())
  }

  const enRecherche = Boolean(filtres.query)

  return (
    <PageTransition>
      <div className="gutter mx-auto max-w-[90rem] pb-16 pt-28 lg:pt-32">
        <h1 className="font-wide text-[clamp(1.75rem,4vw,2.75rem)] font-extrabold leading-tight text-paper">
          {titreDePage(filtres)}
        </h1>

        <p className="mt-2 text-sm text-haze-400 nums-tabular">
          {resultat.loading && !data ? 'Chargement…'
            : data ? (
              enRecherche
                ? `${data.total} ${data.total === 1 ? 'résultat' : 'résultats'}`
                : `${data.total.toLocaleString('fr-FR')} ${data.total === 1 ? 'titre' : 'titres'}${
                    data.pages > 1 ? ` · page ${data.page} sur ${data.pages}` : ''
                  }`
            ) : ''}
        </p>

        {enRecherche ? (
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={reinitialise}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-ink-600 px-4 text-sm text-haze-300 transition-colors hover:border-haze-400 hover:text-paper"
            >
              <Icon name="close" size={14} />
              Quitter la recherche
            </button>
            <p className="text-xs text-haze-400">
              La recherche par titre ne se combine pas aux filtres.
            </p>
          </div>
        ) : (
          <CatalogueFilters filtres={filtres} onChange={applique} onReset={reinitialise} />
        )}

        {resultat.error && !data && (
          <div className="mt-14">
            <Panne message={resultat.error.explication} onRetry={resultat.recharge} />
          </div>
        )}

        {resultat.loading && !data && (
          <div className="mt-8 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6 lg:gap-4 xl:grid-cols-7">
            {Array.from({ length: 21 }, (_, i) => <PosterSkeleton key={i} fluid />)}
          </div>
        )}

        {data && entries.length === 0 && (
          <div className="mt-16 max-w-[46ch]">
            <p className="font-wide text-lg font-bold text-paper">Aucun titre ne correspond</p>
            <p className="mt-2 text-sm leading-relaxed text-haze-400">
              {enRecherche
                ? 'Essayez une autre orthographe, ou le titre original.'
                : 'Retirez un filtre : les combinaisons les plus fines ne trouvent parfois rien.'}
            </p>
            <button
              type="button"
              onClick={reinitialise}
              className="mt-6 inline-flex h-11 items-center rounded-full bg-lamp-500 px-6 font-semibold text-ink-950 transition-colors hover:bg-lamp-400"
            >
              Tout afficher
            </button>
          </div>
        )}

        {data && entries.length > 0 && (
          <>
            {/* La grille s'estompe pendant un rechargement : la page garde sa
                hauteur et sa place de défilement, au lieu de sauter. */}
            <div
              className={`mt-8 grid grid-cols-3 gap-3 transition-opacity duration-200 sm:grid-cols-4 lg:grid-cols-6 lg:gap-4 xl:grid-cols-7 ${
                resultat.loading ? 'opacity-50' : 'opacity-100'
              }`}
            >
              {entries.map((entry, i) => (
                <PosterCard key={entry.id} entry={entry} fluid eager={i < 14} />
              ))}
            </div>

            {!enRecherche && data.pages > 1 && (
              <nav className="mt-12 flex items-center justify-center gap-3" aria-label="Pagination">
                <button
                  type="button"
                  disabled={data.page <= 1}
                  onClick={() => applique({ page: data.page - 1 })}
                  className="inline-flex h-11 items-center gap-2 rounded-full border border-ink-600 px-5 text-sm text-paper transition-colors hover:border-haze-400 hover:bg-ink-800 disabled:pointer-events-none disabled:opacity-40"
                >
                  <Icon name="chevronLeft" size={17} />
                  Précédente
                </button>

                <span className="px-2 text-sm text-haze-400 nums-tabular">
                  {data.page} / {data.pages}
                </span>

                <button
                  type="button"
                  disabled={data.page >= data.pages}
                  onClick={() => applique({ page: data.page + 1 })}
                  className="inline-flex h-11 items-center gap-2 rounded-full border border-ink-600 px-5 text-sm text-paper transition-colors hover:border-haze-400 hover:bg-ink-800 disabled:pointer-events-none disabled:opacity-40"
                >
                  Suivante
                  <Icon name="chevronRight" size={17} />
                </button>
              </nav>
            )}

            {/* Mille titres, c'est la limite de l'API. Le dire au bon moment
                vaut mieux qu'une page 21 qui renverrait une erreur. */}
            {!enRecherche && data.pages >= 20 && data.page >= 20 && (
              <p className="mt-6 text-center text-xs text-haze-400">
                L'API rend au plus {(20 * PAR_PAGE).toLocaleString('fr-FR')} titres par recherche.
                Ajoutez un genre, une décennie ou une langue pour atteindre le reste du catalogue.
              </p>
            )}
          </>
        )}
      </div>
    </PageTransition>
  )
}
