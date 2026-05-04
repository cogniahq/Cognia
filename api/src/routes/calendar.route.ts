import { Router, Response } from 'express'
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.middleware'
import { googleCalendarService } from '../services/calendar/google-calendar.service'
import { createOAuthState, parseOAuthState } from '../utils/auth/oauth-state.util'
import { logger } from '../utils/core/logger.util'

const router = Router()

const CALENDAR_PROVIDER = 'google_calendar'

/**
 * GET /api/calendar/auth/url
 * Returns the consent-screen URL the client should redirect the user to.
 */
router.get('/auth/url', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) return res.status(401).json({ message: 'Unauthorized' })
    if (!googleCalendarService.isCalendarConfigured()) {
      return res.status(503).json({
        success: false,
        message:
          'Google Calendar is not configured on this server. Set GOOGLE_CALENDAR_CLIENT_ID and GOOGLE_CALENDAR_CLIENT_SECRET.',
        code: 'CALENDAR_NOT_CONFIGURED',
      })
    }
    const state = createOAuthState({
      integrationType: 'user',
      userId: req.user.id,
      provider: CALENDAR_PROVIDER,
      timestamp: Date.now(),
    })
    const url = googleCalendarService.getAuthUrl(state)
    res.json({ success: true, data: { url } })
  } catch (err) {
    logger.error('[calendar] auth url failed', err)
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Failed to build auth URL',
    })
  }
})

/**
 * GET /api/calendar/auth/callback?code=...&state=...
 * No auth required: the signed `state` blob carries the user id.
 */
router.get('/auth/callback', async (req, res) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
  const redirect = (params: Record<string, string>) => {
    const qs = new URLSearchParams(params).toString()
    return res.redirect(`${frontendUrl}/integrations?${qs}`)
  }
  try {
    if (!googleCalendarService.isCalendarConfigured()) {
      return redirect({ calendar: 'unconfigured' })
    }
    const code = (req.query.code as string | undefined) || ''
    const state = (req.query.state as string | undefined) || ''
    const oauthError = req.query.error as string | undefined
    if (oauthError) {
      return redirect({ calendar: 'error', reason: oauthError })
    }
    if (!code || !state) {
      return redirect({ calendar: 'error', reason: 'missing_code_or_state' })
    }

    let payload
    try {
      payload = parseOAuthState(state)
    } catch (err) {
      return redirect({
        calendar: 'error',
        reason: err instanceof Error ? err.message : 'invalid_state',
      })
    }
    if (payload.provider !== CALENDAR_PROVIDER) {
      return redirect({ calendar: 'error', reason: 'wrong_provider' })
    }

    await googleCalendarService.handleCallback({ code, userId: payload.userId })
    return redirect({ calendar: 'connected' })
  } catch (err) {
    logger.error('[calendar] callback failed', err)
    return redirect({
      calendar: 'error',
      reason: err instanceof Error ? err.message : 'callback_failed',
    })
  }
})

/**
 * GET /api/calendar/status
 */
router.get('/status', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) return res.status(401).json({ message: 'Unauthorized' })
    const status = await googleCalendarService.getConnectionStatus(req.user.id)
    res.json({ success: true, data: status })
  } catch (err) {
    logger.error('[calendar] status failed', err)
    res.status(500).json({ success: false, message: 'Failed to load calendar status' })
  }
})

/**
 * DELETE /api/calendar/disconnect
 */
router.delete(
  '/disconnect',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user?.id) return res.status(401).json({ message: 'Unauthorized' })
      await googleCalendarService.disconnect(req.user.id)
      res.json({ success: true })
    } catch (err) {
      logger.error('[calendar] disconnect failed', err)
      res.status(500).json({ success: false, message: 'Failed to disconnect calendar' })
    }
  }
)

export default router
