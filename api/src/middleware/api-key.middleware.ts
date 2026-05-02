import { Request, Response, NextFunction } from 'express'
import { createHash } from 'node:crypto'
import { prisma } from '../lib/prisma.lib'

export interface ApiKeyRequest extends Request {
  apiKey?: { id: string; userId: string; organizationId: string | null; scopes: string[] }
  user?: { id: string; email?: string; role?: string }
}

const PREFIX = 'ck_live_'

export function isApiKeyToken(token: string): boolean {
  return token.startsWith(PREFIX) || token.startsWith('ck_test_')
}

export async function authenticateApiKey(
  req: ApiKeyRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'unauthorized', message: 'Bearer token required' })
    return
  }
  const token = auth.slice(7)
  if (!isApiKeyToken(token)) {
    res.status(401).json({ error: 'unauthorized', message: 'Invalid API key format' })
    return
  }
  const hash = createHash('sha256').update(token).digest('hex')
  const row = await prisma.apiKey.findUnique({
    where: { key_hash: hash },
    include: { user: { select: { id: true, email: true } } },
  })
  if (!row || row.revoked_at) {
    res.status(401).json({ error: 'unauthorized', message: 'Invalid or revoked key' })
    return
  }
  // Throttle last_used_at writes: at 100 RPM/key the naive update fires 100x/min
  // per key, which is pure write amplification on a column used only for
  // observability. Bucket to one update per 60s per key. Fire-and-forget; if
  // it fails we still serve the request (best-effort telemetry).
  const now = new Date()
  const last = row.last_used_at
  if (!last || now.getTime() - new Date(last).getTime() > 60_000) {
    prisma.apiKey.update({ where: { id: row.id }, data: { last_used_at: now } }).catch(() => {})
  }
  req.apiKey = {
    id: row.id,
    userId: row.user_id,
    organizationId: row.organization_id,
    scopes: row.scopes,
  }
  req.user = { id: row.user_id, email: row.user.email ?? undefined }
  next()
}

export function requireScope(scope: string) {
  return (req: ApiKeyRequest, res: Response, next: NextFunction): void => {
    if (!req.apiKey) {
      res.status(401).json({ error: 'unauthorized' })
      return
    }
    if (!req.apiKey.scopes.includes(scope) && !req.apiKey.scopes.includes('*')) {
      res.status(403).json({ error: 'forbidden', message: `Missing scope: ${scope}` })
      return
    }
    next()
  }
}
