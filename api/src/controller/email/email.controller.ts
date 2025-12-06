import { Response, NextFunction } from 'express'
import { AuthenticatedRequest } from '../../middleware/auth.middleware'
import AppError from '../../utils/http/app-error.util'
import { profileUpdateService } from '../../services/profile/profile-update.service'
import { aiProvider } from '../../services/ai/ai-provider.service'
import { logger } from '../../utils/core/logger.util'
import { searchMemories } from '../../services/memory/memory-search.service'

const MAX_THREAD_CHARS = 15000
const MAX_DRAFT_CHARS = 6000

type EmailDraftResult = {
  subject: string
  body: string
  summary?: string
}

const sanitizeText = (value: unknown, limit: number): string => {
  if (!value || typeof value !== 'string') {
    return ''
  }
  return value.slice(0, limit).trim()
}

export class EmailController {
  static async draftEmailReply(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return next(new AppError('User not authenticated', 401))
      }

      const userId = req.user.id

      // Support multiple field name variations (thread_text, thread, threadValue)
      const threadValue = req.body.thread_text || req.body.thread || req.body.threadValue
      // user_message is optional - if not provided, AI will generate based on thread context
      const userMessageValue =
        req.body.user_message || req.body.userMessage || req.body.user_message_value || ''

      // Validate required fields before sanitization
      if (!threadValue || typeof threadValue !== 'string' || !threadValue.trim()) {
        logger.warn('[email/draft] Missing or invalid thread', {
          userId,
          bodyKeys: Object.keys(req.body || {}),
          threadType: typeof req.body.thread,
          hasThread: !!req.body.thread,
          hasThreadText: !!req.body.thread_text,
          hasThreadValue: !!req.body.threadValue,
        })
        return next(
          new AppError('thread_text (or thread) is required and must be a non-empty string', 400)
        )
      }

      const thread = sanitizeText(threadValue, MAX_THREAD_CHARS)
      const userMessage = userMessageValue ? sanitizeText(userMessageValue, MAX_DRAFT_CHARS) : ''

      const profileContext = await profileUpdateService.getProfileContext(userId)

      const apiKeyId = req.apiKey?.memoryIsolation ? req.apiKey.id : undefined
      const searchQuery = userMessage ? `${thread} ${userMessage}` : thread
      const searchResults = await searchMemories({
        userId,
        apiKeyId,
        query: searchQuery,
        limit: 5,
        contextOnly: true,
      })

      const context = searchResults.context || ''

      const userMessageSection = userMessage
        ? `User's intended message:
${userMessage}

`
        : ''

      const prompt = `You are Cognia, an AI assistant helping draft email replies.

User Profile Context:
${profileContext}

Relevant Memories:
${context}

Email Thread:
${thread}

${userMessageSection}Draft a professional email reply that:
1. Responds appropriately to the thread
${userMessage ? "2. Incorporates the user's intended message naturally" : '2. Is contextually appropriate and helpful'}
3. Reflects the user's communication style from their profile
4. Uses relevant context from their memories when appropriate
5. Is concise and professional

Return ONLY a valid JSON object with this exact structure:
{
  "subject": "Re: [original subject or new subject]",
  "body": "The email body text",
  "summary": "Brief summary of what the email addresses"
}

CRITICAL: Return ONLY valid JSON. No explanations, no markdown, no code blocks.`

      const response = await aiProvider.generateContent(prompt, false, userId)
      let draft: EmailDraftResult

      try {
        const cleaned = response
          .replace(/```json\n?/g, '')
          .replace(/```\n?/g, '')
          .trim()
        draft = JSON.parse(cleaned) as EmailDraftResult
      } catch (parseError) {
        logger.warn('[email/draft] JSON parse failed, using fallback', {
          error: parseError instanceof Error ? parseError.message : String(parseError),
          response: response.slice(0, 200),
        })
        draft = {
          subject: `Re: ${thread.split('\n')[0] || 'Email'}`,
          body: response,
          summary: 'AI-generated email draft',
        }
      }

      res.status(200).json({
        success: true,
        data: draft,
      })
    } catch (error) {
      logger.error('[email/draft] Error drafting reply:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        userId: req.user?.id,
      })
      next(
        new AppError(
          `Failed to draft email reply: ${error instanceof Error ? error.message : String(error)}`,
          500
        )
      )
    }
  }
}
