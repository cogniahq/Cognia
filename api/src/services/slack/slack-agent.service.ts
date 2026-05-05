import { aiProvider } from '../ai/ai-provider.service'
import { auditLogService } from '../core/audit-log.service'
import { logger } from '../../utils/core/logger.util'
import { slackInstallationService, type SlackInstallation } from './slack-installation.service'
import { slackWebApiService, type SlackMessageBlock } from './slack-web-api.service'
import { type SupportedSlackBotEvent } from './slack-events.service'
import {
  slackAgentToolRegistry,
  type SlackToolExecutionContext,
} from './slack-agent-tool-registry.service'
import { slackBotStoreService, type SlackBotApprovalRow } from './slack-bot-store.service'

interface AgentDecision {
  type?: 'tool_call' | 'final'
  tool_name?: string
  arguments?: Record<string, unknown>
  response?: string
  reason?: string
}

interface ToolTraceEntry {
  step: number
  tool: string
  arguments: Record<string, unknown>
  status: 'completed' | 'failed' | 'approval_required'
  reason?: string
  result?: unknown
  error?: string
}

interface SlackInteractionPayload {
  type?: string
  team?: { id?: string }
  user?: { id?: string }
  channel?: { id?: string }
  message?: { ts?: string }
  actions?: Array<{
    action_id?: string
    value?: string
  }>
}

const MAX_AGENT_STEPS = 5
const MAX_CONTEXT_MESSAGES = 10
const MAX_SLACK_TEXT = 35000
const APPROVAL_TTL_MS = 15 * 60 * 1000

function compact(value: unknown, maxLength = 5000): unknown {
  const text = JSON.stringify(value, (_key, item) =>
    typeof item === 'bigint' ? item.toString() : item
  )
  if (!text || text.length <= maxLength) return value
  return { truncated: true, preview: text.slice(0, maxLength) }
}

function truncateSlackText(text: string): string {
  if (text.length <= MAX_SLACK_TEXT) return text
  return `${text.slice(0, MAX_SLACK_TEXT - 80)}\n\n_Response truncated because Slack messages have a size limit._`
}

function parseAgentDecision(raw: string): AgentDecision {
  const trimmed = raw.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)?.[1]
  const candidate = fenced ?? trimmed
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) {
    return { type: 'final', response: raw }
  }
  try {
    return JSON.parse(candidate.slice(start, end + 1)) as AgentDecision
  } catch {
    return { type: 'final', response: raw }
  }
}

function plainToolList(installation: SlackInstallation): string {
  const tools = slackAgentToolRegistry.listToolDefinitions(installation.config.allowedTools)
  return JSON.stringify(
    tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      mutating: tool.mutating,
      inputSchema: tool.inputSchema,
    })),
    null,
    2
  )
}

