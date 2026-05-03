import { MemoryTodo } from '@prisma/client'
import { prisma } from '../../lib/prisma.lib'
import { generationProviderService } from '../ai/generation-provider.service'
import { logger } from '../../utils/core/logger.util'

/**
 * TODO / upcoming-event extractor.
 *
 * Reads a captured Memory's content + page_metadata, asks the LLM for any
 * action items or scheduled events, and persists them as MemoryTodo rows
 * scoped to the memory's (user, organization, workspace).
 *
 * Conservative: we only want real to-dos and calendarable events. We do not
 * want UI imperatives ("click here", "subscribe") or vague advice.
 *
 * Idempotent: if rows already exist for this memory_id, extraction is
 * skipped. Re-extraction would be a separate explicit endpoint.
 */

interface RawExtractedTodo {
  title?: unknown
  dueAt?: unknown
  due_at?: unknown
  description?: unknown
  excerpt?: unknown
  source_excerpt?: unknown
}

export interface ExtractedTodo {
  title: string
  dueAt: Date | null
  description: string | null
  sourceExcerpt: string | null
}

const MAX_CONTENT_CHARS = 8000
const MAX_TODOS_PER_MEMORY = 20
const MAX_TITLE_LENGTH = 240
const MAX_DESCRIPTION_LENGTH = 1200
const MAX_EXCERPT_LENGTH = 500

export const TODO_EXTRACTION_PROMPT_TEMPLATE = `You are an assistant that extracts ACTIONABLE TODOs and SCHEDULED EVENTS from a captured document.

Extract ONLY items that look like real action items, deadlines, meetings, follow-ups, or deliverables.

INCLUDE examples:
- "Review draft by Friday" -> { "title": "Review draft", "dueAt": "<next Friday ISO>" }
- "Polaris GA April 30" -> { "title": "Polaris GA", "dueAt": "2025-04-30" }
- "Sarah will publish the postmortem next week" -> { "title": "Publish postmortem (Sarah)", "dueAt": null }
- "Meeting with Acme on May 12 at 3pm" -> { "title": "Meeting with Acme", "dueAt": "2025-05-12T15:00:00" }
- "Send proposal to client by EOD Tuesday"

EXCLUDE:
- UI text: "click here", "subscribe", "press tab", "see more"
- Generic advice or aphorisms
- Past events with no follow-up implication
- Marketing copy, calls-to-action, navigation labels
- Items mentioned only as historical context

Today's date is {{TODAY_ISO}}.

Output STRICT JSON ONLY (no prose, no markdown fences). The shape must be:
{ "todos": [ { "title": string, "dueAt": string|null, "description": string|null, "excerpt": string|null } ] }

- title: short imperative phrase, <= 240 chars
- dueAt: ISO 8601 date or datetime if a clear date is referenced, otherwise null
- description: optional one-line context (who/what/why), null if obvious
- excerpt: the original sentence(s) from the source the item was drawn from, null if synthesized

Return AT MOST 10 items. If nothing qualifies, return { "todos": [] }.

Source title: {{TITLE}}
Source URL: {{URL}}

--- BEGIN CONTENT ---
{{CONTENT}}
--- END CONTENT ---`

function buildPrompt(args: {
  title: string | null | undefined
  url: string | null | undefined
  content: string
}): string {
  const today = new Date().toISOString().slice(0, 10)
  const truncated = args.content.length > MAX_CONTENT_CHARS
    ? `${args.content.slice(0, MAX_CONTENT_CHARS)}\n[truncated]`
    : args.content
  return TODO_EXTRACTION_PROMPT_TEMPLATE
    .replace('{{TODAY_ISO}}', today)
    .replace('{{TITLE}}', args.title || '(none)')
    .replace('{{URL}}', args.url || '(none)')
    .replace('{{CONTENT}}', truncated)
}

function stripCodeFences(raw: string): string {
  const trimmed = raw.trim()
  if (trimmed.startsWith('```')) {
    return trimmed.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
  }
  return trimmed
}

function extractFirstJsonObject(text: string): string | null {
  const cleaned = stripCodeFences(text)
  // Try direct parse first
  try {
    JSON.parse(cleaned)
    return cleaned
  } catch {
    // fall through
  }
  // Find first balanced { ... } block
  const start = cleaned.indexOf('{')
  if (start < 0) return null
  let depth = 0
  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i]
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) {
        return cleaned.slice(start, i + 1)
      }
    }
  }
  return null
}

