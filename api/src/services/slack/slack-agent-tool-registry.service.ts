import { Prisma, TodoStatus } from '@prisma/client'
import { prisma } from '../../lib/prisma.lib'
import { unifiedSearchService } from '../search/unified-search.service'
import { organizationAccessService } from '../organization/organization-access.service'
import { googleCalendarService } from '../calendar/google-calendar.service'
import { createShare, listSharesForMemory, revokeShare } from '../memory/share.service'
import {
  createSavedSearch,
  deleteSavedSearch,
  listSavedSearches,
  updateSavedSearch,
} from '../memory/saved-search.service'
import { deleteComment, editComment, listComments, postComment } from '../memory/comment.service'

export interface SlackToolExecutionContext {
  organizationId: string
  actorUserId?: string
  actorEmail?: string
}

export interface SlackAgentTool {
  name: string
  description: string
  mutating: boolean
  inputSchema: Record<string, unknown>
  execute: (ctx: SlackToolExecutionContext, args: Record<string, unknown>) => Promise<unknown>
}

export interface SlackToolPolicy {
  defaultMode?: 'confirm_required' | 'auto_execute'
  toolModes?: Record<string, 'confirm_required' | 'auto_execute'>
}

const VALID_TODO_STATUSES: TodoStatus[] = ['PENDING', 'DONE', 'SNOOZED', 'DISMISSED']

function stringArg(args: Record<string, unknown>, key: string): string | undefined {
  const value = args[key]
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function requireString(args: Record<string, unknown>, key: string): string {
  const value = stringArg(args, key)
  if (!value) throw new Error(`${key} is required`)
  return value
}

function numberArg(args: Record<string, unknown>, key: string, fallback: number): number {
  const value = args[key]
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return value
}

function booleanArg(args: Record<string, unknown>, key: string): boolean {
  return args[key] === true
}

function optionalDateArg(args: Record<string, unknown>, key: string): Date | undefined {
  const value = stringArg(args, key)
  if (!value) return undefined
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) throw new Error(`${key} must be a valid ISO date`)
  return date
}

function optionalStringArray(args: Record<string, unknown>, key: string): string[] | undefined {
  const value = args[key]
  if (!Array.isArray(value)) return undefined
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
}

function todoStatusArg(args: Record<string, unknown>, key: string): TodoStatus | undefined {
  const value = stringArg(args, key)
  if (!value) return undefined
  if (!VALID_TODO_STATUSES.includes(value as TodoStatus)) {
    throw new Error(`${key} must be one of ${VALID_TODO_STATUSES.join(', ')}`)
  }
  return value as TodoStatus
}

function serialize(value: unknown): unknown {
  return JSON.parse(
    JSON.stringify(value, (_key, item) => (typeof item === 'bigint' ? item.toString() : item))
  )
}

export class SlackAgentToolRegistryService {
  private tools = new Map<string, SlackAgentTool>()

  constructor() {
    for (const tool of this.buildTools()) {
      this.tools.set(tool.name, tool)
    }
  }

  listToolDefinitions(allowedTools?: string[]): Array<Omit<SlackAgentTool, 'execute'>> {
    return [...this.tools.values()]
      .filter(tool => this.isToolAllowed(tool.name, allowedTools))
      .map(({ execute: _execute, ...tool }) => tool)
  }

  getTool(name: string): SlackAgentTool | undefined {
    return this.tools.get(name)
  }

  isToolAllowed(name: string, allowedTools?: string[]): boolean {
    return !allowedTools?.length || allowedTools.includes(name)
  }

  requiresApproval(name: string, policy?: SlackToolPolicy): boolean {
    const tool = this.getTool(name)
    if (!tool?.mutating) return false
    const toolMode = policy?.toolModes?.[name]
    if (toolMode) return toolMode === 'confirm_required'
    return (policy?.defaultMode ?? 'confirm_required') === 'confirm_required'
  }

  async executeTool(
    name: string,
    ctx: SlackToolExecutionContext,
    args: Record<string, unknown>
  ): Promise<unknown> {
    const tool = this.getTool(name)
    if (!tool) throw new Error(`Unknown tool: ${name}`)
    return serialize(await tool.execute(ctx, args))
  }

