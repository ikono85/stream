import type { Profile, Progress } from '@/types'

/**
 * PERSISTENCE
 * ===========
 * Everything the app remembers goes through this interface. The shipped
 * implementation writes to localStorage, which is per-browser and per-device:
 * fine for trying the app, not enough once several people share a library.
 *
 * To sync across devices, write a second implementation that calls your API
 * and export it as `store` instead. Nothing else in the app changes — no
 * component touches localStorage directly.
 *
 * On authentication: profiles here are a convenience, not a security boundary.
 * A browser-only app cannot keep a secret, so there is deliberately no password
 * field. Real sign-in belongs on the server — see README, "Comptes et
 * authentification", for the shape that fits this interface.
 */
export interface LucarneStore {
  listProfiles(): Promise<Profile[]>
  createProfile(name: string): Promise<Profile>
  renameProfile(id: string, name: string): Promise<void>
  deleteProfile(id: string): Promise<void>

  getMyList(profileId: string): Promise<string[]>
  setMyList(profileId: string, entryIds: string[]): Promise<void>

  getProgress(profileId: string): Promise<Progress[]>
  putProgress(profileId: string, progress: Progress): Promise<void>
  dropProgress(profileId: string, entryId: string): Promise<void>

  getActiveProfileId(): Promise<string | null>
  setActiveProfileId(id: string): Promise<void>

  getSearchHistory(profileId: string): Promise<string[]>
  pushSearchHistory(profileId: string, query: string): Promise<void>
  clearSearchHistory(profileId: string): Promise<void>
}

const NS = 'lucarne.v1'

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`${NS}.${key}`)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(`${NS}.${key}`, JSON.stringify(value))
  } catch {
    /* Private mode, quota, blocked storage — the app keeps working in memory. */
  }
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10)
}

class LocalStore implements LucarneStore {
  async listProfiles(): Promise<Profile[]> {
    const saved = read<Profile[]>('profiles', [])
    if (saved.length) return saved
    const first: Profile[] = [{ id: 'foyer', name: 'Maison', tint: 0 }]
    write('profiles', first)
    return first
  }

  async createProfile(name: string): Promise<Profile> {
    const profiles = await this.listProfiles()
    const profile: Profile = { id: uid(), name, tint: profiles.length % 6 }
    write('profiles', [...profiles, profile])
    return profile
  }

  async renameProfile(id: string, name: string): Promise<void> {
    const profiles = await this.listProfiles()
    write('profiles', profiles.map((p) => (p.id === id ? { ...p, name } : p)))
  }

  async deleteProfile(id: string): Promise<void> {
    const profiles = await this.listProfiles()
    if (profiles.length <= 1) return
    write('profiles', profiles.filter((p) => p.id !== id))
  }

  async getActiveProfileId(): Promise<string | null> {
    return read<string | null>('active', null)
  }

  async setActiveProfileId(id: string): Promise<void> {
    write('active', id)
  }

  async getMyList(profileId: string): Promise<string[]> {
    return read<string[]>(`list.${profileId}`, [])
  }

  async setMyList(profileId: string, entryIds: string[]): Promise<void> {
    write(`list.${profileId}`, entryIds)
  }

  async getProgress(profileId: string): Promise<Progress[]> {
    return read<Progress[]>(`progress.${profileId}`, [])
  }

  async putProgress(profileId: string, progress: Progress): Promise<void> {
    const all = await this.getProgress(profileId)
    const key = (p: Progress) => `${p.entryId}:${p.episodeId ?? ''}`
    const next = [progress, ...all.filter((p) => key(p) !== key(progress))]
    write(`progress.${profileId}`, next.slice(0, 60))
  }

  async dropProgress(profileId: string, entryId: string): Promise<void> {
    const all = await this.getProgress(profileId)
    write(`progress.${profileId}`, all.filter((p) => p.entryId !== entryId))
  }

  async getSearchHistory(profileId: string): Promise<string[]> {
    return read<string[]>(`search.${profileId}`, [])
  }

  async pushSearchHistory(profileId: string, query: string): Promise<void> {
    const q = query.trim()
    if (q.length < 2) return
    const all = await this.getSearchHistory(profileId)
    write(`search.${profileId}`, [q, ...all.filter((x) => x !== q)].slice(0, 8))
  }

  async clearSearchHistory(profileId: string): Promise<void> {
    write(`search.${profileId}`, [])
  }
}

export const store: LucarneStore = new LocalStore()
