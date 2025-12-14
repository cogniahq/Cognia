import { randomUUID } from 'crypto'
import { prisma } from '../../lib/prisma.lib'
import { memoryMeshService } from '../memory/memory-mesh.service'
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

  async getAppStats(appId: string, developerId: string): Promise<{
    totalMemories: number
    totalApiKeys: number
    activeApiKeys: number
    totalRequests: number
    recentMemories: {
      id: string
      content: string
      created_at: Date
      source: string
    }[]
  }> {
    try {
      const app = await prisma.developerApp.findFirst({
        where: { id: appId, developer_id: developerId },
        include: {
          api_keys: {
            include: {
              _count: {
                select: { memories: true }
              }
            }
          }
        }
      })

      if (!app) {
        throw new AppError('Developer app not found', 404)
      }

      const totalApiKeys = app.api_keys.length
      const activeApiKeys = app.api_keys.filter(k => k.is_active).length
      // Sum usage_count from all keys
      const totalRequests = app.api_keys.reduce((sum, key) => sum + key.usage_count, 0)
      // Sum memories count from all keys
      const totalMemories = app.api_keys.reduce((sum, key) => sum + key._count.memories, 0)

      // Fetch recent memories
      const apiKeyIds = app.api_keys.map(k => k.id)
      const recentMemories = await prisma.memory.findMany({
        where: { api_key_id: { in: apiKeyIds } },
        orderBy: { created_at: 'desc' },
        take: 5,
        select: {
          id: true,
          content: true,
          created_at: true,
          source: true
        }
      })

      return {
        totalMemories,
        totalApiKeys,
        activeApiKeys,
        totalRequests,
        recentMemories
      }
    } catch (error) {
      if (error instanceof AppError) throw error
      logger.error('Error getting developer app stats:', error)
      throw new AppError('Failed to get developer app stats', 500)
    }
  }

  async getAppMesh(appId: string, developerId: string) {
    // Verify ownership
    const app = await this.getDeveloperAppById(appId, developerId)
    if (!app) {
      throw new AppError('Developer app not found', 404)
    }

    // Reuse MemoryMeshService logic with the new filter
    return memoryMeshService.getMemoryMesh(undefined, undefined, 1000, 0.4, appId)
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
