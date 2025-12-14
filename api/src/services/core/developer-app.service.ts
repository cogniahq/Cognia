import { randomUUID } from 'crypto'
import { prisma } from '../../lib/prisma.lib'
import { logger } from '../../utils/core/logger.util'
import AppError from '../../utils/http/app-error.util'

export interface CreateDeveloperAppConfig {
  developerId: string
  name: string
  description?: string
}

export interface DeveloperAppInfo {
  id: string
  developerId: string
  name: string
  description?: string | null
  meshNamespaceId: string
  created_at: Date
  updated_at: Date
}

export class DeveloperAppService {
  generateMeshNamespaceId(): string {
    return randomUUID()
  }

  async createDeveloperApp(config: CreateDeveloperAppConfig): Promise<DeveloperAppInfo> {
    try {
      const meshNamespaceId = this.generateMeshNamespaceId()

      const app = await prisma.developerApp.create({
        data: {
          developer_id: config.developerId,
          name: config.name.trim(),
          description: config.description?.trim(),
          mesh_namespace_id: meshNamespaceId,
        },
      })

      return this.mapToDeveloperAppInfo(app)
    } catch (error) {
      logger.error('Error creating developer app:', error)
      throw new AppError('Failed to create developer app', 500)
    }
  }

  async getDeveloperAppById(appId: string, developerId: string): Promise<DeveloperAppInfo | null> {
    try {
      const app = await prisma.developerApp.findFirst({
        where: {
          id: appId,
          developer_id: developerId,
        },
      })

      if (!app) {
        return null
      }

      return this.mapToDeveloperAppInfo(app)
    } catch (error) {
      logger.error('Error getting developer app by ID:', error)
      return null
    }
  }

  async getDeveloperApps(developerId: string): Promise<DeveloperAppInfo[]> {
    try {
      const apps = await prisma.developerApp.findMany({
        where: { developer_id: developerId },
        orderBy: { created_at: 'desc' },
      })

      return apps.map(app => this.mapToDeveloperAppInfo(app))
    } catch (error) {
      logger.error('Error getting developer apps:', error)
      throw new AppError('Failed to get developer apps', 500)
    }
  }

  async updateDeveloperApp(
    appId: string,
    developerId: string,
    updates: {
      name?: string
      description?: string
    }
  ): Promise<DeveloperAppInfo> {
    try {
      const updateData: {
        name?: string
        description?: string | null
      } = {}

      if (updates.name !== undefined) {
        updateData.name = updates.name.trim()
      }

      if (updates.description !== undefined) {
        updateData.description = updates.description === null ? null : updates.description.trim()
      }

      const app = await prisma.developerApp.update({
        where: {
          id: appId,
          developer_id: developerId,
        },
        data: updateData,
      })

      return this.mapToDeveloperAppInfo(app)
    } catch (error) {
      logger.error('Error updating developer app:', error)
      throw new AppError('Failed to update developer app', 500)
    }
  }

  async deleteDeveloperApp(appId: string, developerId: string): Promise<void> {
    try {
      await prisma.developerApp.delete({
        where: {
          id: appId,
          developer_id: developerId,
        },
      })
    } catch (error) {
      logger.error('Error deleting developer app:', error)
      throw new AppError('Failed to delete developer app', 500)
    }
  }

  async getMeshNamespaceIdByAppId(appId: string): Promise<string | null> {
    try {
      const app = await prisma.developerApp.findUnique({
        where: { id: appId },
        select: { mesh_namespace_id: true },
      })

      return app?.mesh_namespace_id || null
    } catch (error) {
      logger.error('Error getting mesh namespace ID by app ID:', error)
      return null
    }
  }

  private mapToDeveloperAppInfo(app: {
    id: string
    developer_id: string
    name: string
    description: string | null
    mesh_namespace_id: string
    created_at: Date
    updated_at: Date
  }): DeveloperAppInfo {
    return {
      id: app.id,
      developerId: app.developer_id,
      name: app.name,
      description: app.description,
      meshNamespaceId: app.mesh_namespace_id,
      created_at: app.created_at,
      updated_at: app.updated_at,
    }
  }
}

export const developerAppService = new DeveloperAppService()
