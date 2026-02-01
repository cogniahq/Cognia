import { Express } from 'express'
import memoryRouter from './memory.route'
import contentRouter from './content.route'
import searchRouter from './search.route'
import authRouter from './auth.route'
import profileRouter from './profile.route'
import exportImportRouter from './export-import.route'
import privacyRouter from './privacy.route'
import adminRouter from './admin.route'
import organizationRouter from './organization.route'
import documentRouter from './document.route'
import invitationRouter from './invitation.route'

export const routes = (app: Express) => {
  app.use('/api/memory', memoryRouter)
  app.use('/api/content', contentRouter)

  app.use('/api/search', searchRouter)
  app.use('/api/auth', authRouter)
  app.use('/api/profile', profileRouter)
  app.use('/api/export', exportImportRouter)
  app.use('/api/privacy', privacyRouter)
  app.use('/api/admin', adminRouter)
  app.use('/api/organizations', organizationRouter)
  // Document routes are mounted under /api/organizations/:slug/documents
  app.use('/api/organizations', documentRouter)
  // Public invitation routes (for accepting invitations)
  app.use('/api/invitations', invitationRouter)
}
