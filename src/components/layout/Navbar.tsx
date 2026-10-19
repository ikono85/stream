import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Icon } from '@/components/Icon'
import { Mark } from '@/components/layout/Mark'
import { SearchOverlay } from '@/components/SearchOverlay'
import { useLibrary } from '@/hooks/libraryContext'
import { SITE, PROFILE_TINTS } from '@/config'

const LINKS = [
  { to: '/', label: 'Accueil', end: true },
  { to: '/catalogue?type=film', label: 'Films', end: false },
  { to: '/catalogue?type=serie', label: 'Séries', end: false },
  { to: '/ma-liste', label: 'Ma liste', end: true },
]

function tintOf(index: number): string {
  return PROFILE_TINTS[index % PROFILE_TINTS.length] ?? PROFILE_TINTS[0]
}

export function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const profileRef = useRef<HTMLDivElement>(null)
  const location = useLocation()
  const reduced = useReducedMotion()
  const { profiles, profile, switchProfile, addProfile } = useLibrary()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    setMenuOpen(false)
    setProfileOpen(false)
  }, [location.pathname, location.search])

  /* Close the profile panel on an outside click. */
  useEffect(() => {
    if (!profileOpen) return
    const onDown = (e: PointerEvent) => {
      if (!profileRef.current?.contains(e.target as Node)) setProfileOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [profileOpen])

  /* Slash focuses search, the way it does everywhere else. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement
      const typing = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement
      if (e.key === '/' && !typing) {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const activeIndex = LINKS.findIndex((l) =>
    l.end ? location.pathname === l.to.split('?')[0] && !location.search
      : location.pathname === '/catalogue' && location.search.includes(l.to.split('=')[1] ?? ''),
  )

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-[background-color,border-color,backdrop-filter] duration-300 ${
          scrolled
            ? 'border-b border-ink-600/70 bg-ink-950/85 backdrop-blur-xl'
            : // The scrim runs past the bar so it fades out instead of stopping on a line.
              'border-b border-transparent before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:-z-10 before:h-36 before:bg-gradient-to-b before:from-ink-950/85 before:via-ink-950/40 before:to-transparent'
        }`}
      >
        <nav className="gutter flex h-16 items-center gap-6 lg:h-[4.5rem]" aria-label="Navigation principale">
          <Link to="/" className="flex shrink-0 items-center gap-2 text-paper" aria-label={`${SITE.name}, accueil`}>
            <Mark />
            <span className="font-wide text-[1.05rem] font-extrabold uppercase tracking-[0.14em]">
              {SITE.name}
            </span>
          </Link>

          <ul className="hidden items-center gap-1 md:flex">
            {LINKS.map((link, i) => (
              <li key={link.to} className="relative">
                <NavLink
                  to={link.to}
                  className={`relative block px-3 py-2 text-sm transition-colors ${
                    i === activeIndex ? 'text-paper' : 'text-haze-400 hover:text-paper'
                  }`}
                >
                  {link.label}
                </NavLink>
                {i === activeIndex && (
                  <motion.span
                    layoutId="nav-underline"
                    className="absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full bg-lamp-500"
                    transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 34 }}
                  />
                )}
              </li>
            ))}
          </ul>

          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="Rechercher"
              className="grid h-10 w-10 place-items-center rounded-full text-haze-300 transition-colors hover:bg-ink-700 hover:text-paper"
            >
              <Icon name="search" size={19} />
            </button>

            <div ref={profileRef} className="relative">
              <button
                type="button"
                onClick={() => setProfileOpen((v) => !v)}
                aria-expanded={profileOpen}
                aria-haspopup="menu"
                aria-label={`Profil : ${profile?.name ?? 'chargement'}`}
                className="grid h-9 w-9 place-items-center rounded-full text-[0.8rem] font-bold text-ink-950 transition-transform hover:scale-105"
                style={{ backgroundColor: tintOf(profile?.tint ?? 0) }}
              >
                {(profile?.name ?? '?').slice(0, 1).toUpperCase()}
              </button>

              <AnimatePresence>
                {profileOpen && (
                  <motion.div
                    role="menu"
                    initial={{ opacity: 0, y: reduced ? 0 : -6, scale: reduced ? 1 : 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: reduced ? 0 : -4, scale: reduced ? 1 : 0.98 }}
                    transition={{ duration: reduced ? 0 : 0.16, ease: [0.22, 1, 0.36, 1] }}
                    className="absolute right-0 top-12 w-60 origin-top-right overflow-hidden rounded-[var(--radius-panel)] border border-ink-600 bg-ink-900 p-2 glow-lift"
                  >
                    <p className="px-2 pb-1.5 pt-1 text-xs text-haze-400">Qui regarde ?</p>
                    {profiles.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        role="menuitem"
                        onClick={() => { switchProfile(p.id); setProfileOpen(false) }}
                        className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm transition-colors ${
                          p.id === profile?.id ? 'bg-ink-700 text-paper' : 'text-haze-300 hover:bg-ink-800 hover:text-paper'
                        }`}
                      >
                        <span
                          className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold text-ink-950"
                          style={{ backgroundColor: tintOf(p.tint) }}
                        >
                          {p.name.slice(0, 1).toUpperCase()}
                        </span>
                        <span className="truncate">{p.name}</span>
                        {p.id === profile?.id && <Icon name="check" size={15} className="ml-auto text-lamp-500" />}
                      </button>
                    ))}

                    <form
                      className="mt-1.5 flex gap-1.5 border-t border-ink-700 pt-2"
                      onSubmit={(e) => {
                        e.preventDefault()
                        const name = newName.trim()
                        if (!name) return
                        void addProfile(name)
                        setNewName('')
                        setProfileOpen(false)
                      }}
                    >
                      <input
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="Nouveau profil"
                        aria-label="Nom du nouveau profil"
                        maxLength={18}
                        className="h-9 min-w-0 flex-1 rounded-lg bg-ink-800 px-2.5 text-sm text-paper outline-none placeholder:text-haze-400/70 focus-visible:outline-2 focus-visible:outline-lamp-500"
                      />
                      <button
                        type="submit"
                        aria-label="Créer le profil"
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-ink-700 text-paper transition-colors hover:bg-lamp-500 hover:text-ink-950"
                      >
                        <Icon name="plus" size={16} />
                      </button>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Ouvrir le menu"
              className="grid h-10 w-10 place-items-center rounded-full text-haze-300 transition-colors hover:bg-ink-700 hover:text-paper md:hidden"
            >
              <Icon name="menu" size={20} />
            </button>
          </div>
        </nav>
      </header>

      {/* Mobile navigation */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            className="fixed inset-0 z-100 md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.18 }}
          >
            <button
              type="button"
              aria-label="Fermer le menu"
              onClick={() => setMenuOpen(false)}
              className="absolute inset-0 w-full cursor-default bg-ink-950/90 backdrop-blur-md"
            />
            <motion.nav
              aria-label="Menu"
              className="relative mx-4 mt-20 overflow-hidden rounded-[var(--radius-panel)] border border-ink-600 bg-ink-900 p-2 glow-lift"
              initial={{ y: reduced ? 0 : -14, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: reduced ? 0 : -10, opacity: 0 }}
              transition={{ duration: reduced ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              {LINKS.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  onClick={() => setMenuOpen(false)}
                  className="block rounded-lg px-3 py-3 font-wide text-base font-semibold text-paper transition-colors hover:bg-ink-700"
                >
                  {link.label}
                </NavLink>
              ))}
              <NavLink
                to="/catalogue"
                onClick={() => setMenuOpen(false)}
                className="block rounded-lg px-3 py-3 font-wide text-base font-semibold text-paper transition-colors hover:bg-ink-700"
              >
                Tout le catalogue
              </NavLink>
            </motion.nav>
          </motion.div>
        )}
      </AnimatePresence>

      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  )
}
