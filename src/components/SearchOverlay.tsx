import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Icon } from '@/components/Icon'
import { useLibrary } from '@/hooks/libraryContext'
import { recherche, type ErreurHeiwa } from '@/lib/heiwa'
import { suit } from '@/lib/suivi'
import { posterArt } from '@/lib/poster'
import { image, TAILLES } from '@/lib/images'
import { shape, langues } from '@/lib/format'
import type { Entry } from '@/types'

interface Props {
  open: boolean
  onClose: () => void
}

/**
 * Chaque frappe est une requête à l'API, qui limite les rafales : on attend
 * que la frappe se repose. Trois cents millisecondes est le palier au-delà
 * duquel l'attente se remarque, et en dessous duquel on tape encore.
 */
const REPOS_MS = 300

/** L'API refuse en dessous de deux caractères — autant ne pas l'appeler. */
const MINIMUM = 2

export function SearchOverlay({ open, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [results, setResults] = useState<Entry[]>([])
  const [cherche, setCherche] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const reduced = useReducedMotion()
  const { searchHistory, pushSearch, clearSearch } = useLibrary()

  useEffect(() => {
    if (!open) return
    setQuery('')
    setResults([])
    setErreur(null)
    setActive(0)
    const id = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(id)
  }, [open])

  /* La recherche elle-même : annulée à chaque frappe, relancée au repos. */
  useEffect(() => {
    const terme = query.trim()
    if (!open || terme.length < MINIMUM) {
      setResults([])
      setCherche(false)
      setErreur(null)
      return
    }

    const controleur = new AbortController()
    setCherche(true)

    const minuteur = window.setTimeout(() => {
      /* `rich` ramène les affiches : six vignettes valent bien six fiches,
         et le proxy les garde en cache pour la fiche qui suivra. */
      recherche(terme, { limit: 6, rich: 6 }, controleur.signal).then(
        (trouves) => {
          setResults(trouves)
          setActive(0)
          setCherche(false)
          setErreur(null)
          /* Consigné après coup, une fois la frappe reposée : ce qui
             intéresse, c'est le mot cherché, pas chaque lettre tapée. Et
             savoir ce qu'on cherche sans trouver vaut de l'or. */
          suit('recherche', { terme, ...(trouves.length === 0 ? { id: 'sans-resultat' } : {}) })
        },
        (e: unknown) => {
          if (e instanceof DOMException && e.name === 'AbortError') return
          setResults([])
          setCherche(false)
          setErreur((e as ErreurHeiwa)?.explication ?? "La recherche n'a pas abouti.")
        },
      )
    }, REPOS_MS)

    return () => {
      controleur.abort()
      window.clearTimeout(minuteur)
    }
  }, [query, open])

  /* Lock the page behind the overlay. */
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  function go(path: string, remember?: string) {
    if (remember) pushSearch(remember)
    onClose()
    navigate(path)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { onClose(); return }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(i + 1, results.length - 1))
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      const hit = results[active]
      if (hit) go(`/titre/${hit.id}`, query)
      else if (query.trim()) go(`/catalogue?q=${encodeURIComponent(query.trim())}`, query)
    }
  }

  const terme = query.trim()

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-100"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduced ? 0 : 0.18 }}
        >
          <button
            type="button"
            aria-label="Fermer la recherche"
            onClick={onClose}
            className="absolute inset-0 w-full cursor-default bg-ink-950/80 backdrop-blur-md"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Rechercher"
            className="relative mx-auto mt-[8vh] w-[min(42rem,calc(100%-2rem))] overflow-hidden rounded-[var(--radius-panel)] border border-ink-600 bg-ink-900 glow-lift"
            initial={{ y: reduced ? 0 : -18, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: reduced ? 0 : -12, opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.24, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex items-center gap-3 border-b border-ink-700 px-4">
              <Icon name="search" size={19} className="shrink-0 text-haze-400" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => { setQuery(e.target.value); setActive(0) }}
                onKeyDown={onKeyDown}
                type="search"
                placeholder="Titre d'un film, d'une série, d'un animé"
                aria-label="Rechercher dans le catalogue"
                autoComplete="off"
                className="h-14 w-full bg-transparent text-base text-paper outline-none placeholder:text-haze-400/70"
              />
              {cherche && (
                <span
                  aria-hidden="true"
                  className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-ink-600 border-t-lamp-500"
                />
              )}
              <button
                type="button"
                onClick={onClose}
                className="shrink-0 rounded-full p-1.5 text-haze-400 transition-colors hover:text-paper"
                aria-label="Fermer"
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            <div className="max-h-[min(26rem,60vh)] overflow-y-auto">
              {erreur && (
                <p className="px-4 py-8 text-center text-sm text-haze-400">{erreur}</p>
              )}

              {!erreur && terme.length >= MINIMUM && !cherche && results.length === 0 && (
                <p className="px-4 py-8 text-center text-sm text-haze-400">
                  Rien ne correspond à « {terme} » dans le catalogue.
                </p>
              )}

              {results.length > 0 && (
                <ul role="listbox" aria-label="Suggestions" className="p-2">
                  {results.map((entry, i) => (
                    <li key={entry.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={i === active}
                        onMouseEnter={() => setActive(i)}
                        onClick={() => go(`/titre/${entry.id}`, query)}
                        className={`flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors ${
                          i === active ? 'bg-ink-700' : 'hover:bg-ink-800'
                        }`}
                      >
                        <img
                          src={image(entry.posterPath, TAILLES.affiche) ?? posterArt(entry.id)}
                          alt=""
                          loading="lazy"
                          className="h-14 w-[2.35rem] shrink-0 rounded-sm object-cover"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-wide text-sm font-semibold text-paper">
                            {entry.title}
                          </span>
                          <span className="mt-0.5 flex items-center gap-2.5 text-xs text-haze-400 nums-tabular">
                            {entry.year > 0 && <span>{entry.year}</span>}
                            <span>{entry.kind === 'film' ? 'Film' : entry.categorie === 'anime' ? 'Animé' : 'Série'}</span>
                            {shape(entry) && <span>{shape(entry)}</span>}
                            {entry.languages.length > 0 && (
                              <span className="truncate">{langues(entry.languages)}</span>
                            )}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                  {terme && (
                    <li>
                      <button
                        type="button"
                        onClick={() => go(`/catalogue?q=${encodeURIComponent(terme)}`, query)}
                        className="mt-1 w-full rounded-lg p-3 text-left text-sm text-lamp-500 transition-colors hover:bg-ink-800"
                      >
                        Voir tous les résultats pour « {terme} »
                      </button>
                    </li>
                  )}
                </ul>
              )}

              {query.length === 0 && searchHistory.length > 0 && (
                <div className="p-3">
                  <div className="mb-1 flex items-center justify-between px-1">
                    <span className="text-xs text-haze-400">Recherches récentes</span>
                    <button
                      type="button"
                      onClick={clearSearch}
                      className="text-xs text-haze-400 transition-colors hover:text-paper"
                    >
                      Effacer
                    </button>
                  </div>
                  <ul>
                    {searchHistory.map((q) => (
                      <li key={q}>
                        <button
                          type="button"
                          onClick={() => setQuery(q)}
                          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-haze-300 transition-colors hover:bg-ink-800 hover:text-paper"
                        >
                          <Icon name="replay" size={15} className="text-haze-400" />
                          {q}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {query.length === 0 && searchHistory.length === 0 && (
                <p className="px-4 py-8 text-center text-sm text-haze-400">
                  Cherchez un titre. Le catalogue en compte plus de quarante mille.
                </p>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
