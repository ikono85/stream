import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { store } from '@/lib/storage'
import { LibraryContext, type LibraryValue } from '@/hooks/libraryContext'
import type { Profile, Progress } from '@/types'

export function LibraryProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [myList, setMyList] = useState<string[]>([])
  const [progress, setProgress] = useState<Progress[]>([])
  const [searchHistory, setSearchHistory] = useState<string[]>([])

  /* Boot: load profiles, pick the last one used. */
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const list = await store.listProfiles()
      const activeId = await store.getActiveProfileId()
      const active = list.find((p) => p.id === activeId) ?? list[0] ?? null
      if (cancelled) return
      setProfiles(list)
      setProfile(active)
      setReady(true)
    })()
    return () => { cancelled = true }
  }, [])

  /* Per-profile data follows the active profile. */
  useEffect(() => {
    if (!profile) return
    let cancelled = false
    void (async () => {
      const [list, prog, hist] = await Promise.all([
        store.getMyList(profile.id),
        store.getProgress(profile.id),
        store.getSearchHistory(profile.id),
      ])
      if (cancelled) return
      setMyList(list)
      setProgress(prog)
      setSearchHistory(hist)
    })()
    return () => { cancelled = true }
  }, [profile])

  const switchProfile = useCallback((id: string) => {
    setProfiles((current) => {
      const next = current.find((p) => p.id === id)
      if (next) {
        setProfile(next)
        void store.setActiveProfileId(id)
      }
      return current
    })
  }, [])

  const addProfile = useCallback(async (name: string) => {
    const created = await store.createProfile(name)
    setProfiles(await store.listProfiles())
    setProfile(created)
    await store.setActiveProfileId(created.id)
  }, [])

  const removeProfile = useCallback(async (id: string) => {
    await store.deleteProfile(id)
    const next = await store.listProfiles()
    setProfiles(next)
    setProfile((current) => (current?.id === id ? next[0] ?? null : current))
  }, [])

  const toggleList = useCallback((entryId: string) => {
    if (!profile) return
    setMyList((current) => {
      const next = current.includes(entryId)
        ? current.filter((x) => x !== entryId)
        : [entryId, ...current]
      void store.setMyList(profile.id, next)
      return next
    })
  }, [profile])

  const saveProgress = useCallback((p: Progress) => {
    if (!profile) return
    setProgress((current) => {
      const key = (x: Progress) => `${x.entryId}:${x.episodeId ?? ''}`
      return [p, ...current.filter((x) => key(x) !== key(p))].slice(0, 60)
    })
    void store.putProgress(profile.id, p)
  }, [profile])

  const dropProgress = useCallback((entryId: string) => {
    if (!profile) return
    setProgress((current) => current.filter((p) => p.entryId !== entryId))
    void store.dropProgress(profile.id, entryId)
  }, [profile])

  const pushSearch = useCallback((query: string) => {
    if (!profile) return
    const q = query.trim()
    if (q.length < 2) return
    setSearchHistory((current) => [q, ...current.filter((x) => x !== q)].slice(0, 8))
    void store.pushSearchHistory(profile.id, q)
  }, [profile])

  const clearSearch = useCallback(() => {
    if (!profile) return
    setSearchHistory([])
    void store.clearSearchHistory(profile.id)
  }, [profile])

  const value = useMemo<LibraryValue>(() => ({
    ready, profiles, profile, switchProfile, addProfile, removeProfile,
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
    myList, toggleList, progress, saveProgress, dropProgress,
    searchHistory, pushSearch, clearSearch,
  ])

  return <LibraryContext value={value}>{children}</LibraryContext>
}
