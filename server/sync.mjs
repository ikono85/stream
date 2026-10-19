/**
 * SALLES PARTAGÉES
 * ================
 * A relay, nothing more. It does not hold the film, it does not decide who is
 * right: it forwards what one viewer did to the others in the same room, and
 * keeps the list of who is present.
 *
 * Shared control, so there is no host. Every explicit action wins for
 * everyone. Idle drift is settled by one member acting as the reference — the
 * one who joined first — which stops two clients from chasing each other.
 *
 * Attached to the Vite dev server in development (see vite.config.ts) and to
 * the production server (see server/index.mjs). Same code both times.
 */

import { WebSocketServer } from 'ws'

const PATH = '/sync'
const MAX_MEMBERS = 8
const MAX_CHAT = 500
const HEARTBEAT_MS = 30_000

/** code -> { members: Map<id, Member>, nextOrder: number } */
const rooms = new Map()

let counter = 0
function nextId() {
  counter += 1
  return `${Date.now().toString(36)}-${counter.toString(36)}`
}

function publicMembers(room) {
  return [...room.members.values()]
    .map(({ id, name, order }) => ({ id, name, order }))
    .sort((a, b) => a.order - b.order)
}

function send(ws, payload) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(payload))
}

function broadcast(room, payload, exceptId) {
  for (const member of room.members.values()) {
    if (member.id === exceptId) continue
    send(member.ws, payload)
  }
}

function leave(ws) {
  const { roomCode, id } = ws.lucarne ?? {}
  if (!roomCode) return
  const room = rooms.get(roomCode)
  if (!room) return
  room.members.delete(id)
  if (room.members.size === 0) {
    rooms.delete(roomCode)
    return
  }
  broadcast(room, { t: 'members', members: publicMembers(room) })
}

function handle(ws, raw) {
  let msg
  try {
    msg = JSON.parse(raw)
  } catch {
    return
  }
  if (!msg || typeof msg.t !== 'string') return

  /* Joining is the only thing allowed before you belong to a room. */
  if (msg.t === 'join') {
    const code = String(msg.room ?? '').trim().toUpperCase().slice(0, 12)
    if (!code) return send(ws, { t: 'error', message: 'Code de salle manquant.' })

    let room = rooms.get(code)
    if (!room) {
      room = { members: new Map(), nextOrder: 0 }
      rooms.set(code, room)
    }
    if (room.members.size >= MAX_MEMBERS) {
      return send(ws, { t: 'error', message: 'Cette salle est pleine.' })
    }

    const id = nextId()
    const name = String(msg.name ?? 'Invité').trim().slice(0, 24) || 'Invité'
    const order = room.nextOrder++
    room.members.set(id, { id, name, order, ws })
    ws.lucarne = { roomCode: code, id }

    send(ws, { t: 'joined', you: { id, name, order }, members: publicMembers(room) })
    broadcast(room, { t: 'members', members: publicMembers(room) }, id)
    return
  }

  const context = ws.lucarne
  if (!context) return
  const room = rooms.get(context.roomCode)
  if (!room) return
  const me = room.members.get(context.id)
  if (!me) return

  switch (msg.t) {
    /* Someone pressed play, paused, or jumped. Everyone follows. */
    case 'state':
      broadcast(room, {
        t: 'state',
        from: me.id,
        name: me.name,
        playing: Boolean(msg.playing),
        time: Number(msg.time) || 0,
      }, me.id)
      break

    /* Idle position report, used only to settle drift. */
    case 'tick':
      broadcast(room, {
        t: 'tick',
        from: me.id,
        playing: Boolean(msg.playing),
        time: Number(msg.time) || 0,
      }, me.id)
      break

    case 'buffering':
      broadcast(room, {
        t: 'buffering',
        from: me.id,
        name: me.name,
        value: Boolean(msg.value),
      }, me.id)
      break

    case 'chat': {
      const text = String(msg.text ?? '').slice(0, MAX_CHAT).trim()
      if (!text) break
      /* Echoed to the sender too, so everyone sees the same order. */
      broadcast(room, { t: 'chat', from: me.id, name: me.name, text, at: Date.now() })
      break
    }

    default:
      break
  }
}

/**
 * Attach the relay to an existing HTTP server on /sync.
 * Upgrades on any other path are left alone — Vite's own hot-reload socket
 * runs beside this one.
 */
export function attachSync(httpServer) {
  const wss = new WebSocketServer({ noServer: true })

  wss.on('connection', (ws) => {
    ws.isAlive = true
    ws.on('pong', () => { ws.isAlive = true })
    ws.on('message', (raw) => handle(ws, raw))
    ws.on('close', () => leave(ws))
    ws.on('error', () => leave(ws))
  })

  httpServer.on('upgrade', (req, socket, head) => {
    let pathname
    try {
      pathname = new URL(req.url, 'http://localhost').pathname
    } catch {
      return
    }
    if (pathname !== PATH) return
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req))
  })

  /* Drop connections that stopped answering, so rooms do not fill with ghosts. */
  const beat = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.isAlive) {
        ws.terminate()
        continue
      }
      ws.isAlive = false
      ws.ping()
    }
  }, HEARTBEAT_MS)
  beat.unref?.()

  return wss
}
