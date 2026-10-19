import { Link } from 'react-router-dom'
import { Mark } from '@/components/layout/Mark'
import { SITE } from '@/config'
import { CATALOG } from '@/data/catalog'

export function Footer() {
  const licensed = CATALOG.filter((e) => e.attribution && e.license !== 'Domaine public')
  /* Counted rather than asserted: the catalogue's makeup changes with every
     import, and a sentence that stops being true is worse than no sentence. */
  const invented = CATALOG.filter((e) => e.demo).length
  const fromTmdb = CATALOG.filter((e) => e.id.startsWith('tmdb-')).length

  return (
    <footer className="mt-24 border-t border-ink-700 bg-ink-950">
      <div className="gutter mx-auto max-w-[90rem] py-12">
        <div className="flex flex-wrap items-start justify-between gap-8">
          <div className="max-w-[34ch]">
            <div className="flex items-center gap-2 text-paper">
              <Mark size={18} />
              <span className="font-wide text-sm font-extrabold uppercase tracking-[0.14em]">
                {SITE.name}
              </span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-haze-400">{SITE.purpose}</p>
          </div>

          <nav aria-label="Pied de page" className="flex gap-10 text-sm">
            <ul className="space-y-2">
              <li><Link to="/catalogue" className="text-haze-400 transition-colors hover:text-paper">Catalogue</Link></li>
              <li><Link to="/catalogue?type=film" className="text-haze-400 transition-colors hover:text-paper">Films</Link></li>
              <li><Link to="/catalogue?type=serie" className="text-haze-400 transition-colors hover:text-paper">Séries</Link></li>
            </ul>
            <ul className="space-y-2">
              <li><Link to="/ma-liste" className="text-haze-400 transition-colors hover:text-paper">Ma liste</Link></li>
              <li><Link to="/titre/mire-lucarne" className="text-haze-400 transition-colors hover:text-paper">Mire de test</Link></li>
            </ul>
          </nav>
        </div>

        <div className="mt-10 space-y-2 border-t border-ink-700 pt-6 text-xs leading-relaxed text-haze-400">
          <p>
            {invented} titres de ce catalogue sont inventés pour la démonstration : ils
            n'existent pas et ne sont pas lisibles.
          </p>
          {fromTmdb > 0 && (
            <p>
              {fromTmdb} fiches proviennent de The Movie Database — métadonnées et affiches
              seulement, aucune n'est lisible ici. Ce produit utilise l'API de TMDB mais n'est
              ni approuvé ni certifié par TMDB.
            </p>
          )}
          <p>
            Les films réellement lisibles sont publiés sous licence Creative Commons :{' '}
            {licensed.map((e, i) => (
              <span key={e.id}>
                {i > 0 && ' · '}
                <em className="not-italic text-haze-300">{e.title}</em>, {e.attribution}, {e.license}
              </span>
            ))}
            .
          </p>
        </div>
      </div>
    </footer>
  )
}
