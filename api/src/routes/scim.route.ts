import { Router } from 'express'
import { authenticateScim, ScimRequest } from '../middleware/scim-auth.middleware'
import * as scim from '../services/sso/scim.service'

const router = Router()
router.use(authenticateScim)

router.get('/v2/ServiceProviderConfig', (_req, res) => {
  res.json({
    schemas: ['urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig'],
    documentationUri: 'https://docs.cognia.example/scim',
    patch: { supported: true },
    bulk: { supported: false, maxOperations: 0, maxPayloadSize: 0 },
    filter: { supported: true, maxResults: 200 },
    changePassword: { supported: false },
    sort: { supported: false },
    etag: { supported: false },
    authenticationSchemes: [
      {
        name: 'OAuth Bearer Token',
        description: 'SCIM bearer token',
        type: 'oauthbearertoken',
        primary: true,
      },
    ],
  })
})

router.get('/v2/ResourceTypes', (_req, res) => {
  res.json({
    schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
    Resources: [
      {
        schemas: ['urn:ietf:params:scim:schemas:core:2.0:ResourceType'],
        id: 'User',
        name: 'User',
        endpoint: '/Users',
        schema: 'urn:ietf:params:scim:schemas:core:2.0:User',
      },
      {
        schemas: ['urn:ietf:params:scim:schemas:core:2.0:ResourceType'],
        id: 'Group',
        name: 'Group',
        endpoint: '/Groups',
        schema: 'urn:ietf:params:scim:schemas:core:2.0:Group',
      },
    ],
  })
})

router.get('/v2/Schemas', (_req, res) => {
  res.json({
    schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
    Resources: [
      { id: 'urn:ietf:params:scim:schemas:core:2.0:User', name: 'User' },
      { id: 'urn:ietf:params:scim:schemas:core:2.0:Group', name: 'Group' },
    ],
  })
})

router.get('/v2/Users', async (req: ScimRequest, res) => {
  const orgId = req.scim!.organizationId
  const baseUrl = `${req.protocol}://${req.get('host')}/scim/v2`
  const out = await scim.listUsers(
    orgId,
    {
      filter: req.query.filter as string | undefined,
      startIndex: Number(req.query.startIndex) || undefined,
      count: Number(req.query.count) || undefined,
    },
    baseUrl
  )
  res.json(out)
})

router.get('/v2/Users/:id', async (req: ScimRequest, res) => {
  const baseUrl = `${req.protocol}://${req.get('host')}/scim/v2`
  const user = await scim.getUser(req.scim!.organizationId, req.params.id, baseUrl)
  if (!user)
    return res.status(404).json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      status: '404',
      detail: 'User not found',
    })
  res.json(user)
})

router.post('/v2/Users', async (req: ScimRequest, res) => {
  const baseUrl = `${req.protocol}://${req.get('host')}/scim/v2`
  try {
    const u = await scim.createUser(req.scim!.organizationId, req.body, baseUrl, {
      actorUserId: null,
      actorEmail: null,
    })
    res.status(201).json(u)
  } catch (err) {
    res.status(400).json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      status: '400',
      detail: (err as Error).message,
    })
  }
})

router.patch('/v2/Users/:id', async (req: ScimRequest, res) => {
  const baseUrl = `${req.protocol}://${req.get('host')}/scim/v2`
  const ops = req.body?.Operations ?? []
  const u = await scim.patchUser(req.scim!.organizationId, req.params.id, ops, baseUrl, {
    actorUserId: null,
    actorEmail: null,
  })
  if (!u)
    return res.status(404).json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      status: '404',
      detail: 'User not found',
    })
  res.json(u)
})

router.put('/v2/Users/:id', async (req: ScimRequest, res) => {
  // Treat PUT as PATCH on active flag for simplicity
  const baseUrl = `${req.protocol}://${req.get('host')}/scim/v2`
  const synthOps = [{ op: 'replace', path: 'active', value: req.body?.active ?? true }]
  const u = await scim.patchUser(req.scim!.organizationId, req.params.id, synthOps, baseUrl, {
    actorUserId: null,
    actorEmail: null,
  })
  if (!u)
    return res.status(404).json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      status: '404',
      detail: 'User not found',
    })
  res.json(u)
})

router.delete('/v2/Users/:id', async (req: ScimRequest, res) => {
  const ok = await scim.deleteUser(req.scim!.organizationId, req.params.id, {
    actorUserId: null,
    actorEmail: null,
  })
  if (!ok)
    return res.status(404).json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      status: '404',
      detail: 'User not found',
    })
  res.status(204).end()
})

router.get('/v2/Groups', async (req: ScimRequest, res) => {
  res.json(scim.listGroups(req.scim!.organizationId))
})

router.get('/v2/Groups/:id', (req, res) => {
  const id = req.params.id
  if (!['ADMIN', 'EDITOR', 'VIEWER'].includes(id)) {
    return res.status(404).json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      status: '404',
      detail: 'Group not found',
    })
  }
  res.json({
    schemas: ['urn:ietf:params:scim:schemas:core:2.0:Group'],
    id,
    displayName: id,
    meta: { resourceType: 'Group' },
  })
})

export default router
