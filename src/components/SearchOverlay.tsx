import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Icon } from '@/components/Icon'
import { useLibrary } from '@/hooks/libraryContext'
import { CATALOG } from '@/data/catalog'
import { suggest } from '@/lib/search'
import { posterArt } from '@/lib/poster'
import { runtime, seasonCount } from '@/lib/format'

interface Props {
  open: boolean
  onClose: () => void
}

export function SearchOverlay({ open, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const reduced = useReducedMotion()
  const { searchHistory, pushSearch, clearSearch } = useLibrary()

  const results = useMemo(() => suggest(CATALOG, query, 6), [query])

  useEffect(() => {
    if (!open) return
    setQuery('')
    setActive(0)
    const id = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(id)
  }, [open])

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
                placeholder="Titre, personne, genre"
                aria-label="Rechercher dans le catalogue"
                autoComplete="off"
                className="h-14 w-full bg-transparent text-base text-paper outline-none placeholder:text-haze-400/70"
              />
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
              {query.length > 0 && results.length === 0 && (
                <p className="px-4 py-8 text-center text-sm text-haze-400">
                  Rien ne correspond à « {query} ». Essayez un titre, un genre ou un nom.
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
                          src={entry.artwork ?? posterArt(entry.id)}
                          alt=""
                          loading="lazy"
                          className="h-14 w-[2.35rem] shrink-0 rounded-sm object-cover"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-wide text-sm font-semibold text-paper">
                            {entry.title}
                          </span>
                          <span className="mt-0.5 flex items-center gap-2.5 text-xs text-haze-400 nums-tabular">
                            <span>{entry.year}</span>
                            <span>
                              {entry.kind === 'film'
                                ? runtime(entry.runtime ?? 0)
                                : seasonCount(entry.seasons?.length ?? 1)}
                            </span>
                            <span className="truncate">{entry.genres[0]}</span>
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                  {query.trim() && (
                    <li>
                      <button
                        type="button"
                        onClick={() => go(`/catalogue?q=${encodeURIComponent(query.trim())}`, query)}
                        className="mt-1 w-full rounded-lg p-3 text-left text-sm text-lamp-500 transition-colors hover:bg-ink-800"
                      >
                        Voir tous les résultats pour « {query.trim()} »
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
                  Cherchez par titre, par genre, ou par le nom de quelqu'un au générique.
                </p>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
