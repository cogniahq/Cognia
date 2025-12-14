import { prisma } from '../lib/prisma.lib'
import { logger } from '../utils/core/logger.util'
import { randomUUID } from 'crypto'

async function migrateToDeveloperApps() {
  try {
    logger.log('Starting migration to developer apps...')

    const allUsers = await prisma.user.findMany()

    logger.log(`Found ${allUsers.length} users`)

    for (const user of allUsers) {
      const existingApps = await prisma.developerApp.findMany({
        where: {
          developer_id: user.id,
        },
      })

      if (existingApps.length > 0) {
        logger.log(`User ${user.id} already has ${existingApps.length} app(s), skipping`)
        continue
      }

      const apiKeysCount = await prisma.apiKey.count({
        where: {
          developer_app: {
            developer_id: user.id,
          },
        },
      })

      if (apiKeysCount === 0) {
        logger.log(`User ${user.id} has no API keys, skipping`)
        continue
      }

      const meshNamespaceId = randomUUID()
      const newApp = await prisma.developerApp.create({
        data: {
          developer_id: user.id,
          name: 'Default App',
          description: 'Migrated from legacy API keys',
          mesh_namespace_id: meshNamespaceId,
        },
      })

      logger.log(`Created default app for user ${user.id}: ${newApp.id}`)

      const apiKeysToMigrate = await prisma.apiKey.findMany({
        where: {
          developer_app: {
            developer_id: user.id,
          },
          last_four: null,
        },
      })

      if (apiKeysToMigrate.length > 0) {
        for (const apiKey of apiKeysToMigrate) {
          const lastFour = apiKey.key_prefix.length >= 4
            ? apiKey.key_prefix.slice(-4)
            : apiKey.key_prefix

          await prisma.apiKey.update({
            where: { id: apiKey.id },
            data: {
              last_four: lastFour,
            },
          })

          logger.log(`Updated API key ${apiKey.id} with last_four`)
        }
      }
    }

    logger.log('Migration completed successfully')
  } catch (error) {
    logger.error('Migration failed:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

if (require.main === module) {
  migrateToDeveloperApps()
    .then(() => {
      process.exit(0)
    })
    .catch(error => {
      console.error('Migration error:', error)
      process.exit(1)
    })
}

export { migrateToDeveloperApps }
