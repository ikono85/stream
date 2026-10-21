/**
 * Types pour server/heiwa.mjs, consommés par vite.config.ts.
 *
 * Le proxy est écrit en JavaScript parce qu'il tourne aussi sous `node
 * server/index.mjs`, sans étape de compilation. Cette déclaration donne à
 * Vite — et à `tsc -b` — de quoi vérifier l'import, comme sync.d.mts le fait
 * pour le relais de salles.
 */

import type { IncomingMessage, ServerResponse } from 'node:http'

/**
 * Traite une requête si elle appartient au proxy (/api/hs/…). Renvoie true
 * dans ce cas, false sinon, pour que l'appelant passe la main.
 */
export function serviHeiwa(req: IncomingMessage, res: ServerResponse): Promise<boolean>

/** Le même proxy, en middleware Connect, pour le serveur de développement. */
export function middlewareHeiwa(): (
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void,
) => void
