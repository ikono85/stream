import { createContext, useContext } from 'react'
import type { Profile, Progress } from '@/types'

export interface LibraryValue {
  ready: boolean
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
