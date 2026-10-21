import type { IncomingMessage, ServerResponse } from 'node:http'
export function middlewareRadio(): (req: IncomingMessage, res: ServerResponse, next: (error?: unknown) => void) => void
export function serviRadio(req: IncomingMessage, res: ServerResponse): Promise<boolean>
