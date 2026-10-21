import { Suspense, lazy, useEffect, type ReactNode } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'motion/react'
import { transitionsDeVue } from '@/lib/transitions'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { Home } from '@/pages/Home'
import { useRadio } from '@/hooks/radioContext'
import { RadioBar } from '@/components/RadioBar'
import { useLibrary } from '@/hooks/libraryContext'
import { InstallGuide } from '@/components/InstallGuide'

const Radio = lazy(() => import('@/pages/Radio').then((m) => ({ default: m.Radio })))

const Browse = lazy(() => import('@/pages/Browse').then((m) => ({ default: m.Browse })))
const Title = lazy(() => import('@/pages/Title').then((m) => ({ default: m.Title })))
const MyList = lazy(() => import('@/pages/MyList').then((m) => ({ default: m.MyList })))
const Calendrier = lazy(() => import('@/pages/Calendrier').then((m) => ({ default: m.Calendrier })))
const Connexion = lazy(() => import('@/pages/Compte').then((m) => ({ default: m.Connexion })))
const Inscription = lazy(() => import('@/pages/Compte').then((m) => ({ default: m.Inscription })))
const MonCompte = lazy(() => import('@/pages/Compte').then((m) => ({ default: m.MonCompte })))
const Watch = lazy(() => import('@/pages/Watch').then((m) => ({ default: m.Watch })))
const NotFound = lazy(() => import('@/pages/NotFound').then((m) => ({ default: m.NotFound })))

/** Le fondu entre pages, sauf là où le navigateur fait mieux. */
function Enchainement({ children }: { children: ReactNode }) {
  if (transitionsDeVue) return <>{children}</>
  return <AnimatePresence mode="wait">{children}</AnimatePresence>
}

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

function RouteFallback() {
  return (
    <div className="gutter mx-auto max-w-[90rem] pt-28" aria-busy="true" aria-label="Chargement">
      <div className="skeleton h-8 w-52 rounded-md" />
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
        {Array.from({ length: 12 }, (_, i) => (
          <div key={i} className="skeleton aspect-2/3 rounded-[var(--radius-poster)]" />
        ))}
      </div>
    </div>
  )
}

export function App() {
  const location = useLocation()
  const { station } = useRadio()
  const { storageError, retryStorage } = useLibrary()
  /* The player takes the whole screen; chrome would only get in the way. */
  const bare = location.pathname.startsWith('/lecture/')

  return (
    <div className={station && !bare ? 'pb-[calc(6rem+env(safe-area-inset-bottom))]' : ''}>
      <ScrollToTop />
      {!bare && <Navbar />}
      {storageError && <div role="alert" className="fixed inset-x-4 top-20 z-[110] mx-auto max-w-xl rounded-xl border border-lamp-500/40 bg-ink-900 p-4 text-sm text-paper shadow-xl">
        <p>{storageError}</p>
        <button type="button" onClick={retryStorage} className="mt-2 min-h-11 font-semibold text-lamp-400 underline">Réessayer</button>
      </div>}
      <Suspense fallback={<RouteFallback />}>
        {/*
          Deux régimes, et ils ne peuvent pas cohabiter. `mode="wait"` retient
          l'ancienne page le temps de sa sortie, soit un quart de seconde
          pendant lequel la nouvelle n'existe pas encore — or une transition
          de vue a besoin des deux au même instant pour les relier. Là où le
          navigateur sait animer, on lui laisse la main ; ailleurs, le fondu
          de motion reste.
        */}
        <Enchainement>
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={<Home />} />
            <Route path="/catalogue" element={<Browse />} />
            <Route path="/titre/:id" element={<Title />} />
            <Route path="/ma-liste" element={<MyList />} />
            <Route path="/calendrier" element={<Calendrier />} />
            <Route path="/radio" element={<Radio />} />
            <Route path="/connexion" element={<Connexion />} />
            <Route path="/inscription" element={<Inscription />} />
            <Route path="/mon-compte" element={<MonCompte />} />
            <Route path="/lecture/:id" element={<Watch />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Enchainement>
      </Suspense>
      {!bare && <Footer />}
      <RadioBar />
      <InstallGuide />
    </div>
  )
}
