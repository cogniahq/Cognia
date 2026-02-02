import { Router } from 'express'
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware'
import { AdminController } from '../controller/admin/admin.controller'

const router = Router()

// All admin routes require authentication and admin role
router.use(authenticateToken, requireAdmin)

// Dashboard
router.get('/dashboard', AdminController.getDashboard)
router.get('/stats', AdminController.getStats) // Legacy endpoint

// Users
router.get('/users', AdminController.listUsers)
router.get('/users/:userId', AdminController.getUserDetails)
router.put('/users/:userId/role', AdminController.updateUserRole)
router.delete('/users/:userId', AdminController.deleteUser)

// Organizations
router.get('/organizations', AdminController.listOrganizations)
router.get('/organizations/:orgId', AdminController.getOrganizationDetails)
router.put('/organizations/:orgId/plan', AdminController.updateOrganizationPlan)
router.delete('/organizations/:orgId', AdminController.deleteOrganization)

// Documents
router.get('/documents', AdminController.listDocuments)
router.get('/documents/:documentId/download', AdminController.getDocumentDownloadUrl)
router.post('/documents/:documentId/reprocess', AdminController.reprocessDocument)

// Analytics
router.get('/analytics', AdminController.getAnalytics)
router.get('/storage-analytics', AdminController.getStorageAnalytics)

// Audit Logs
router.get('/audit-logs', AdminController.getAuditLogs)

export default router
