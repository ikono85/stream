import { Link } from 'react-router-dom'
import { PageTransition } from '@/components/layout/PageTransition'

export function NotFound() {
  return (
    <PageTransition>
      <div className="gutter mx-auto flex min-h-[70vh] max-w-[90rem] flex-col justify-center">
        <p className="font-wide text-sm font-semibold text-lamp-500">Page introuvable</p>
        <h1 className="mt-3 max-w-[18ch] font-wide text-[clamp(2rem,6vw,3.5rem)] font-extrabold leading-[1.02] text-paper">
          Cette adresse ne mène nulle part
        </h1>
        <p className="mt-4 max-w-[48ch] text-haze-400">
          Le lien est peut-être ancien, ou le titre a quitté la bibliothèque.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to="/"
            className="inline-flex h-11 items-center rounded-full bg-lamp-500 px-6 font-semibold text-ink-950 transition-colors hover:bg-lamp-400"
          >
            Retour à l'accueil
          </Link>
          <Link
            to="/catalogue"
            className="inline-flex h-11 items-center rounded-full border border-ink-500 px-6 text-paper transition-colors hover:bg-ink-800"
          >
            Parcourir le catalogue
          </Link>
        </div>
      </div>
    </PageTransition>
  )
}
