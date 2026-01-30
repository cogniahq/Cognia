import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma.lib'
import { setAuthCookie, clearAuthCookie } from '../utils/auth/auth-cookie.util'
import { generateToken } from '../utils/auth/jwt.util'
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.middleware'
import { hashPassword, comparePassword } from '../utils/core/password.util'
import { logger } from '../utils/core/logger.util'
import {
  loginRateLimiter,
  registerRateLimiter,
  extensionTokenRateLimiter,
} from '../middleware/rate-limit.middleware'

const router = Router()

// Get current user
router.get('/me', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  res.json({
    user: {
      id: req.user!.id,
      email: req.user!.email,
    },
  })
})

// Logout (clear session cookie)
router.post('/logout', (_req: Request, res: Response) => {
  clearAuthCookie(res)
  res.status(200).json({ message: 'Logged out successfully' })
})

// Register with email/password
router.post('/register', registerRateLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body || {}
    if (!email || !password) {
      return res.status(400).json({ message: 'email and password are required' })
    }

    const existing = await prisma.user.findFirst({ where: { email } })
    if (existing) {
      return res.status(409).json({ message: 'User already exists' })
    }

    const password_hash = await hashPassword(password)
    const user = await prisma.user.create({ data: { email, password_hash } })

    const token = generateToken({
      userId: user.id,
      email: user.email || undefined,
    })
    setAuthCookie(res, token)
    return res.status(201).json({
      message: 'Registered',
      token,
      user: { id: user.id, email: user.email },
    })
  } catch (error) {
    logger.error('Register error:', error)
    return res.status(500).json({ message: 'Failed to register' })
  }
})

// Login with email/password
router.post('/login', loginRateLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body || {}
    if (!email || !password) {
      return res.status(400).json({ message: 'email and password are required' })
    }

    const user = await prisma.user.findFirst({
      where: { email },
      select: { id: true, email: true, password_hash: true },
    })
    if (!user || !user.password_hash) {
      return res.status(401).json({ message: 'Invalid credentials' })
    }

    const ok = await comparePassword(password, user.password_hash)
    if (!ok) {
      return res.status(401).json({ message: 'Invalid credentials' })
    }

    const token = generateToken({
      userId: user.id,
      email: user.email || undefined,
    })
    setAuthCookie(res, token)
    return res.status(200).json({
      message: 'Logged in',
      token,
      user: { id: user.id, email: user.email },
    })
  } catch (error) {
    logger.error('Login error:', error)
    return res.status(500).json({ message: 'Failed to login' })
  }
})

// Demo endpoint to set the session cookie with a provided token/string
router.post('/session', (req: Request, res: Response) => {
  const { token } = req.body || {}
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ message: 'token is required' })
  }
  setAuthCookie(res, token)
  return res.status(200).json({ message: 'session set' })
})

// Clear the session cookie
router.delete('/session', (_req: Request, res: Response) => {
  clearAuthCookie(res)
  return res.status(200).json({ message: 'session cleared' })
})

// Get token for extension - requires authentication, only allows generating token for the authenticated user
router.post('/extension-token', extensionTokenRateLimiter, authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId } = req.body

    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ message: 'userId is required' })
    }

    // Security: Ensure the requested userId matches the authenticated user
    if (userId !== req.user!.id) {
      logger.warn(`Extension token attempt for different user: requested=${userId}, authenticated=${req.user!.id}`)
      return res.status(403).json({ message: 'Cannot generate token for another user' })
    }

    // Generate JWT token for the authenticated user
    const token = generateToken({
      userId: req.user!.id,
      email: req.user!.email,
    })

    res.status(200).json({
      message: 'Token generated successfully',
      token,
      user: {
        id: req.user!.id,
      },
    })
  } catch (error) {
    logger.error('Extension token error:', error)
    res.status(500).json({ message: 'Failed to generate token' })
  }
})

export default router
