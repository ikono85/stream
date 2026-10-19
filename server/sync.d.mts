import type { IncomingMessage } from 'node:http'
import type { Duplex } from 'node:stream'
import type { WebSocketServer } from 'ws'

/**
 * Anything that emits 'upgrade' — http.Server, https.Server, and whatever
 * Vite hands its plugins.
 */
interface Upgradable {
  on(
    event: 'upgrade',
    listener: (req: IncomingMessage, socket: Duplex, head: Buffer) => void,
  ): unknown
}

/** Attach the shared-room relay to an HTTP server, on the /sync path. */
export function attachSync(httpServer: Upgradable): WebSocketServer
