import { IntegrationStatus, type OrganizationIntegration, type Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma.lib'
import { integrationService } from '../integration'
import { slackWebApiService } from './slack-web-api.service'
import { logger } from '../../utils/core/logger.util'

export interface SlackApprovalPolicyConfig {
  defaultMode?: 'confirm_required' | 'auto_execute'
  toolModes?: Record<string, 'confirm_required' | 'auto_execute'>
}

export interface SlackBotIntegrationConfig {
  teamId?: string
  team_id?: string
  teamName?: string
  team_name?: string
  botUserId?: string
  bot_user_id?: string
  botEnabled?: boolean
  allowedTools?: string[]
  approvalPolicy?: SlackApprovalPolicyConfig
}

export interface SlackInstallation {
  integration: OrganizationIntegration
  organizationId: string
  accessToken: string
  config: SlackBotIntegrationConfig
  teamId: string
  botUserId?: string
}

function objectConfig(value: Prisma.JsonValue | null): SlackBotIntegrationConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as SlackBotIntegrationConfig
}

function configuredTeamId(config: SlackBotIntegrationConfig): string | undefined {
  return config.teamId || config.team_id
}

function configuredBotUserId(config: SlackBotIntegrationConfig): string | undefined {
  return config.botUserId || config.bot_user_id
}

function mergeConfig(
  existing: SlackBotIntegrationConfig,
  patch: SlackBotIntegrationConfig
): Prisma.InputJsonValue {
  return {
    ...existing,
    ...patch,
  } as Prisma.InputJsonValue
}

export class SlackInstallationService {
  async resolveByTeamId(teamId: string): Promise<SlackInstallation | null> {
    const integrations = await prisma.organizationIntegration.findMany({
      where: {
        provider: 'slack',
        status: IntegrationStatus.ACTIVE,
      },
      orderBy: { connected_at: 'desc' },
    })

    for (const integration of integrations) {
      const config = objectConfig(integration.config)
      if (configuredTeamId(config) === teamId) {
        const tokens = integrationService.getDecryptedTokenSet(integration)
        return {
          integration,
          organizationId: integration.organization_id,
          accessToken: tokens.accessToken,
          config,
          teamId,
          botUserId: configuredBotUserId(config),
        }
      }
    }

    for (const integration of integrations) {
      try {
        const tokens = integrationService.getDecryptedTokenSet(integration)
        const auth = await slackWebApiService.authTest(tokens.accessToken)
        if (auth.team_id !== teamId) continue

        const config = objectConfig(integration.config)
        const nextConfig = mergeConfig(config, {
          teamId: auth.team_id,
          teamName: auth.team,
          botUserId: auth.user_id,
        })

        await prisma.organizationIntegration.update({
          where: { id: integration.id },
          data: { config: nextConfig },
        })

        return {
          integration,
          organizationId: integration.organization_id,
          accessToken: tokens.accessToken,
          config: nextConfig as SlackBotIntegrationConfig,
          teamId,
          botUserId: auth.user_id,
        }
      } catch (error) {
        logger.warn('[slack-bot] failed to inspect Slack integration', {
          integrationId: integration.id,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    return null
  }

  async resolveActorUserId(input: {
    accessToken: string
    slackUserId: string
    organizationId: string
  }): Promise<{ userId?: string; email?: string; reason?: string }> {
    try {
      const userInfo = await slackWebApiService.getUserInfo(input.accessToken, input.slackUserId)
      const email = userInfo.user?.profile?.email?.trim().toLowerCase()
      if (!email) {
        return { reason: 'Slack user profile did not expose an email address.' }
      }

      const user = await prisma.user.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
        select: { id: true, email: true },
      })
      if (!user) return { email, reason: 'No Cognia user exists for this Slack email.' }

      const member = await prisma.organizationMember.findFirst({
        where: {
          user_id: user.id,
          organization_id: input.organizationId,
          deactivated_at: null,
        },
        select: { id: true },
      })

      if (!member) {
        return { email, reason: 'Cognia user is not an active member of this organization.' }
      }

      return { userId: user.id, email: user.email ?? email }
    } catch (error) {
      return {
        reason: error instanceof Error ? error.message : 'Failed to resolve Slack user.',
      }
    }
  }
}

export const slackInstallationService = new SlackInstallationService()
