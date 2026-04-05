import { prisma } from '../lib/prisma.lib'
import { platformAuthService } from '../services/platform/platform-auth.service'

async function main() {
  const name = process.argv[2]
  const appId = process.argv[3]

  if (!name || !appId) {
    throw new Error('Usage: npm run platform:create-app -- <name> <app-id>')
  }

  const secret = platformAuthService.generateSecret()
  const secretHash = platformAuthService.hashSecret(secret)

  const app = await prisma.trustedPlatformApp.create({
    data: {
      name,
      app_id: appId,
      secret_hash: secretHash,
    },
  })

  console.log(
    JSON.stringify(
      {
        id: app.id,
        appId: app.app_id,
        name: app.name,
        secret,
      },
      null,
      2
    )
  )
}

main()
  .catch(error => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