  private buildTools(): SlackAgentTool[] {
    return [
      {
        name: 'search_org_knowledge',
        description: 'Search organization documents, memories, and synced integrations.',
        mutating: false,
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string' },
            limit: { type: 'integer', minimum: 1, maximum: 10 },
          },
          required: ['query'],
        },
        execute: async (ctx, args) => {
          const query = requireString(args, 'query')
          const limit = Math.min(Math.max(Math.floor(numberArg(args, 'limit', 5)), 1), 10)
          const result = await unifiedSearchService.search({
            organizationId: ctx.organizationId,
            query,
            limit,
            includeAnswer: false,
          })
          return {
            results: result.results.map((item, index) => ({
              index: index + 1,
              id: item.memoryId,
              title: item.title,
              snippet: item.contentPreview,
              url: item.url,
              documentName: item.documentName,
              pageNumber: item.pageNumber,
              sourceType: item.sourceType,
              score: item.score,
            })),
          }
        },
      },
      {
        name: 'list_recent_memories',
        description: 'List recent organization memories.',
        mutating: false,
        inputSchema: {
          type: 'object',
          properties: { limit: { type: 'integer', minimum: 1, maximum: 10 } },
        },
        execute: async (ctx, args) => {
          const limit = Math.min(Math.max(Math.floor(numberArg(args, 'limit', 5)), 1), 10)
          return prisma.memory.findMany({
            where: { organization_id: ctx.organizationId, deleted_at: null },
            orderBy: { created_at: 'desc' },
            take: limit,
            select: {
              id: true,
              title: true,
              url: true,
              source: true,
              source_type: true,
              created_at: true,
            },
          })
        },
      },
      {
        name: 'get_memory',
        description: 'Fetch one organization memory by id.',
        mutating: false,
        inputSchema: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id'],
        },
        execute: async (ctx, args) => {
          const id = requireString(args, 'id')
          const memory = await prisma.memory.findFirst({
            where: { id, organization_id: ctx.organizationId, deleted_at: null },
            select: {
              id: true,
              title: true,
              url: true,
              content: true,
              full_content: true,
              source: true,
              source_type: true,
              created_at: true,
            },
          })
          if (!memory) throw new Error('Memory not found')
          return memory
        },
      },
      {
        name: 'list_todos',
        description: 'List Cognia todos for the Slack user, or all org todos for admins.',
        mutating: false,
        inputSchema: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: VALID_TODO_STATUSES },
            due_before: { type: 'string' },
            due_after: { type: 'string' },
            all_members: { type: 'boolean' },
            limit: { type: 'integer', minimum: 1, maximum: 20 },
          },
        },
        execute: async (ctx, args) => {
          const actorUserId = await this.requireActor(ctx)
          const allMembers = booleanArg(args, 'all_members')
          if (allMembers) await this.requireOrgAdmin(actorUserId, ctx.organizationId)
          const status = todoStatusArg(args, 'status')
          const dueBefore = optionalDateArg(args, 'due_before')
          const dueAfter = optionalDateArg(args, 'due_after')
          const limit = Math.min(Math.max(Math.floor(numberArg(args, 'limit', 10)), 1), 20)
          const where: Prisma.MemoryTodoWhereInput = {
            organization_id: ctx.organizationId,
            ...(allMembers ? {} : { user_id: actorUserId }),
            ...(status ? { status } : {}),
            ...(dueBefore || dueAfter
              ? {
                  due_at: {
                    ...(dueBefore ? { lte: dueBefore } : {}),
                    ...(dueAfter ? { gte: dueAfter } : {}),
                  },
                }
              : {}),
          }
          return prisma.memoryTodo.findMany({
            where,
            orderBy: [{ due_at: 'asc' }, { created_at: 'desc' }],
            take: limit,
            include: { memory: { select: { id: true, title: true, url: true } } },
          })
        },
      },
      {
        name: 'update_todo',
        description: 'Update a Cognia todo status, due date, snooze date, title, or description.',
        mutating: true,
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            status: { type: 'string', enum: VALID_TODO_STATUSES },
            due_at: { type: 'string' },
            snoozed_until: { type: 'string' },
            title: { type: 'string' },
            description: { type: 'string' },
          },
          required: ['id'],
        },
        execute: async (ctx, args) => {
          const actorUserId = await this.requireActor(ctx)
          const todo = await this.getTodoInOrg(requireString(args, 'id'), ctx.organizationId)
          if (todo.user_id !== actorUserId)
            await this.requireOrgAdmin(actorUserId, ctx.organizationId)
          const data: Prisma.MemoryTodoUpdateInput = {}
          const status = todoStatusArg(args, 'status')
          if (status) {
            data.status = status
            data.completed_at =
              status === 'DONE' ? new Date() : status === 'PENDING' ? null : undefined
          }
          if ('due_at' in args) data.due_at = optionalDateArg(args, 'due_at') ?? null
          if ('snoozed_until' in args)
            data.snoozed_until = optionalDateArg(args, 'snoozed_until') ?? null
          const title = stringArg(args, 'title')
          if (title) data.title = title.slice(0, 240)
          if ('description' in args) data.description = stringArg(args, 'description') ?? null
          return prisma.memoryTodo.update({ where: { id: todo.id }, data })
        },
      },
      {
        name: 'delete_todo',
        description: 'Dismiss a Cognia todo.',
        mutating: true,
        inputSchema: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id'],
        },
        execute: async (ctx, args) => {
          const actorUserId = await this.requireActor(ctx)
          const todo = await this.getTodoInOrg(requireString(args, 'id'), ctx.organizationId)
          if (todo.user_id !== actorUserId)
            await this.requireOrgAdmin(actorUserId, ctx.organizationId)
          return prisma.memoryTodo.update({
            where: { id: todo.id },
            data: { status: 'DISMISSED' },
          })
        },
      },
      {
        name: 'add_todo_to_calendar',
        description: 'Add an existing Cognia todo to the Slack user’s connected Google Calendar.',
        mutating: true,
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            duration_minutes: { type: 'integer' },
            attendees: { type: 'array', items: { type: 'string' } },
            description: { type: 'string' },
            time_zone: { type: 'string' },
          },
          required: ['id'],
        },
        execute: async (ctx, args) => {
          const actorUserId = await this.requireActor(ctx)
          const todo = await this.getTodoInOrg(requireString(args, 'id'), ctx.organizationId)
          if (todo.user_id !== actorUserId)
            await this.requireOrgAdmin(actorUserId, ctx.organizationId)
          if (!googleCalendarService.isCalendarConfigured()) {
            throw new Error('Google Calendar is not configured.')
          }
          const durationMinutes = Math.min(
            Math.max(Math.floor(numberArg(args, 'duration_minutes', 30)), 1),
            60 * 24
          )
          const start = todo.due_at ?? new Date(Date.now() + 60 * 60 * 1000)
          const end = new Date(start.getTime() + durationMinutes * 60 * 1000)
          const result = await googleCalendarService.createEvent(actorUserId, {
            summary: todo.title,
            description: stringArg(args, 'description') ?? todo.description ?? undefined,
            start,
            end,
            attendees: optionalStringArray(args, 'attendees'),
            timeZone: stringArg(args, 'time_zone'),
          })
          await prisma.memoryTodo.update({
            where: { id: todo.id },
            data: { calendar_event_id: result.eventId, calendar_provider: 'google' },
          })
          return result
        },
      },
      {
        name: 'list_saved_searches',
        description: 'List saved searches for the Slack user in this organization.',
        mutating: false,
        inputSchema: { type: 'object', properties: {} },
        execute: async ctx => listSavedSearches(await this.requireActor(ctx), ctx.organizationId),
      },
      {
        name: 'create_saved_search',
        description: 'Create a saved organization search for the Slack user.',
        mutating: true,
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            query: { type: 'string' },
            alert_enabled: { type: 'boolean' },
            alert_frequency: { type: 'string', enum: ['realtime', 'daily', 'weekly'] },
          },
          required: ['name', 'query'],
        },
        execute: async (ctx, args) =>
          createSavedSearch({
            userId: await this.requireActor(ctx),
            organizationId: ctx.organizationId,
            name: requireString(args, 'name'),
            query: requireString(args, 'query'),
            alertEnabled: booleanArg(args, 'alert_enabled'),
            alertFrequency:
              (stringArg(args, 'alert_frequency') as 'realtime' | 'daily' | 'weekly') ?? 'daily',
          }),
      },
      {
        name: 'update_saved_search',
        description: 'Update a saved search owned by the Slack user.',
        mutating: true,
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            query: { type: 'string' },
            alert_enabled: { type: 'boolean' },
            alert_frequency: { type: 'string', enum: ['realtime', 'daily', 'weekly'] },
          },
          required: ['id'],
        },
        execute: async (ctx, args) =>
          updateSavedSearch(requireString(args, 'id'), await this.requireActor(ctx), {
            name: stringArg(args, 'name'),
            query: stringArg(args, 'query'),
            alertEnabled: 'alert_enabled' in args ? booleanArg(args, 'alert_enabled') : undefined,
            alertFrequency: stringArg(args, 'alert_frequency'),
          }),
      },
      {
        name: 'delete_saved_search',
        description: 'Delete a saved search owned by the Slack user.',
        mutating: true,
        inputSchema: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id'],
        },
        execute: async (ctx, args) =>
          deleteSavedSearch(requireString(args, 'id'), await this.requireActor(ctx)),
      },
      {
        name: 'list_memory_shares',
        description: 'List active shares for a memory owned by the Slack user.',
        mutating: false,
        inputSchema: {
          type: 'object',
          properties: { memory_id: { type: 'string' } },
          required: ['memory_id'],
        },
        execute: async (ctx, args) =>
          listSharesForMemory(requireString(args, 'memory_id'), await this.requireActor(ctx)),
      },
      {
        name: 'create_memory_share',
        description: 'Create an org or link share for a memory owned by the Slack user.',
        mutating: true,
        inputSchema: {
          type: 'object',
          properties: {
            memory_id: { type: 'string' },
            recipient_type: { type: 'string', enum: ['ORG', 'LINK'] },
            recipient_org_id: { type: 'string' },
            permission: { type: 'string', enum: ['READ', 'COMMENT'] },
            expires_at: { type: 'string' },
          },
          required: ['memory_id', 'recipient_type'],
        },
        execute: async (ctx, args) => {
          const recipientType = requireString(args, 'recipient_type')
          if (recipientType !== 'ORG' && recipientType !== 'LINK') {
            throw new Error('recipient_type must be ORG or LINK')
          }
          const permission = stringArg(args, 'permission')
          if (permission && permission !== 'READ' && permission !== 'COMMENT') {
            throw new Error('permission must be READ or COMMENT')
          }
          return createShare({
            memoryId: requireString(args, 'memory_id'),
            sharerUserId: await this.requireActor(ctx),
            recipientType,
            recipientOrgId:
              recipientType === 'ORG'
                ? (stringArg(args, 'recipient_org_id') ?? ctx.organizationId)
                : undefined,
            permission: permission as 'READ' | 'COMMENT' | undefined,
            expiresAt: optionalDateArg(args, 'expires_at'),
          })
        },
      },
      {
        name: 'revoke_memory_share',
        description: 'Revoke a memory share owned by the Slack user.',
        mutating: true,
        inputSchema: {
          type: 'object',
          properties: { share_id: { type: 'string' } },
          required: ['share_id'],
        },
        execute: async (ctx, args) => {
          await revokeShare(requireString(args, 'share_id'), await this.requireActor(ctx))
          return { revoked: true }
        },
      },
      {
        name: 'list_comments',
        description: 'List comments on a readable memory.',
        mutating: false,
        inputSchema: {
          type: 'object',
          properties: { memory_id: { type: 'string' } },
          required: ['memory_id'],
        },
        execute: async (ctx, args) =>
          listComments(requireString(args, 'memory_id'), await this.requireActor(ctx)),
      },
      {
        name: 'create_comment',
        description: 'Post a comment on a readable memory as the Slack user.',
        mutating: true,
        inputSchema: {
          type: 'object',
          properties: {
            memory_id: { type: 'string' },
            body_md: { type: 'string' },
            parent_id: { type: 'string' },
          },
          required: ['memory_id', 'body_md'],
        },
        execute: async (ctx, args) =>
          postComment({
            memoryId: requireString(args, 'memory_id'),
            authorUserId: await this.requireActor(ctx),
            bodyMd: requireString(args, 'body_md'),
            parentId: stringArg(args, 'parent_id'),
          }),
      },
      {
        name: 'update_comment',
        description: 'Edit a comment authored by the Slack user.',
        mutating: true,
        inputSchema: {
          type: 'object',
          properties: {
            comment_id: { type: 'string' },
            body_md: { type: 'string' },
          },
          required: ['comment_id', 'body_md'],
        },
        execute: async (ctx, args) =>
          editComment(
            requireString(args, 'comment_id'),
            await this.requireActor(ctx),
            requireString(args, 'body_md')
          ),
      },
      {
        name: 'delete_comment',
        description: 'Delete a comment authored by the Slack user.',
        mutating: true,
        inputSchema: {
          type: 'object',
          properties: { comment_id: { type: 'string' } },
          required: ['comment_id'],
        },
        execute: async (ctx, args) => {
          await deleteComment(requireString(args, 'comment_id'), await this.requireActor(ctx))
          return { deleted: true }
        },
      },
    ]
  }

  private async requireActor(ctx: SlackToolExecutionContext): Promise<string> {
    if (!ctx.actorUserId) {
      throw new Error(
        'This tool requires your Slack email to match an active Cognia organization member.'
      )
    }
    const isMember = await organizationAccessService.isMember(ctx.actorUserId, ctx.organizationId)
    if (!isMember) throw new Error('Not a member of this organization')
    return ctx.actorUserId
  }

  private async requireOrgAdmin(userId: string, organizationId: string): Promise<void> {
    const member = await prisma.organizationMember.findFirst({
      where: { user_id: userId, organization_id: organizationId, deactivated_at: null },
      select: { role: true },
    })
    if (member?.role !== 'ADMIN') throw new Error('Organization admin access required')
  }

  private async getTodoInOrg(id: string, organizationId: string) {
    const todo = await prisma.memoryTodo.findFirst({
      where: { id, organization_id: organizationId },
    })
    if (!todo) throw new Error('Todo not found')
    return todo
  }
}

export const slackAgentToolRegistry = new SlackAgentToolRegistryService()
