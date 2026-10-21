import { createContext, useContext } from 'react'
import type { Station } from '@/lib/radio'

export type RadioStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error'
export interface RadioValue {
  station: Station | null
  status: RadioStatus
  error: string | null
  volume: number
  muted: boolean
  play: (station: Station) => void
  togglePlayback: () => void
  stop: () => void
  setVolume: (volume: number) => void
  toggleMute: () => void
  favoris: string[]
  favorisReady: boolean
  favorisError: string | null
  pending: string[]
  toggleFavori: (id: string) => Promise<void>
  rechargeFavoris: () => void
}
export const RadioContext = createContext<RadioValue | null>(null)
export function useRadio(): RadioValue {
  const value = useContext(RadioContext)
  if (!value) throw new Error('RadioProvider absent')
  return value
}
