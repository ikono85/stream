import { createContext, useContext } from 'react'
import type { Profile, Progress } from '@/types'
import type { Compte } from '@/lib/compte'

export interface LibraryValue {
  watched: string[]
  setEpisodeWatched: (episodeId: string, watched: boolean) => void
  ready: boolean
  storageError: string | null
  retryStorage: () => void

  /**
   * Le compte connecté, ou null. Le site est ouvert : sans compte, la liste
   * et les reprises vivent dans ce navigateur ; avec, elles suivent d'un
   * appareil à l'autre.
   */
  compte: Compte | null
  /** Vrai tant qu'on ne sait pas encore si quelqu'un est connecté. */
  compteEnCours: boolean
  inscriptionOuverte: boolean
  /** À appeler après une connexion, une inscription ou une déconnexion. */
  rafraichisCompte: () => Promise<void>
  profiles: Profile[]
  profile: Profile | null
  switchProfile: (id: string) => void
  addProfile: (name: string) => Promise<void>
  removeProfile: (id: string) => Promise<void>

  myList: string[]
  inList: (entryId: string) => boolean
  toggleList: (entryId: string) => void

  progress: Progress[]
  progressFor: (entryId: string, episodeId?: string) => Progress | undefined
  saveProgress: (p: Progress) => void
  dropProgress: (entryId: string) => void

  searchHistory: string[]
  pushSearch: (query: string) => void
  clearSearch: () => void
}

export const LibraryContext = createContext<LibraryValue | null>(null)

/** Everything a profile has saved: its list, its progress, its searches. */
export function useLibrary(): LibraryValue {
  const value = useContext(LibraryContext)
  if (!value) throw new Error('useLibrary must be used inside <LibraryProvider>')
  return value
}
