import type { Profile, Progress } from '@/types'
import type { Compte } from '@/lib/compte'

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
  getWatched(profileId: string): Promise<string[]>
  setEpisodeWatched(profileId: string, episodeId: string, watched: boolean): Promise<string[]>
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
    throw new Error('Le navigateur ne peut pas enregistrer ces données. Vérifiez l’espace disponible et les autorisations de stockage.')
  }
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10)
}

class LocalStore implements LucarneStore {
  async getWatched(profileId: string): Promise<string[]> {
    return read<string[]>(`watched.${profileId}`, [])
  }
  async setEpisodeWatched(profileId: string, episodeId: string, watched: boolean): Promise<string[]> {
    const all = await this.getWatched(profileId)
    if (watched && !all.includes(episodeId) && all.length >= 20000) throw new Error('Limite des épisodes vus atteinte.')
    const next = all.filter((id) => id !== episodeId)
    if (watched) next.push(episodeId)
    write(`watched.${profileId}`, next)
    return next
  }
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

/* ---------- la même chose, mais chez nous ---------- */

/**
 * LA BIBLIOTHÈQUE D'UN COMPTE
 * ===========================
 * Quand on est connecté, tout passe par le serveur : la liste suit d'un
 * appareil à l'autre, et elle n'est plus perdue en vidant son navigateur.
 *
 * Un compte tient lieu de profil unique — la notion de profils locaux n'a
 * plus d'objet une fois que chacun a son compte, et les méthodes qui les
 * géraient ne font donc rien ici.
 *
 * L'identifiant du compte n'est jamais envoyé : le serveur le lit dans le
 * cookie de session. C'est ce qui garantit qu'on ne peut pas lire la liste
 * du voisin en changeant un numéro dans une URL.
 */
interface Charge {
  episodesVus?: string[]
  maListe: string[]
  progression: Progress[]
  recherches: string[]
}

async function appelle<T>(chemin: string, options: RequestInit = {}): Promise<T> {
  const reponse = await fetch(`/api/bibliotheque${chemin}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  })
  if (!reponse.ok) throw new Error(String(reponse.status))
  return (await reponse.json()) as T
}

class StoreDistant implements LucarneStore {
  async getWatched(): Promise<string[]> {
    return (await appelle<Charge>('')).episodesVus ?? []
  }
  async setEpisodeWatched(_profileId: string, episodeId: string, watched: boolean): Promise<string[]> {
    return (await appelle<{ episodesVus: string[] }>('/episodes-vus', { method: 'PUT', body: JSON.stringify({ episodeId, vu: watched }) })).episodesVus
  }
  /* Champ déclaré puis assigné : les propriétés de paramètre de
     TypeScript ne sont pas effaçables, et ce projet compile sans
     transformation de syntaxe. */
  private readonly compte: Compte

  constructor(compte: Compte) {
    this.compte = compte
  }

  /** Un compte, un profil. Les autres méthodes de profil n'ont plus d'objet. */
  async listProfiles(): Promise<Profile[]> {
    return [{ id: this.compte.id, name: this.compte.nom, tint: teinteDe(this.compte.id) }]
  }

  async createProfile(): Promise<Profile> {
    return { id: this.compte.id, name: this.compte.nom, tint: teinteDe(this.compte.id) }
  }

  async renameProfile(): Promise<void> {}
  async deleteProfile(): Promise<void> {}

  async getActiveProfileId(): Promise<string | null> {
    return this.compte.id
  }

  async setActiveProfileId(): Promise<void> {}

  async getMyList(): Promise<string[]> {
    return (await appelle<Charge>('')).maListe
  }

  async setMyList(_profileId: string, entryIds: string[]): Promise<void> {
    await appelle('/liste', { method: 'PUT', body: JSON.stringify({ ids: entryIds }) })
  }

  async getProgress(): Promise<Progress[]> {
    return (await appelle<Charge>('')).progression
  }

  async putProgress(_profileId: string, progress: Progress): Promise<void> {
    await appelle('/progression', { method: 'PUT', body: JSON.stringify(progress) })
  }

  async dropProgress(_profileId: string, entryId: string): Promise<void> {
    await appelle(`/progression/${encodeURIComponent(entryId)}`, { method: 'DELETE' })
  }

  async getSearchHistory(): Promise<string[]> {
    return (await appelle<Charge>('')).recherches
  }

  async pushSearchHistory(_profileId: string, query: string): Promise<void> {
    const actuelles = await this.getSearchHistory()
    const q = query.trim()
    if (q.length < 2) return
    await appelle('/recherches', {
      method: 'PUT',
      body: JSON.stringify({ recherches: [q, ...actuelles.filter((x) => x !== q)].slice(0, 8) }),
    })
  }

  async clearSearchHistory(): Promise<void> {
    await appelle('/recherches', { method: 'PUT', body: JSON.stringify({ recherches: [] }) })
  }
}

/** Une teinte stable, dérivée de l'identifiant plutôt que d'un compteur. */
function teinteDe(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 997
  return h % 6
}

/**
 * Le magasin à utiliser : celui du serveur quand on est connecté, celui du
 * navigateur sinon. Aucun composant ne sait lequel il manipule.
 */
export function magasinPour(compte: Compte | null): LucarneStore {
  return compte ? new StoreDistant(compte) : store
}
