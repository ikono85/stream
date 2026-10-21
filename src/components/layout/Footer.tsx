import { Link } from 'react-router-dom'
import { Mark } from '@/components/layout/Mark'
import { SITE } from '@/config'
import { PLATEFORMES } from '@/lib/plateformes'

/**
 * Les mentions sont dues, et tenues courtes.
 *
 * Le catalogue, les disponibilités et la lecture viennent de HeiwaStream. Les
 * affiches et les fonds qu'elle renvoie sont des chemins TMDB, servis depuis
 * le CDN d'images de TMDB — ce qui oblige à la phrase que TMDB demande, et
 * qui est de toute façon honnête : ce site n'est pas le leur.
 */
export function Footer() {
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
              <li><Link to="/catalogue?type=anime" className="text-haze-400 transition-colors hover:text-paper">Animés</Link></li>
            </ul>
            <ul className="space-y-2">
              <li><Link to="/calendrier" className="text-haze-400 transition-colors hover:text-paper">Calendrier</Link></li>
              <li><Link to="/ma-liste" className="text-haze-400 transition-colors hover:text-paper">Ma liste</Link></li>
              <li><Link to="/catalogue?tri=added" className="text-haze-400 transition-colors hover:text-paper">Ajouts récents</Link></li>
              <li><Link to="/catalogue?tri=rating" className="text-haze-400 transition-colors hover:text-paper">Les mieux notés</Link></li>
            </ul>

            <ul className="space-y-2">
              {PLATEFORMES.map((plateforme) => (
                <li key={plateforme.id}>
                  <Link
                    to={`/catalogue?plateforme=${plateforme.id}`}
                    className="text-haze-400 transition-colors hover:text-paper"
                  >
                    {plateforme.nom}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="mt-10 space-y-2 border-t border-ink-700 pt-6 text-xs leading-relaxed text-haze-400">
          <p>
            Catalogue, disponibilités et lecture fournis par{' '}
            <a
              href="https://heiwastream.fr"
              target="_blank"
              rel="noreferrer noopener"
              className="text-haze-300 underline underline-offset-2 transition-colors hover:text-paper"
            >
              HeiwaStream
            </a>
            . La lecture a lieu dans leur lecteur ; ce site n'héberge aucune vidéo.
          </p>
          <p>
            Affiches, fonds et résumés proviennent de The Movie Database, via HeiwaStream. Ce
            produit utilise l'API de TMDB mais n'est ni approuvé ni certifié par TMDB.
          </p>
          {/* Dit clairement, à l'endroit où ça se dit. Enregistrer l'activité
              des visiteurs sans le leur dire ne se fait pas, et la loi
              française et européenne est du même avis. */}
          <p>
            Ce site enregistre l'activité de ses visiteurs — pages et fiches consultées, lectures
            lancées, recherches — ainsi que l'adresse IP et le type d'appareil. Si vous avez un
            compte, cette activité y est rattachée ; vous pouvez le supprimer, avec tout ce qui
            s'y rapporte, depuis{' '}
            <Link to="/mon-compte" className="text-haze-300 underline underline-offset-2 transition-colors hover:text-paper">
              Mon compte
            </Link>.
          </p>
        </div>
      </div>
    </footer>
  )
}
