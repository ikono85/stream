/** Messages exchanged with server/sync.mjs. Keep both sides in step. */

export interface Member {
  id: string
  name: string
  /** Join order. The lowest one settles drift. */
  order: number
}

export type ClientMessage =
  | { t: 'join'; room: string; name: string }
  | { t: 'state'; playing: boolean; time: number }
  | { t: 'tick'; playing: boolean; time: number }
  | { t: 'buffering'; value: boolean }
  | { t: 'chat'; text: string }

export type ServerMessage =
  | { t: 'joined'; you: Member; members: Member[] }
  | { t: 'members'; members: Member[] }
  | { t: 'state'; from: string; name: string; playing: boolean; time: number }
  | { t: 'tick'; from: string; playing: boolean; time: number }
  | { t: 'buffering'; from: string; name: string; value: boolean }
  | { t: 'chat'; from: string; name: string; text: string; at: number }
  | { t: 'error'; message: string }

/** Unambiguous in speech and in handwriting: no O/0, no I/1. */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function newRoomCode(): string {
  const bytes = new Uint8Array(6)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('')
}

export function syncUrl(): string {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${location.host}/sync`
}
