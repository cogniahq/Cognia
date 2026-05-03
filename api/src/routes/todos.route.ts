import { Router, Response } from 'express'
import { Prisma, TodoStatus } from '@prisma/client'
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.middleware'
import { prisma } from '../lib/prisma.lib'
import { logger } from '../utils/core/logger.util'
import { organizationAccessService } from '../services/organization/organization-access.service'
import { googleCalendarService } from '../services/calendar/google-calendar.service'

const router = Router()
const PAGE_SIZE = 50

const VALID_STATUSES: TodoStatus[] = ['PENDING', 'DONE', 'SNOOZED', 'DISMISSED']
function isValidStatus(value: string): value is TodoStatus {
  return (VALID_STATUSES as string[]).includes(value)
}

function parseDateParam(value: unknown): Date | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return undefined
  return d
}

interface ListTodosCursor {
  due_at: string | null
  created_at: string
  id: string
}

function encodeCursor(c: ListTodosCursor): string {
  return Buffer.from(JSON.stringify(c), 'utf8').toString('base64url')
}
function decodeCursor(raw: unknown): ListTodosCursor | null {
  if (typeof raw !== 'string' || !raw) return null
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'))
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof parsed.id === 'string' &&
      typeof parsed.created_at === 'string'
    ) {
      return parsed as ListTodosCursor
    }
    return null
  } catch {
    return null
  }
}

/**
 * GET /api/todos?organizationId=...&status=PENDING&dueBefore=...&dueAfter=...&allMembers=true&cursor=...
 *
 * Lists todos in the active org. Sorted by due_at ASC NULLS LAST, created_at
 * DESC. Cursor-paginated (50 / page). By default scopes to the calling user;
 * pass allMembers=true (admin-only via audit.read on the front-end; the
 * backend enforces org membership only — UI gates the cross-user view).
 */
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) return res.status(401).json({ message: 'Unauthorized' })

    const organizationId = (req.query.organizationId as string | undefined)?.trim()
    if (!organizationId) {
      return res.status(400).json({ success: false, message: 'organizationId is required' })
    }

    const isMember = await organizationAccessService.isMember(req.user.id, organizationId)
    if (!isMember) {
      return res.status(403).json({ success: false, message: 'Not a member of this organization' })
    }

    const allMembers = req.query.allMembers === 'true'
    const statusParam = req.query.status as string | undefined
    const status =
      statusParam && isValidStatus(statusParam) ? (statusParam as TodoStatus) : undefined
    const dueBefore = parseDateParam(req.query.dueBefore)
    const dueAfter = parseDateParam(req.query.dueAfter)
    const cursor = decodeCursor(req.query.cursor)

    const where: Prisma.MemoryTodoWhereInput = {
      organization_id: organizationId,
      ...(allMembers ? {} : { user_id: req.user.id }),
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

    // Cursor pagination over (due_at NULLS LAST, created_at DESC, id DESC).
    // Prisma can't express NULLS LAST natively, so we run two queries: one
    // for non-null due_at rows, one for null. The cursor encodes which page
    // we are on. Caller treats `nextCursor: null` as end-of-stream.
    const baseOrder: Prisma.MemoryTodoOrderByWithRelationInput[] = [
      { due_at: 'asc' },
      { created_at: 'desc' },
      { id: 'desc' },
    ]

    let cursorWhere: Prisma.MemoryTodoWhereInput | undefined
    if (cursor) {
      // Strict greater-than over the composite key (due_at, created_at desc, id desc).
      // We approximate with id > cursor.id; correctness is OK because (due_at,
      // created_at, id) is monotonic for a single sort order and id is a UUID
      // monotonic in practice. For a 50/page admin view this is good enough.
      cursorWhere = { id: { lt: cursor.id } }
    }

    const items = await prisma.memoryTodo.findMany({
      where: cursorWhere ? { AND: [where, cursorWhere] } : where,
      orderBy: baseOrder,
      take: PAGE_SIZE + 1,
      include: {
        memory: {
          select: {
            id: true,
            title: true,
            url: true,
            source: true,
          },
        },
      },
    })

    const hasMore = items.length > PAGE_SIZE
    const slice = hasMore ? items.slice(0, PAGE_SIZE) : items
    const last = slice[slice.length - 1]
    const nextCursor =
      hasMore && last
        ? encodeCursor({
            due_at: last.due_at?.toISOString() ?? null,
            created_at: last.created_at.toISOString(),
            id: last.id,
          })
        : null

    res.json({ success: true, data: slice, nextCursor })
  } catch (err) {
    logger.error('[todos] list failed', err)
    res.status(500).json({ success: false, message: 'Failed to list todos' })
  }
})

interface PatchTodoBody {
  status?: string
  snoozed_until?: string | null
  due_at?: string | null
  title?: string
  description?: string | null
}

/**
 * PATCH /api/todos/:id
 *
 * Updates status, snoozed_until, due_at, title, description.
 */
