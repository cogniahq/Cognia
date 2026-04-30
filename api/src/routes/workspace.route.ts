import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.middleware'
import {
  requireOrganization,
  requireOrgEditor,
  OrganizationRequest,
} from '../middleware/organization.middleware'
import {
  createWorkspace,
  listWorkspaces,
  deleteWorkspace,
  moveMemoryToWorkspace,
} from '../services/memory/workspace.service'

const router = Router({ mergeParams: true })

router.use('/:slug', authenticateToken, requireOrganization)

router.get('/:slug/workspaces', async (req: OrganizationRequest, res) => {
  const out = await listWorkspaces(req.organization!.id)
  res.json({ success: true, data: out })
})

router.post('/:slug/workspaces', requireOrgEditor, async (req: OrganizationRequest, res) => {
  if (!req.user?.id) return res.status(401).json({ message: 'Unauthorized' })
  const out = await createWorkspace(
    req.organization!.id,
    req.body?.name ?? 'New Workspace',
    req.user.id,
    req.body?.description
  )
  res.status(201).json({ success: true, data: out })
})

router.delete(
  '/:slug/workspaces/:workspaceId',
  requireOrgEditor,
  async (req: OrganizationRequest, res) => {
    try {
      await deleteWorkspace(req.organization!.id, req.params.workspaceId)
      res.json({ success: true })
    } catch (err) {
      res.status(404).json({ success: false, message: (err as Error).message })
    }
  }
)

router.put('/:slug/memories/:memoryId/workspace', async (req: OrganizationRequest, res) => {
  if (!req.user?.id) return res.status(401).json({ message: 'Unauthorized' })
  try {
    const out = await moveMemoryToWorkspace(
      req.params.memoryId,
      req.user.id,
      req.body?.workspaceId ?? null
    )
    res.json({ success: true, data: out })
  } catch (err) {
    res.status(404).json({ success: false, message: (err as Error).message })
  }
})

export default router
