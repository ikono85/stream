import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import type { PlayerHandle } from '@/player/Player'
import { syncUrl, type ClientMessage, type Member, type ServerMessage } from '@/sync/protocol'

export type RoomStatus = 'off' | 'connecting' | 'open' | 'lost'

export interface ChatMessage {
  id: string
  name: string
  text: string
  at: number
  mine: boolean
}

export interface WatchTogether {
  status: RoomStatus
  members: Member[]
  me: Member | null
  messages: ChatMessage[]
  /** Set while a peer is loading and playback is held for everyone. */
  hold: string | null
  error: string | null
  reportLocalAction: (playing: boolean, time: number) => void
  reportBuffering: (value: boolean) => void
  sendChat: (text: string) => void
}

/** Past this gap, a follower jumps to the reference instead of easing over. */
const DRIFT_TOLERANCE = 1.2
const TICK_MS = 2000

/**
 * A shared viewing room.
 *
 * Control is shared: any explicit play, pause or jump wins for everyone. What
 * cannot be shared is authority over idle drift — two clients each nudging
 * toward the other oscillate. So the first person in the room is the
 * reference, and the others quietly correct toward its ticks.
 *
 * Nothing here reports back what it applies: peer commands move the video
 * through the player's imperative handle, which bypasses the local-action
 * path entirely.
 */
export function useWatchTogether({ code, name, player }: {
  code: string | null
  name: string
  player: RefObject<PlayerHandle | null>
}): WatchTogether {
  const [status, setStatus] = useState<RoomStatus>('off')
  const [members, setMembers] = useState<Member[]>([])
  const [me, setMe] = useState<Member | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [hold, setHold] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const socketRef = useRef<WebSocket | null>(null)
  const meRef = useRef<Member | null>(null)
  const membersRef = useRef<Member[]>([])
  const bufferingPeers = useRef(new Set<string>())
  /** True when we paused on a peer's behalf and owe them a resume. */
  const heldByPeer = useRef(false)
  const attempts = useRef(0)

  const post = useCallback((message: ClientMessage) => {
    const socket = socketRef.current
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message))
  }, [])

  const isReference = useCallback(() => {
    const mine = meRef.current
    const all = membersRef.current
    if (!mine || all.length === 0) return false
    return all.every((m) => m.order >= mine.order)
  }, [])

  useEffect(() => {
    if (!code) {
      setStatus('off')
      return
    }

    let closed = false
    let retry: number | undefined

    const connect = () => {
      if (closed) return
      setStatus(attempts.current === 0 ? 'connecting' : 'connecting')
      const socket = new WebSocket(syncUrl())
      socketRef.current = socket

      socket.onopen = () => {
        attempts.current = 0
        setError(null)
        socket.send(JSON.stringify({ t: 'join', room: code, name } satisfies ClientMessage))
      }

      socket.onmessage = (event) => {
        let msg: ServerMessage
        try {
          msg = JSON.parse(String(event.data)) as ServerMessage
        } catch {
          return
        }

        switch (msg.t) {
          case 'joined': {
            meRef.current = msg.you
            membersRef.current = msg.members
            setMe(msg.you)
            setMembers(msg.members)
            setStatus('open')
            break
          }

          case 'members': {
            const grew = msg.members.length > membersRef.current.length
            membersRef.current = msg.members
            setMembers(msg.members)
            /* Someone just arrived at a blank player: tell them where we are. */
            if (grew && isReference() && player.current) {
              post({ t: 'state', playing: player.current.isPlaying(), time: player.current.position() })
            }
            if (!grew) {
              bufferingPeers.current = new Set(
                [...bufferingPeers.current].filter((id) => msg.members.some((m) => m.id === id)),
              )
              if (bufferingPeers.current.size === 0 && heldByPeer.current) {
                heldByPeer.current = false
                setHold(null)
                player.current?.play()
              }
            }
            break
          }

          /* Someone acted. Everyone follows, including the position. */
          case 'state': {
            const handle = player.current
            if (!handle) break
            handle.seek(msg.time)
            if (msg.playing) handle.play()
            else handle.pause()
            break
          }

          /* Idle report. Only followers act, and only on the reference's. */
          case 'tick': {
            const handle = player.current
            if (!handle || isReference() || heldByPeer.current) break
            const reference = membersRef.current[0]
            if (!reference || reference.id !== msg.from) break
            if (!msg.playing || !handle.isPlaying()) break
            if (Math.abs(handle.position() - msg.time) > DRIFT_TOLERANCE) handle.seek(msg.time)
            break
          }

          /* Wait for whoever is still loading, then start again together. */
          case 'buffering': {
            const handle = player.current
            if (msg.value) bufferingPeers.current.add(msg.from)
            else bufferingPeers.current.delete(msg.from)

            if (bufferingPeers.current.size > 0) {
              setHold(msg.value ? msg.name : hold)
              if (handle?.isPlaying()) {
                handle.pause()
                heldByPeer.current = true
              }
            } else {
              setHold(null)
              if (heldByPeer.current) {
                heldByPeer.current = false
                handle?.play()
              }
            }
            break
          }

          case 'chat':
            setMessages((current) => [
              ...current.slice(-199),
              {
                id: `${msg.from}-${msg.at}-${current.length}`,
                name: msg.name,
                text: msg.text,
                at: msg.at,
                mine: msg.from === meRef.current?.id,
              },
            ])
            break

          case 'error':
            setError(msg.message)
            break
        }
      }

      socket.onclose = () => {
        if (closed) return
        setStatus('lost')
        attempts.current += 1
        if (attempts.current <= 6) {
          retry = window.setTimeout(connect, Math.min(1000 * attempts.current, 5000))
        }
      }

      socket.onerror = () => socket.close()
    }

    connect()

    return () => {
      closed = true
      if (retry) window.clearTimeout(retry)
      socketRef.current?.close()
      socketRef.current = null
      meRef.current = null
      membersRef.current = []
      bufferingPeers.current.clear()
      heldByPeer.current = false
      setMembers([])
      setMe(null)
      setHold(null)
      setStatus('off')
    }
    // `hold` is read inside but must not retrigger the connection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, name, player, post, isReference])

  /* Position reports, used only to settle drift. */
  useEffect(() => {
    if (status !== 'open') return
    const id = window.setInterval(() => {
      const handle = player.current
      if (!handle) return
      post({ t: 'tick', playing: handle.isPlaying(), time: handle.position() })
    }, TICK_MS)
    return () => window.clearInterval(id)
  }, [status, player, post])

  const reportLocalAction = useCallback((playing: boolean, time: number) => {
    post({ t: 'state', playing, time })
  }, [post])

  const reportBuffering = useCallback((value: boolean) => {
    post({ t: 'buffering', value })
  }, [post])

  const sendChat = useCallback((text: string) => {
    const trimmed = text.trim()
    if (trimmed) post({ t: 'chat', text: trimmed })
  }, [post])

  return { status, members, me, messages, hold, error, reportLocalAction, reportBuffering, sendChat }
}
