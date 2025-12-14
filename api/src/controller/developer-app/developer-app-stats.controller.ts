import { Request, Response, NextFunction } from 'express'
import { developerAppService } from '../../services/core/developer-app.service'
import { AuthenticatedRequest } from '../../middleware/auth.middleware'

export class DeveloperAppStatsController {
    async getAppStats(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { appId } = req.params
            const userId = (req as AuthenticatedRequest).user.id

            const stats = await developerAppService.getAppStats(appId, userId)

            res.status(200).json({
                success: true,
                data: stats,
            })
        } catch (error) {
            next(error)
        }
    }

    async getAppMesh(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { appId } = req.params
            const userId = (req as AuthenticatedRequest).user.id

            const mesh = await developerAppService.getAppMesh(appId, userId)

            res.status(200).json({
                success: true,
                data: mesh,
            })
        } catch (error) {
            next(error)
        }
    }
}

export const developerAppStatsController = new DeveloperAppStatsController()
