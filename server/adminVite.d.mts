/**
 * Types pour server/adminVite.mjs, consommés par vite.config.ts — même
 * raison que heiwa.d.mts : le module est en JavaScript parce qu'il sert
 * aussi au serveur de production, sans étape de compilation.
 */

import type { IncomingMessage, ServerResponse } from 'node:http'

/** La garde de /admin et de /api/admin, en middleware Connect. */
export function middlewareAdmin(): (
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void,
) => void
