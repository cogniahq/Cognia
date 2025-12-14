import { Express } from 'express'
import memoryRouter from './memory.route'
import contentRouter from './content.route'
import searchRouter from './search.route'
import authRouter from './auth.route'
import profileRouter from './profile.route'
import exportImportRouter from './export-import.route'
import privacyRouter from './privacy.route'
import adminRouter from './admin.route'
import apiKeyRouter from './api-key.route'
import developerAppRouter from './developer-app.route'
import meshRouter from './mesh.route'

export const routes = (app: Express) => {
  app.use('/api/memory', memoryRouter)
  app.use('/api/content', contentRouter)

  app.use('/api/search', searchRouter)
  app.use('/api/auth', authRouter)
  app.use('/api/profile', profileRouter)
  app.use('/api/export', exportImportRouter)
  app.use('/api/privacy', privacyRouter)
  app.use('/api/admin', adminRouter)
  app.use('/api/v1/dev/apps', developerAppRouter)
  app.use('/api/v1/dev/apps', apiKeyRouter)
  app.use('/api/v1/mesh', meshRouter)
}
