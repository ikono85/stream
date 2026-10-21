import { Link } from 'react-router-dom'
import { Mark } from '@/components/layout/Mark'
import { SITE } from '@/config'
import { InstallApp } from '@/components/InstallApp'

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
            <InstallApp />
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
              <li><Link to="/radio" className="text-haze-400 transition-colors hover:text-paper">Radio</Link></li>
              <li><Link to="/ma-liste" className="text-haze-400 transition-colors hover:text-paper">Ma liste</Link></li>
              <li><Link to="/catalogue?tri=added" className="text-haze-400 transition-colors hover:text-paper">Ajouts récents</Link></li>
              <li><Link to="/catalogue?tri=rating" className="text-haze-400 transition-colors hover:text-paper">Les mieux notés</Link></li>
            </ul>

          </nav>
        </div>

      </div>
    </footer>
  )
}
