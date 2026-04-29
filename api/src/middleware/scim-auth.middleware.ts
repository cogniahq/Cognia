import { Request, Response, NextFunction } from 'express'
import { createHash } from 'node:crypto'
import { prisma } from '../lib/prisma.lib'

export interface ScimRequest extends Request {
  scim?: { organizationId: string; tokenId: string }
}

export async function authenticateScim(req: ScimRequest, res: Response, next: NextFunction) {
  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      status: '401',
      detail: 'Bearer token required',
    })
  }
  const token = auth.slice(7)
  const hash = createHash('sha256').update(token).digest('hex')
  const row = await prisma.scimAccessToken.findUnique({ where: { token_hash: hash } })
  if (!row || row.revoked_at) {
    return res.status(401).json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      status: '401',
      detail: 'Invalid token',
    })
  }
  // Touch last_used_at (best-effort)
  prisma.scimAccessToken
    .update({ where: { id: row.id }, data: { last_used_at: new Date() } })
    .catch(() => {})
  req.scim = { organizationId: row.organization_id, tokenId: row.id }
  next()
}
