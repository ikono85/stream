import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { magasinPour, type LucarneStore } from '@/lib/storage'
import { moi, type Compte } from '@/lib/compte'
import { LibraryContext, type LibraryValue } from '@/hooks/libraryContext'
import type { Profile, Progress } from '@/types'

export function LibraryProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [compte, setCompte] = useState<Compte | null>(null)
  const [compteEnCours, setCompteEnCours] = useState(true)
  const [inscriptionOuverte, setInscriptionOuverte] = useState(true)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [myList, setMyList] = useState<string[]>([])
  const [progress, setProgress] = useState<Progress[]>([])
  const [watched, setWatched] = useState<string[]>([])
  const activeProfile = useRef<string | undefined>(undefined)
  activeProfile.current = profile?.id
  const [searchHistory, setSearchHistory] = useState<string[]>([])
  const [storageError, setStorageError] = useState<string | null>(null)
  const retryRef = useRef<(() => void) | null>(null)
  const failed = useRef(new Set<() => void>())
  const running = useRef(new Set<() => void>())
  const queue = useRef<Promise<void>>(Promise.resolve())
  const listRef = useRef<string[]>([])
  const ownerRef = useRef<LucarneStore | null>(null)
  const [storageRevision, setStorageRevision] = useState(0)

  /**
   * Le magasin dépend du compte : le serveur quand on est connecté, le
   * navigateur sinon. Aucun composant ne sait lequel il manipule.
   */
  const [magasin, setMagasin] = useState<LucarneStore>(() => magasinPour(null))
  useEffect(() => {
    ownerRef.current = magasin
    setStorageError(null)
    retryRef.current = null
    failed.current.clear()
  }, [magasin])

  const retryStorage = useCallback(() => { retryRef.current?.() }, [])

  // Les écritures sont ordonnées ; l'écran ne confirme qu'après sauvegarde.
  const mutate = useCallback((action: () => Promise<void>) => {
    const execute = () => {
      if (running.current.has(execute)) return
      running.current.add(execute)
      queue.current = queue.current.then(async () => {
        try {
          if (ownerRef.current !== magasin) return
          await action()
          if (ownerRef.current !== magasin) return
          failed.current.delete(execute)
          if (failed.current.size === 0) { setStorageError(null); retryRef.current = null }
        } catch {
          if (ownerRef.current !== magasin) return
          setStorageError('La sauvegarde a échoué. Votre dernière modification n’a pas été confirmée.')
          failed.current.add(execute)
          retryRef.current = () => { for (const retry of [...failed.current]) retry() }
        } finally {
          running.current.delete(execute)
        }
      })
    }
    execute()
  }, [magasin])

  const rafraichisCompte = useCallback(async () => {
    try {
      const etat = await moi()
      setCompte(etat.compte)
      setInscriptionOuverte(etat.inscriptionOuverte)
      setMagasin(magasinPour(etat.compte))
    } catch {
      /* Serveur injoignable : on reste sur le stockage local plutôt que de
         bloquer le site. */
      setCompte(null)
      setMagasin(magasinPour(null))
    } finally {
      setCompteEnCours(false)
    }
  }, [])

  /* Au démarrage : qui est connecté ? */
  useEffect(() => { void rafraichisCompte() }, [rafraichisCompte])

  /* Puis le profil, dans le magasin que le compte a désigné. */
  useEffect(() => {
    if (compteEnCours) return
    let cancelled = false
    setReady(false)
    setMyList([])
    listRef.current = []
    setProgress([])
    setWatched([])
    setSearchHistory([])
    void (async () => {
      const list = await magasin.listProfiles()
      const activeId = await magasin.getActiveProfileId()
      const active = list.find((p) => p.id === activeId) ?? list[0] ?? null
      if (cancelled) return
      setProfiles(list)
      setProfile(active)
    })().catch(() => {
      if (cancelled) return
      setStorageError('Impossible de charger votre bibliothèque. Réessayez.')
      retryRef.current = () => setStorageRevision((n) => n + 1)
    })
    return () => { cancelled = true }
  }, [magasin, compteEnCours, storageRevision])

  /* Per-profile data follows the active profile. */
  useEffect(() => {
    if (!profile) return
    let cancelled = false
    void (async () => {
      setReady(false)
      const [list, prog, hist, vus] = await Promise.all([
        magasin.getMyList(profile.id),
        magasin.getProgress(profile.id),
        magasin.getSearchHistory(profile.id),
        magasin.getWatched(profile.id),
      ])
      if (cancelled) return
      setMyList(list)
      listRef.current = list
      setProgress(prog)
      setWatched(vus)
      setSearchHistory(hist)
      setReady(true)
      setStorageError(null)
    })().catch(() => {
      if (cancelled) return
      setStorageError('Impossible de charger votre bibliothèque. Réessayez.')
      retryRef.current = () => setStorageRevision((n) => n + 1)
    })
    return () => { cancelled = true }
  }, [profile, magasin, storageRevision])

  const switchProfile = useCallback((id: string) => {
    setProfiles((current) => {
      const next = current.find((p) => p.id === id)
      if (next) {
        setProfile(next)
        void magasin.setActiveProfileId(id)
      }
      return current
    })
  }, [magasin])

  const addProfile = useCallback(async (name: string) => {
    const created = await magasin.createProfile(name)
    setProfiles(await magasin.listProfiles())
    setProfile(created)
    await magasin.setActiveProfileId(created.id)
  }, [magasin])

  const removeProfile = useCallback(async (id: string) => {
    await magasin.deleteProfile(id)
    const next = await magasin.listProfiles()
    setProfiles(next)
    setProfile((current) => (current?.id === id ? next[0] ?? null : current))
  }, [magasin])

  const toggleList = useCallback((entryId: string) => {
    if (!profile || !ready) return
    mutate(async () => {
      const current = listRef.current
      const next = current.includes(entryId)
        ? current.filter((x) => x !== entryId)
        : [entryId, ...current]
      await magasin.setMyList(profile.id, next)
      if (ownerRef.current !== magasin) return
      listRef.current = next
      setMyList(next)
    })
  }, [profile, magasin, mutate, ready])

  const setEpisodeWatched = useCallback((episodeId: string, vu: boolean) => {
    if (!profile || !ready) return
    mutate(async () => {
      if (activeProfile.current !== profile.id) return
      const next = await magasin.setEpisodeWatched(profile.id, episodeId, vu)
      if (ownerRef.current === magasin && activeProfile.current === profile.id) setWatched(next)
    })
  }, [profile, ready, magasin, mutate])

  const saveProgress = useCallback((p: Progress) => {
    if (!profile) return
    mutate(async () => {
      await magasin.putProgress(profile.id, p)
      if (ownerRef.current !== magasin) return
      setProgress((current) => {
        const key = (x: Progress) => `${x.entryId}:${x.episodeId ?? ''}`
        return [p, ...current.filter((x) => key(x) !== key(p))].slice(0, 60)
      })
    })
  }, [profile, magasin, mutate])

  const dropProgress = useCallback((entryId: string) => {
    if (!profile) return
    mutate(async () => {
      await magasin.dropProgress(profile.id, entryId)
      if (ownerRef.current === magasin) setProgress((current) => current.filter((p) => p.entryId !== entryId))
    })
  }, [profile, magasin, mutate])

  const pushSearch = useCallback((query: string) => {
    if (!profile) return
    const q = query.trim()
    if (q.length < 2) return
    mutate(async () => {
      await magasin.pushSearchHistory(profile.id, q)
      if (ownerRef.current === magasin) setSearchHistory((current) => [q, ...current.filter((x) => x !== q)].slice(0, 8))
    })
  }, [profile, magasin, mutate])

  const clearSearch = useCallback(() => {
    if (!profile) return
    mutate(async () => {
      await magasin.clearSearchHistory(profile.id)
      if (ownerRef.current === magasin) setSearchHistory([])
    })
  }, [profile, magasin, mutate])

  const value = useMemo<LibraryValue>(() => ({
    watched, setEpisodeWatched,
    ready, storageError, retryStorage, profiles, profile, switchProfile, addProfile, removeProfile,
    compte, compteEnCours, inscriptionOuverte, rafraichisCompte,
    myList,
    inList: (id) => myList.includes(id),
    toggleList,
    progress,
    progressFor: (entryId, episodeId) =>
      progress.find((p) => p.entryId === entryId && (episodeId ? p.episodeId === episodeId : true)),
    saveProgress, dropProgress,
    searchHistory, pushSearch, clearSearch,
  }), [
    watched, setEpisodeWatched,
    ready, storageError, retryStorage, profiles, profile, switchProfile, addProfile, removeProfile,
    compte, compteEnCours, inscriptionOuverte, rafraichisCompte,
    myList, toggleList, progress, saveProgress, dropProgress,
    searchHistory, pushSearch, clearSearch,
  ])

  return <LibraryContext value={value}>{children}</LibraryContext>
}
