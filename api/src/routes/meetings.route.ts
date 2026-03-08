import { Router, Response } from 'express'
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.middleware'
import { meetingService } from '../services/meeting/meeting.service'

const router = Router()
const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback

/**
 * POST /api/meetings/join
 * Submit a meeting URL → validate, detect platform, create record, enqueue bot job
 */
router.post('/join', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { meetingUrl, title, organizationId } = req.body
    const normalizedMeetingUrl = typeof meetingUrl === 'string' ? meetingUrl.trim() : ''

    if (!normalizedMeetingUrl) {
      return res.status(400).json({ success: false, error: 'meetingUrl is required' })
    }

    if (!meetingService.validateMeetingUrl(normalizedMeetingUrl)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid meeting URL. Only Google Meet and Zoom are supported.',
      })
    }

    const meeting = await meetingService.startMeeting({
      userId: req.user!.id,
      meetingUrl: normalizedMeetingUrl,
      title,
      organizationId,
    })

    res.status(201).json({ success: true, data: meeting })
  } catch (error) {
    const message = getErrorMessage(error, 'Failed to join meeting')
    const status =
      message.includes('Meeting system unavailable') || message.includes('Meeting bot unavailable')
        ? 503
        : 500
    res
      .status(status)
      .json({ success: false, error: message })
  }
})

/**
 * GET /api/meetings
 * List user's meetings
 */
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 100)
    const offset = Number(req.query.offset) || 0

    const result = await meetingService.listMeetings(req.user!.id, limit, offset)

    res.json({ success: true, data: result })
  } catch (error) {
    res
      .status(500)
      .json({ success: false, error: getErrorMessage(error, 'Failed to list meetings') })
  }
})

/**
 * GET /api/meetings/:id
 * Get meeting details + transcript + processed notes
 */
router.get('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const meeting = await meetingService.getMeeting(req.params.id, req.user!.id)

    res.json({ success: true, data: meeting })
  } catch (error) {
    const status = (error as Error).message === 'Meeting not found' ? 404 : 500
    res
      .status(status)
      .json({ success: false, error: getErrorMessage(error, 'Failed to get meeting') })
  }
})

/**
 * DELETE /api/meetings/:id/stop
 * Stop an active meeting session
 */
router.delete('/:id/stop', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await meetingService.stopMeeting(req.params.id, req.user!.id)

    res.json({ success: true, message: 'Meeting stopped' })
  } catch (error) {
    const msg = (error as Error).message
    const status = msg === 'Meeting not found' ? 404 : msg === 'Meeting already ended' ? 400 : 500
    res
      .status(status)
      .json({ success: false, error: getErrorMessage(error, 'Failed to stop meeting') })
  }
})

export default router
