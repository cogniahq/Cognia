import { randomUUID } from 'crypto'
import { prisma } from '../../lib/prisma.lib'

export interface SlackBotRunRow {
  id: string
  organization_id: string
  integration_id: string
  slack_team_id: string
  slack_channel_id: string
  slack_thread_ts: string | null
  slack_event_ts: string
  slack_event_id: string
  slack_user_id: string | null
  actor_user_id: string | null
  status: string
  prompt: string
  response: string | null
  error: string | null
  tool_trace: unknown
  created_at: Date
  updated_at: Date
  completed_at: Date | null
}

export interface SlackBotApprovalRow {
  id: string
  organization_id: string
  run_id: string
  action_id: string
  tool_name: string
  tool_arguments: unknown
  slack_team_id: string
  slack_channel_id: string
  slack_user_id: string | null
  slack_message_ts: string | null
  slack_thread_ts: string | null
  requester_user_id: string | null
  status: string
  expires_at: Date
  decided_by_slack_user_id: string | null
  decided_by_user_id: string | null
  decided_at: Date | null
  execution_result: unknown
  error: string | null
  created_at: Date
  updated_at: Date
}

function asJson(value: unknown): string {
  return JSON.stringify(value ?? null)
}

export class SlackBotStoreService {
  async createRun(input: {
    organizationId: string
    integrationId: string
    slackTeamId: string
    slackChannelId: string
    slackThreadTs?: string
    slackEventTs: string
    slackEventId: string
    slackUserId?: string
    actorUserId?: string
    prompt: string
  }): Promise<{ run: SlackBotRunRow; created: boolean }> {
    const inserted = await prisma.$queryRaw<SlackBotRunRow[]>`
      INSERT INTO slack_bot_runs (
        id,
        organization_id,
        integration_id,
        slack_team_id,
        slack_channel_id,
        slack_thread_ts,
        slack_event_ts,
        slack_event_id,
        slack_user_id,
        actor_user_id,
        status,
        prompt
      )
      VALUES (
        ${randomUUID()}::uuid,
        ${input.organizationId}::uuid,
        ${input.integrationId}::uuid,
        ${input.slackTeamId},
        ${input.slackChannelId},
        ${input.slackThreadTs ?? null},
        ${input.slackEventTs},
        ${input.slackEventId},
        ${input.slackUserId ?? null},
        ${input.actorUserId ?? null}::uuid,
        'processing',
        ${input.prompt}
      )
      ON CONFLICT (slack_team_id, slack_event_id) DO NOTHING
      RETURNING *
    `

    if (inserted[0]) {
      return { run: inserted[0], created: true }
    }

    const existing = await prisma.$queryRaw<SlackBotRunRow[]>`
      SELECT * FROM slack_bot_runs
      WHERE slack_team_id = ${input.slackTeamId}
        AND slack_event_id = ${input.slackEventId}
      LIMIT 1
    `
    if (!existing[0]) {
      throw new Error('Slack bot run dedupe conflict could not be resolved')
    }
    return { run: existing[0], created: false }
  }

  async updateRun(
    runId: string,
    patch: {
      status?: string
      response?: string | null
      error?: string | null
      toolTrace?: unknown
      completedAt?: Date | null
    }
  ): Promise<void> {
    await prisma.$executeRaw`
      UPDATE slack_bot_runs
      SET
        status = COALESCE(${patch.status ?? null}, status),
        response = CASE WHEN ${patch.response !== undefined} THEN ${patch.response ?? null} ELSE response END,
        error = CASE WHEN ${patch.error !== undefined} THEN ${patch.error ?? null} ELSE error END,
        tool_trace = CASE
          WHEN ${patch.toolTrace !== undefined}
          THEN CAST(${asJson(patch.toolTrace)} AS jsonb)
          ELSE tool_trace
        END,
        completed_at = CASE
          WHEN ${patch.completedAt !== undefined} THEN ${patch.completedAt ?? null}
          ELSE completed_at
        END,
        updated_at = now()
      WHERE id = ${runId}::uuid
    `
  }

  async createApproval(input: {
    organizationId: string
    runId: string
    toolName: string
    toolArguments: unknown
    slackTeamId: string
    slackChannelId: string
    slackUserId?: string
    slackThreadTs?: string
    requesterUserId?: string
    expiresAt: Date
  }): Promise<SlackBotApprovalRow> {
    const approvalId = randomUUID()
    const rows = await prisma.$queryRaw<SlackBotApprovalRow[]>`
      INSERT INTO slack_bot_approvals (
        id,
        organization_id,
        run_id,
        action_id,
        tool_name,
        tool_arguments,
        slack_team_id,
        slack_channel_id,
        slack_user_id,
        slack_thread_ts,
        requester_user_id,
        status,
        expires_at
      )
      VALUES (
        ${approvalId}::uuid,
        ${input.organizationId}::uuid,
        ${input.runId}::uuid,
        ${`approval:${approvalId}`},
        ${input.toolName},
        CAST(${asJson(input.toolArguments)} AS jsonb),
        ${input.slackTeamId},
        ${input.slackChannelId},
        ${input.slackUserId ?? null},
        ${input.slackThreadTs ?? null},
        ${input.requesterUserId ?? null}::uuid,
        'pending',
        ${input.expiresAt}
      )
      RETURNING *
    `
    return rows[0]
  }

  async setApprovalMessageTs(approvalId: string, messageTs: string): Promise<void> {
    await prisma.$executeRaw`
      UPDATE slack_bot_approvals
      SET slack_message_ts = ${messageTs}, updated_at = now()
      WHERE id = ${approvalId}::uuid
    `
  }

  async getApproval(approvalId: string): Promise<SlackBotApprovalRow | null> {
    const rows = await prisma.$queryRaw<SlackBotApprovalRow[]>`
      SELECT * FROM slack_bot_approvals
      WHERE id = ${approvalId}::uuid
      LIMIT 1
    `
    return rows[0] ?? null
  }

  async updateApproval(
    approvalId: string,
    patch: {
      status: string
      decidedBySlackUserId?: string | null
      decidedByUserId?: string | null
      executionResult?: unknown
      error?: string | null
    }
  ): Promise<void> {
    await prisma.$executeRaw`
      UPDATE slack_bot_approvals
      SET
        status = ${patch.status},
        decided_by_slack_user_id = ${patch.decidedBySlackUserId ?? null},
        decided_by_user_id = ${patch.decidedByUserId ?? null}::uuid,
        decided_at = now(),
        execution_result = CASE
          WHEN ${patch.executionResult !== undefined}
          THEN CAST(${asJson(patch.executionResult)} AS jsonb)
          ELSE execution_result
        END,
        error = ${patch.error ?? null},
        updated_at = now()
      WHERE id = ${approvalId}::uuid
    `
  }
}

export const slackBotStoreService = new SlackBotStoreService()