export class SlackAgentService {
  async handleEvent(event: SupportedSlackBotEvent): Promise<void> {
    const installation = await slackInstallationService.resolveByTeamId(event.teamId)
    if (!installation) {
      logger.warn('[slack-bot] no Cognia org integration for Slack team', { teamId: event.teamId })
      return
    }
    if (installation.config.botEnabled === false) return

    const actor = await slackInstallationService.resolveActorUserId({
      accessToken: installation.accessToken,
      slackUserId: event.userId,
      organizationId: installation.organizationId,
    })

    const prompt = event.text || 'How can I help?'
    const { run, created } = await slackBotStoreService.createRun({
      organizationId: installation.organizationId,
      integrationId: installation.integration.id,
      slackTeamId: event.teamId,
      slackChannelId: event.channelId,
      slackThreadTs: event.threadTs,
      slackEventTs: event.ts,
      slackEventId: event.eventId,
      slackUserId: event.userId,
      actorUserId: actor.userId,
      prompt,
    })

    if (!created) return

    auditLogService
      .logOrgEvent({
        orgId: installation.organizationId,
        actorUserId: actor.userId ?? null,
        actorEmail: actor.email ?? null,
        eventType: 'slack_bot_invoked',
        eventCategory: 'integration',
        action: 'invoke',
        targetResourceType: 'slack_bot_run',
        targetResourceId: run.id,
        metadata: {
          slackTeamId: event.teamId,
          slackChannelId: event.channelId,
          slackUserId: event.userId,
          trigger: event.trigger,
          actorResolution: actor.reason,
        },
      })
      .catch(() => {})

    try {
      const result = await this.runAgent({
        event,
        installation,
        runId: run.id,
        prompt,
        actorUserId: actor.userId,
        actorEmail: actor.email,
        actorResolutionReason: actor.reason,
      })

      if (result.status === 'waiting_for_approval') return

      const replyThreadTs =
        event.trigger === 'app_mention' ? (event.threadTs ?? event.ts) : event.threadTs
      await slackWebApiService.postMessage(installation.accessToken, {
        channel: event.channelId,
        threadTs: replyThreadTs,
        text: truncateSlackText(result.response),
      })

      await slackBotStoreService.updateRun(run.id, {
        status: 'completed',
        response: result.response,
        toolTrace: result.toolTrace,
        completedAt: new Date(),
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logger.error('[slack-bot] run failed', { runId: run.id, error: message })
      await slackBotStoreService.updateRun(run.id, {
        status: 'failed',
        error: message,
        completedAt: new Date(),
      })
      await slackWebApiService.postMessage(installation.accessToken, {
        channel: event.channelId,
        threadTs: event.trigger === 'app_mention' ? (event.threadTs ?? event.ts) : event.threadTs,
        text: `I could not complete that request: ${message}`,
      })
    }
  }

  async handleInteraction(payload: unknown): Promise<void> {
    const interaction = payload as SlackInteractionPayload
    const action = interaction.actions?.[0]
    const approvalId = action?.value
    const slackUserId = interaction.user?.id
    const teamId = interaction.team?.id
    if (!approvalId || !slackUserId || !teamId) return

    const approval = await slackBotStoreService.getApproval(approvalId)
    if (!approval) return

    const installation = await slackInstallationService.resolveByTeamId(teamId)
    if (!installation || installation.organizationId !== approval.organization_id) return

    if (approval.status !== 'pending') {
      await this.postApprovalStatus(
        installation,
        approval,
        `This request is already ${approval.status}.`
      )
      return
    }

    if (approval.expires_at.getTime() < Date.now()) {
      await slackBotStoreService.updateApproval(approval.id, {
        status: 'expired',
        decidedBySlackUserId: slackUserId,
      })
      await this.postApprovalStatus(installation, approval, 'This approval request expired.')
      return
    }

    const actor = await slackInstallationService.resolveActorUserId({
      accessToken: installation.accessToken,
      slackUserId,
      organizationId: installation.organizationId,
    })
    if (!actor.userId) {
      await this.postApprovalStatus(
        installation,
        approval,
        `I could not verify your Cognia organization membership: ${actor.reason ?? 'unknown reason'}`
      )
      return
    }

    if (action?.action_id === 'slack_bot_approval_cancel') {
      await slackBotStoreService.updateApproval(approval.id, {
        status: 'cancelled',
        decidedBySlackUserId: slackUserId,
        decidedByUserId: actor.userId,
      })
      await this.postApprovalStatus(installation, approval, 'Cancelled.')
      return
    }

    try {
      const result = await slackAgentToolRegistry.executeTool(
        approval.tool_name,
        {
          organizationId: installation.organizationId,
          actorUserId: actor.userId,
          actorEmail: actor.email,
        },
        approval.tool_arguments as Record<string, unknown>
      )

      await slackBotStoreService.updateApproval(approval.id, {
        status: 'executed',
        decidedBySlackUserId: slackUserId,
        decidedByUserId: actor.userId,
        executionResult: compact(result),
      })

      await auditLogService.logOrgEvent({
        orgId: installation.organizationId,
        actorUserId: actor.userId,
        actorEmail: actor.email ?? null,
        eventType: 'slack_bot_tool_called',
        eventCategory: 'integration',
        action: approval.tool_name,
        targetResourceType: 'slack_bot_approval',
        targetResourceId: approval.id,
        metadata: { approved: true, result: compact(result, 1000) as Record<string, unknown> },
      })

      await this.postApprovalStatus(
        installation,
        approval,
        `Approved and executed \`${approval.tool_name}\`.\n${this.summarizeToolResult(result)}`
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await slackBotStoreService.updateApproval(approval.id, {
        status: 'failed',
        decidedBySlackUserId: slackUserId,
        decidedByUserId: actor.userId,
        error: message,
      })
      await this.postApprovalStatus(
        installation,
        approval,
        `Approval was accepted, but \`${approval.tool_name}\` failed: ${message}`
      )
    }
  }

  private async runAgent(input: {
    event: SupportedSlackBotEvent
    installation: SlackInstallation
    runId: string
    prompt: string
    actorUserId?: string
    actorEmail?: string
    actorResolutionReason?: string
  }): Promise<
    | { status: 'completed'; response: string; toolTrace: ToolTraceEntry[] }
    | { status: 'waiting_for_approval'; toolTrace: ToolTraceEntry[] }
  > {
    const context = await this.loadThreadContext(input.installation, input.event)
    const toolTrace: ToolTraceEntry[] = []
    const observations: string[] = []
    const toolContext: SlackToolExecutionContext = {
      organizationId: input.installation.organizationId,
      actorUserId: input.actorUserId,
      actorEmail: input.actorEmail,
    }

    for (let step = 1; step <= MAX_AGENT_STEPS; step++) {
      const raw = await aiProvider.generateContent(
        this.buildAgentPrompt({
          prompt: input.prompt,
          context,
          installation: input.installation,
          observations,
          actorResolutionReason: input.actorResolutionReason,
        }),
        true
      )
      const decision = parseAgentDecision(raw)

      if (decision.type !== 'tool_call') {
        return {
          status: 'completed',
          response: decision.response?.trim() || raw.trim() || 'I could not produce a response.',
          toolTrace,
        }
      }

      const toolName = decision.tool_name
      const toolArgs =
        decision.arguments && typeof decision.arguments === 'object' ? decision.arguments : {}
      const tool = toolName ? slackAgentToolRegistry.getTool(toolName) : undefined

      if (!toolName || !tool) {
        const error = `Unknown tool: ${toolName ?? '(missing)'}`
        observations.push(`Tool error: ${error}`)
        toolTrace.push({
          step,
          tool: toolName ?? '(missing)',
          arguments: toolArgs,
          status: 'failed',
          error,
        })
        continue
      }

      if (!slackAgentToolRegistry.isToolAllowed(toolName, input.installation.config.allowedTools)) {
        const error = `Tool is disabled for this Slack integration: ${toolName}`
        observations.push(`Tool error: ${error}`)
        toolTrace.push({ step, tool: toolName, arguments: toolArgs, status: 'failed', error })
        continue
      }

      if (
        slackAgentToolRegistry.requiresApproval(toolName, input.installation.config.approvalPolicy)
      ) {
        await this.requestApproval({
          runId: input.runId,
          event: input.event,
          installation: input.installation,
          toolName,
          toolArgs,
          requesterUserId: input.actorUserId,
          reason: decision.reason,
        })
        toolTrace.push({
          step,
          tool: toolName,
          arguments: toolArgs,
          status: 'approval_required',
          reason: decision.reason,
        })
        await slackBotStoreService.updateRun(input.runId, {
          status: 'waiting_for_approval',
          toolTrace,
        })
        return { status: 'waiting_for_approval', toolTrace }
      }

      try {
        const result = await slackAgentToolRegistry.executeTool(toolName, toolContext, toolArgs)
        observations.push(`Tool ${toolName} result:\n${JSON.stringify(compact(result), null, 2)}`)
        toolTrace.push({
          step,
          tool: toolName,
          arguments: toolArgs,
          status: 'completed',
          result: compact(result),
        })
        auditLogService
          .logOrgEvent({
            orgId: input.installation.organizationId,
            actorUserId: input.actorUserId ?? null,
            actorEmail: input.actorEmail ?? null,
            eventType: 'slack_bot_tool_called',
            eventCategory: 'integration',
            action: toolName,
            targetResourceType: 'slack_bot_run',
            targetResourceId: input.runId,
            metadata: { approved: false },
          })
          .catch(() => {})
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        observations.push(`Tool ${toolName} error: ${message}`)
        toolTrace.push({
          step,
          tool: toolName,
          arguments: toolArgs,
          status: 'failed',
          error: message,
        })
      }
    }

    const raw = await aiProvider.generateContent(
      this.buildAgentPrompt({
        prompt: input.prompt,
        context,
        installation: input.installation,
        observations,
        actorResolutionReason: input.actorResolutionReason,
        forceFinal: true,
      }),
      true
    )
    const finalDecision = parseAgentDecision(raw)
    return {
      status: 'completed',
      response: finalDecision.response?.trim() || raw.trim(),
      toolTrace,
    }
  }

  private async requestApproval(input: {
    runId: string
    event: SupportedSlackBotEvent
    installation: SlackInstallation
    toolName: string
    toolArgs: Record<string, unknown>
    requesterUserId?: string
    reason?: string
  }): Promise<void> {
    const approval = await slackBotStoreService.createApproval({
      organizationId: input.installation.organizationId,
      runId: input.runId,
      toolName: input.toolName,
      toolArguments: input.toolArgs,
      slackTeamId: input.event.teamId,
      slackChannelId: input.event.channelId,
      slackUserId: input.event.userId,
      slackThreadTs:
        input.event.trigger === 'app_mention'
          ? (input.event.threadTs ?? input.event.ts)
          : input.event.threadTs,
      requesterUserId: input.requesterUserId,
      expiresAt: new Date(Date.now() + APPROVAL_TTL_MS),
    })

    const threadTs =
      input.event.trigger === 'app_mention'
        ? (input.event.threadTs ?? input.event.ts)
        : input.event.threadTs
    const response = await slackWebApiService.postMessage(input.installation.accessToken, {
      channel: input.event.channelId,
      threadTs,
      text: `Approval required for \`${input.toolName}\`.`,
      blocks: this.approvalBlocks(approval, input.reason),
    })
    if (response.ts) {
      await slackBotStoreService.setApprovalMessageTs(approval.id, response.ts)
    }
  }

  private approvalBlocks(approval: SlackBotApprovalRow, reason?: string): SlackMessageBlock[] {
    const argsPreview = JSON.stringify(approval.tool_arguments, null, 2).slice(0, 1800)
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Approval required:* \`${approval.tool_name}\`\n${reason ? `${reason}\n` : ''}\n\`\`\`${argsPreview}\`\`\``,
        },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Approve' },
            style: 'primary',
            action_id: 'slack_bot_approval_approve',
            value: approval.id,
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Cancel' },
            style: 'danger',
            action_id: 'slack_bot_approval_cancel',
            value: approval.id,
          },
        ],
      } as SlackMessageBlock,
    ]
  }

  private async postApprovalStatus(
    installation: SlackInstallation,
    approval: SlackBotApprovalRow,
    text: string
  ): Promise<void> {
    await slackWebApiService.postMessage(installation.accessToken, {
      channel: approval.slack_channel_id,
      threadTs: approval.slack_thread_ts ?? undefined,
      text,
    })
  }

  private summarizeToolResult(result: unknown): string {
    const text = JSON.stringify(compact(result, 1200), null, 2)
    return text ? `\`\`\`${text}\`\`\`` : ''
  }

  private async loadThreadContext(
    installation: SlackInstallation,
    event: SupportedSlackBotEvent
  ): Promise<string> {
    const rootTs = event.threadTs ?? event.ts
    try {
      const replies = await slackWebApiService.getConversationReplies(
        installation.accessToken,
        event.channelId,
        rootTs,
        MAX_CONTEXT_MESSAGES
      )
      const messages = replies.messages ?? []
      return messages
        .filter(message => message.text && !message.bot_id)
        .slice(-MAX_CONTEXT_MESSAGES)
        .map(message => `- ${message.user ?? 'unknown'}: ${message.text}`)
        .join('\n')
    } catch {
      return `- ${event.userId}: ${event.text}`
    }
  }

  private buildAgentPrompt(input: {
    prompt: string
    context: string
    installation: SlackInstallation
    observations: string[]
    actorResolutionReason?: string
    forceFinal?: boolean
  }): string {
    const actorNote = input.actorResolutionReason
      ? `The Slack user is not mapped to a Cognia user for mutating/user-scoped tools: ${input.actorResolutionReason}`
      : 'The Slack user is mapped to a Cognia organization member.'

    return `You are Cognia's Slack agent for an organization.

User request:
${input.prompt}

Recent Slack context:
${input.context || '(none)'}

Actor context:
${actorNote}

Available tools:
${plainToolList(input.installation)}

Tool observations so far:
${input.observations.length ? input.observations.join('\n\n') : '(none)'}

Rules:
- Use tools when you need Cognia knowledge or when the user asks you to change data.
- Prefer search_org_knowledge before answering factual org-knowledge questions.
- Mutating tools may be paused for Slack approval after you request them.
- Cite search result indexes like [1] when using retrieved facts.
- Be concise and useful in Slack.
- Do not invent tool results.
- Return exactly one JSON object and no prose outside it.

${input.forceFinal ? 'You must return {"type":"final","response":"..."} now.' : 'Return either {"type":"tool_call","tool_name":"...","arguments":{...},"reason":"..."} or {"type":"final","response":"..."}.'}`
  }
}

export const slackAgentService = new SlackAgentService()