function coerceString(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed
}

function coerceDate(value: unknown): Date | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) return null
  // Sanity: don't accept obvious garbage (year < 2000 or > 2100)
  const year = parsed.getUTCFullYear()
  if (year < 2000 || year > 2100) return null
  return parsed
}

function validateAndNormalize(raw: unknown): ExtractedTodo[] {
  if (!raw || typeof raw !== 'object') return []
  const obj = raw as { todos?: unknown }
  const list = Array.isArray(obj.todos) ? obj.todos : []
  const out: ExtractedTodo[] = []
  for (const item of list) {
    if (!item || typeof item !== 'object') continue
    const r = item as RawExtractedTodo
    const title = coerceString(r.title, MAX_TITLE_LENGTH)
    if (!title) continue
    const due = coerceDate(r.dueAt ?? r.due_at)
    const description = coerceString(r.description, MAX_DESCRIPTION_LENGTH)
    const excerpt = coerceString(r.source_excerpt ?? r.excerpt, MAX_EXCERPT_LENGTH)
    out.push({
      title,
      dueAt: due,
      description,
      sourceExcerpt: excerpt,
    })
    if (out.length >= MAX_TODOS_PER_MEMORY) break
  }
  return out
}

async function callLlm(prompt: string, userId: string): Promise<string> {
  return generationProviderService.generateContent(prompt, false, userId)
}

/**
 * Extract TODOs from the given memory and persist them.
 *
 * Idempotent: returns [] (without re-calling the LLM) if rows already exist
 * for this memory_id. Returns [] if the memory is not org-scoped (defensive).
 */
export async function extractTodosFromMemory(memoryId: string): Promise<MemoryTodo[]> {
  const memory = await prisma.memory.findUnique({
    where: { id: memoryId },
    select: {
      id: true,
      user_id: true,
      organization_id: true,
      workspace_id: true,
      title: true,
      url: true,
      content: true,
      full_content: true,
      page_metadata: true,
    },
  })
  if (!memory) {
    logger.warn('[todo-extractor] memory not found', { memoryId })
    return []
  }
  if (!memory.organization_id) {
    // Personal-mode memories are out of scope for the org Upcoming surface.
    return []
  }

  // Idempotency: skip if any todos already exist for this memory.
  const existing = await prisma.memoryTodo.findFirst({
    where: { memory_id: memoryId },
    select: { id: true },
  })
  if (existing) {
    return []
  }

  const content = (memory.full_content || memory.content || '').trim()
  if (content.length < 80) {
    // Not enough signal to bother extracting.
    return []
  }

  const prompt = buildPrompt({
    title: memory.title,
    url: memory.url,
    content,
  })

  let llmText: string
  try {
    llmText = await callLlm(prompt, memory.user_id)
  } catch (err) {
    logger.warn('[todo-extractor] LLM call failed', {
      memoryId,
      error: err instanceof Error ? err.message : String(err),
    })
    return []
  }

  const jsonBlock = extractFirstJsonObject(llmText)
  if (!jsonBlock) {
    logger.warn('[todo-extractor] LLM returned non-JSON', {
      memoryId,
      preview: llmText.slice(0, 200),
    })
    return []
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(jsonBlock)
  } catch (err) {
    logger.warn('[todo-extractor] JSON parse failed', {
      memoryId,
      error: err instanceof Error ? err.message : String(err),
    })
    return []
  }

  const items = validateAndNormalize(parsed)
  if (items.length === 0) {
    return []
  }

  const created = await prisma.$transaction(
    items.map(item =>
      prisma.memoryTodo.create({
        data: {
          memory_id: memory.id,
          user_id: memory.user_id,
          organization_id: memory.organization_id!,
          workspace_id: memory.workspace_id ?? null,
          title: item.title,
          description: item.description,
          source_excerpt: item.sourceExcerpt,
          due_at: item.dueAt,
        },
      })
    )
  )

  logger.log('[todo-extractor] extracted todos', {
    memoryId,
    count: created.length,
  })

  return created
}

export const todoExtractorService = {
  extractTodosFromMemory,
}
