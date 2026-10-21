export interface Station {
  id: string
  name: string
  url: string
  favicon: string
  homepage: string
  country: string
  countryCode: string
  languages: string
  tags: string[]
  codec: string
  bitrate: number
  hls: boolean
}
export interface RadioOptions {
  countries: { name: string; stationcount: number }[]
  languages: { name: string; stationcount: number }[]
  genres: { name: string; stationcount: number }[]
}
export interface StationsPage { stations: Station[]; hasMore: boolean }

export async function demandeRadio<T>(path: string, signal?: AbortSignal, method = 'GET'): Promise<T> {
  const response = await fetch(`/api/${path}`, { signal, method })
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new Error(data?.message ?? 'La radio ne répond pas. Réessayez.')
  if (!data) throw new Error('La radio a renvoyé une réponse illisible.')
  return data as T
}

export function pays(code: string): string {
  try { return new Intl.DisplayNames(['fr'], { type: 'region' }).of(code.toUpperCase()) ?? code } catch { return code }
}
