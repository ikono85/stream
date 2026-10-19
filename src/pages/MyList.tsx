import { Link } from 'react-router-dom'
import { PageTransition } from '@/components/layout/PageTransition'
import { PosterCard, PosterSkeleton } from '@/components/Card'
import { useLibrary } from '@/hooks/libraryContext'
import { byId } from '@/data/catalog'

export function MyList() {
  const { ready, myList } = useLibrary()
  const entries = myList.map(byId).filter((e) => e !== undefined)

  return (
    <PageTransition>
      <div className="gutter mx-auto max-w-[90rem] pb-16 pt-28 lg:pt-32">
        <h1 className="font-wide text-[clamp(1.75rem,4vw,2.75rem)] font-extrabold leading-tight text-paper">
          Ma liste
        </h1>
        <p className="mt-2 text-sm text-haze-400 nums-tabular">
          {ready ? `${entries.length} ${entries.length === 1 ? 'titre' : 'titres'}` : 'Chargement'}
        </p>

        {!ready && (
          <div className="mt-8 flex flex-wrap gap-4">
            {Array.from({ length: 6 }, (_, i) => <PosterSkeleton key={i} />)}
          </div>
        )}

        {ready && entries.length === 0 && (
          <div className="mt-14 max-w-[46ch]">
            <p className="font-wide text-lg font-bold text-paper">Votre liste est vide</p>
            <p className="mt-2 text-sm leading-relaxed text-haze-400">
              Ajoutez un titre depuis sa fiche ou en survolant son affiche. La liste est propre à
              chaque profil.
            </p>
            <Link
              to="/catalogue"
              className="mt-6 inline-flex h-11 items-center rounded-full bg-lamp-500 px-6 font-semibold text-ink-950 transition-colors hover:bg-lamp-400"
            >
              Parcourir le catalogue
            </Link>
          </div>
        )}

        {ready && entries.length > 0 && (
          <div className="mt-8 flex flex-wrap gap-3 lg:gap-4">
            {entries.map((entry) => <PosterCard key={entry.id} entry={entry} />)}
          </div>
        )}
      </div>
    </PageTransition>
  )
}