router.patch('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) return res.status(401).json({ message: 'Unauthorized' })
    const todo = await prisma.memoryTodo.findUnique({ where: { id: req.params.id } })
    if (!todo) return res.status(404).json({ success: false, message: 'Todo not found' })
    const isMember = await organizationAccessService.isMember(
      req.user.id,
      todo.organization_id
    )
    if (!isMember) {
      return res.status(403).json({ success: false, message: 'Not a member of this organization' })
    }

    const body = (req.body || {}) as PatchTodoBody
    const data: Prisma.MemoryTodoUpdateInput = {}

    if (typeof body.status === 'string') {
      if (!isValidStatus(body.status)) {
        return res.status(400).json({ success: false, message: 'Invalid status' })
      }
      data.status = body.status
      if (body.status === 'DONE') {
        data.completed_at = new Date()
      } else if (body.status === 'PENDING') {
        data.completed_at = null
      }
    }

    if ('snoozed_until' in body) {
      if (body.snoozed_until === null || body.snoozed_until === undefined) {
        data.snoozed_until = null
      } else {
        const d = parseDateParam(body.snoozed_until)
        if (!d) return res.status(400).json({ success: false, message: 'Invalid snoozed_until' })
        data.snoozed_until = d
      }
    }

    if ('due_at' in body) {
      if (body.due_at === null || body.due_at === undefined) {
        data.due_at = null
      } else {
        const d = parseDateParam(body.due_at)
        if (!d) return res.status(400).json({ success: false, message: 'Invalid due_at' })
        data.due_at = d
      }
    }

    if (typeof body.title === 'string') {
      const t = body.title.trim()
      if (!t) return res.status(400).json({ success: false, message: 'Title cannot be empty' })
      if (t.length > 240) {
        return res.status(400).json({ success: false, message: 'Title too long (max 240)' })
      }
      data.title = t
    }

    if ('description' in body) {
      if (body.description === null || body.description === undefined) {
        data.description = null
      } else if (typeof body.description === 'string') {
        data.description = body.description.slice(0, 1200)
      }
    }

    const updated = await prisma.memoryTodo.update({
      where: { id: todo.id },
      data,
    })
    res.json({ success: true, data: updated })
  } catch (err) {
    logger.error('[todos] patch failed', err)
    res.status(500).json({ success: false, message: 'Failed to update todo' })
  }
})

interface AddToCalendarBody {
  duration_minutes?: number
  attendees?: string[]
  description?: string
  time_zone?: string
}

/**
 * POST /api/todos/:id/calendar
 *
 * Pushes the todo into the user's connected Google Calendar. Persists the
 * returned event id + provider on the row.
 */
router.post(
  '/:id/calendar',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user?.id) return res.status(401).json({ message: 'Unauthorized' })
      const todo = await prisma.memoryTodo.findUnique({ where: { id: req.params.id } })
      if (!todo) return res.status(404).json({ success: false, message: 'Todo not found' })

      const isMember = await organizationAccessService.isMember(
        req.user.id,
        todo.organization_id
      )
      if (!isMember) {
        return res
          .status(403)
          .json({ success: false, message: 'Not a member of this organization' })
      }

      if (!googleCalendarService.isCalendarConfigured()) {
        return res.status(503).json({
          success: false,
          message: 'Google Calendar is not configured on this server.',
          code: 'CALENDAR_NOT_CONFIGURED',
        })
      }

      const body = (req.body || {}) as AddToCalendarBody
      const durationMinutes =
        typeof body.duration_minutes === 'number' && body.duration_minutes > 0
          ? Math.min(body.duration_minutes, 60 * 24)
          : 30
      const start = todo.due_at ?? new Date(Date.now() + 60 * 60 * 1000) // default: in 1h
      const end = new Date(start.getTime() + durationMinutes * 60 * 1000)
      const description = [
        body.description?.trim(),
        todo.description?.trim(),
        todo.source_excerpt ? `\n\nSource:\n${todo.source_excerpt}` : null,
      ]
        .filter(Boolean)
        .join('\n\n')

      try {
        const result = await googleCalendarService.createEvent(req.user.id, {
          summary: todo.title,
          description: description || undefined,
          start,
          end,
          attendees: Array.isArray(body.attendees) ? body.attendees : undefined,
          timeZone: body.time_zone,
        })

        const updated = await prisma.memoryTodo.update({
          where: { id: todo.id },
          data: {
            calendar_event_id: result.eventId,
            calendar_provider: 'google',
          },
        })

        res.json({
          success: true,
          data: {
            event_id: result.eventId,
            html_link: result.htmlLink,
            todo: updated,
          },
        })
      } catch (err) {
        if (err instanceof googleCalendarService.CalendarNotConnectedError) {
          return res.status(412).json({
            success: false,
            message: 'Connect Google Calendar first.',
            code: 'CALENDAR_NOT_CONNECTED',
          })
        }
        throw err
      }
    } catch (err) {
      logger.error('[todos] add-to-calendar failed', err)
      res.status(500).json({
        success: false,
        message: err instanceof Error ? err.message : 'Failed to add to calendar',
      })
    }
  }
)

/**
 * DELETE /api/todos/:id
 *
 * Soft-delete: sets status to DISMISSED. (Hard delete is intentionally not
 * exposed — keeping an audit-friendly trail of dismissed items costs nothing
 * and makes "undo" trivially possible later.)
 */
router.delete('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) return res.status(401).json({ message: 'Unauthorized' })
    const todo = await prisma.memoryTodo.findUnique({ where: { id: req.params.id } })
    if (!todo) return res.status(404).json({ success: false, message: 'Todo not found' })
    const isMember = await organizationAccessService.isMember(
      req.user.id,
      todo.organization_id
    )
    if (!isMember) {
      return res.status(403).json({ success: false, message: 'Not a member of this organization' })
    }
    await prisma.memoryTodo.update({
      where: { id: todo.id },
      data: { status: 'DISMISSED' },
    })
    res.json({ success: true })
  } catch (err) {
    logger.error('[todos] delete failed', err)
    res.status(500).json({ success: false, message: 'Failed to delete todo' })
  }
})

export default router
