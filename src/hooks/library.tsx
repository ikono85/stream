import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
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
  const [searchHistory, setSearchHistory] = useState<string[]>([])

  /**
   * Le magasin dépend du compte : le serveur quand on est connecté, le
   * navigateur sinon. Aucun composant ne sait lequel il manipule.
   */
  const [magasin, setMagasin] = useState<LucarneStore>(() => magasinPour(null))

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
    void (async () => {
      const list = await magasin.listProfiles()
      const activeId = await magasin.getActiveProfileId()
      const active = list.find((p) => p.id === activeId) ?? list[0] ?? null
      if (cancelled) return
      setProfiles(list)
      setProfile(active)
      setReady(true)
    })()
    return () => { cancelled = true }
  }, [magasin, compteEnCours])

  /* Per-profile data follows the active profile. */
  useEffect(() => {
    if (!profile) return
    let cancelled = false
    void (async () => {
      const [list, prog, hist] = await Promise.all([
        magasin.getMyList(profile.id),
        magasin.getProgress(profile.id),
        magasin.getSearchHistory(profile.id),
      ])
      if (cancelled) return
      setMyList(list)
      setProgress(prog)
      setSearchHistory(hist)
    })()
    return () => { cancelled = true }
  }, [profile, magasin])

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
    if (!profile) return
    setMyList((current) => {
      const next = current.includes(entryId)
        ? current.filter((x) => x !== entryId)
        : [entryId, ...current]
      void magasin.setMyList(profile.id, next)
      return next
    })
  }, [profile, magasin])

  const saveProgress = useCallback((p: Progress) => {
    if (!profile) return
    setProgress((current) => {
      const key = (x: Progress) => `${x.entryId}:${x.episodeId ?? ''}`
      return [p, ...current.filter((x) => key(x) !== key(p))].slice(0, 60)
    })
    void magasin.putProgress(profile.id, p)
  }, [profile, magasin])

  const dropProgress = useCallback((entryId: string) => {
    if (!profile) return
    setProgress((current) => current.filter((p) => p.entryId !== entryId))
    void magasin.dropProgress(profile.id, entryId)
  }, [profile, magasin])

  const pushSearch = useCallback((query: string) => {
    if (!profile) return
    const q = query.trim()
    if (q.length < 2) return
    setSearchHistory((current) => [q, ...current.filter((x) => x !== q)].slice(0, 8))
    void magasin.pushSearchHistory(profile.id, q)
  }, [profile, magasin])

  const clearSearch = useCallback(() => {
    if (!profile) return
    setSearchHistory([])
    void magasin.clearSearchHistory(profile.id)
  }, [profile, magasin])

  const value = useMemo<LibraryValue>(() => ({
    ready, profiles, profile, switchProfile, addProfile, removeProfile,
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
    ready, profiles, profile, switchProfile, addProfile, removeProfile,
    compte, compteEnCours, inscriptionOuverte, rafraichisCompte,
    myList, toggleList, progress, saveProgress, dropProgress,
    searchHistory, pushSearch, clearSearch,
  ])

  return <LibraryContext value={value}>{children}</LibraryContext>
}
