import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma.lib'
import { setAuthCookie, clearAuthCookie } from '../utils/auth/auth-cookie.util'
import { generateToken } from '../utils/auth/jwt.util'
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.middleware'
import { hashPassword, comparePassword } from '../utils/core/password.util'
import { validatePassword, PasswordPolicy } from '../utils/auth/password-policy.util'
import {
  generateSecret,
  generateTOTPUri,
  verifyTOTP,
  generateBackupCodes,
  hashBackupCode,
  verifyBackupCode,
} from '../utils/auth/totp.util'
import { logger } from '../utils/core/logger.util'
import {
  loginRateLimiter,
  registerRateLimiter,
  extensionTokenRateLimiter,
} from '../middleware/rate-limit.middleware'

const router = Router()

// Get current user
router.get('/me', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { id: true, email: true, account_type: true, role: true },
    })

    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }

    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        account_type: user.account_type,
        role: user.role,
      },
    })
  } catch (error) {
    logger.error('Get me error:', error)
    return res.status(500).json({ message: 'Failed to get user' })
  }
})

// Logout (clear session cookie)
router.post('/logout', (_req: Request, res: Response) => {
  clearAuthCookie(res)
  res.status(200).json({ message: 'Logged out successfully' })
})

// Register with email/password
router.post('/register', registerRateLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password, account_type } = req.body || {}
    if (!email || !password) {
      return res.status(400).json({ message: 'email and password are required' })
    }

    if (!account_type || !['PERSONAL', 'ORGANIZATION'].includes(account_type)) {
      return res.status(400).json({ message: 'account_type must be PERSONAL or ORGANIZATION' })
    }

    // Validate password against standard policy for new registrations
    const passwordValidation = validatePassword(password, 'standard')
    if (!passwordValidation.valid) {
      return res.status(400).json({
        message: 'Password does not meet requirements',
        errors: passwordValidation.errors,
      })
    }

    const existing = await prisma.user.findFirst({ where: { email } })
    if (existing) {
      return res.status(409).json({ message: 'User already exists' })
    }

    const password_hash = await hashPassword(password)
    const user = await prisma.user.create({
      data: {
        email,
        password_hash,
        account_type: account_type as 'PERSONAL' | 'ORGANIZATION',
      },
    })

    const token = generateToken({
      userId: user.id,
      email: user.email || undefined,
    })
    setAuthCookie(res, token)
    return res.status(201).json({
      message: 'Registered',
      token,
      user: { id: user.id, email: user.email, account_type: user.account_type },
    })
  } catch (error) {
    logger.error('Register error:', error)
    return res.status(500).json({ message: 'Failed to register' })
  }
})

// Login with email/password (supports 2FA)
router.post('/login', loginRateLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password, totpCode, backupCode } = req.body || {}
    if (!email || !password) {
      return res.status(400).json({ message: 'email and password are required' })
    }

    const user = await prisma.user.findFirst({
      where: { email },
      select: {
        id: true,
        email: true,
        password_hash: true,
        account_type: true,
        role: true,
        two_factor_enabled: true,
        two_factor_secret: true,
        two_factor_backup_codes: true,
      },
    })
    if (!user || !user.password_hash) {
      return res.status(401).json({ message: 'Invalid credentials' })
    }

    const ok = await comparePassword(password, user.password_hash)
    if (!ok) {
      return res.status(401).json({ message: 'Invalid credentials' })
    }

    // Check if 2FA is enabled
    if (user.two_factor_enabled && user.two_factor_secret) {
      // If no 2FA code provided, indicate 2FA is required
      if (!totpCode && !backupCode) {
        return res.status(200).json({
          success: true,
          data: {
            requires2FA: true,
            message: 'Two-factor authentication required',
          },
        })
      }

      // Verify TOTP code
      if (totpCode) {
        const isValid = verifyTOTP(user.two_factor_secret, totpCode)
        if (!isValid) {
          return res.status(401).json({ message: 'Invalid 2FA code' })
        }
      }
      // Or verify backup code
      else if (backupCode) {
        const codeIndex = verifyBackupCode(backupCode, user.two_factor_backup_codes)
        if (codeIndex === -1) {
          return res.status(401).json({ message: 'Invalid backup code' })
        }
        // Remove used backup code
        const updatedCodes = [...user.two_factor_backup_codes]
        updatedCodes.splice(codeIndex, 1)
        await prisma.user.update({
          where: { id: user.id },
          data: { two_factor_backup_codes: updatedCodes },
        })
        logger.log('[auth] Backup code used', { userId: user.id, remainingCodes: updatedCodes.length })
      }
    }

    const token = generateToken({
      userId: user.id,
      email: user.email || undefined,
    })
    setAuthCookie(res, token)
    return res.status(200).json({
      success: true,
      data: {
        message: 'Logged in',
        token,
        user: {
          id: user.id,
          email: user.email,
          account_type: user.account_type,
          role: user.role,
          two_factor_enabled: user.two_factor_enabled,
        },
      },
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
router.post(
  '/extension-token',
  extensionTokenRateLimiter,
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { userId } = req.body

      if (!userId || typeof userId !== 'string') {
        return res.status(400).json({ message: 'userId is required' })
      }

      // Security: Ensure the requested userId matches the authenticated user
      if (userId !== req.user!.id) {
        logger.warn(
          `Extension token attempt for different user: requested=${userId}, authenticated=${req.user!.id}`
        )
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
  }
)

// ==========================================
// Two-Factor Authentication (2FA) Endpoints
// ==========================================

// Setup 2FA - generates secret and returns QR code URI
router.post(
  '/2fa/setup',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
        select: { id: true, email: true, two_factor_enabled: true },
      })

      if (!user) {
        return res.status(404).json({ message: 'User not found' })
      }

      if (user.two_factor_enabled) {
        return res.status(400).json({ message: '2FA is already enabled' })
      }

      // Generate new secret
      const secret = generateSecret()
      const uri = generateTOTPUri(secret, user.email || 'user', 'Cognia')

      // Store secret temporarily (not enabled yet)
      await prisma.user.update({
        where: { id: user.id },
        data: { two_factor_secret: secret },
      })

      res.status(200).json({
        success: true,
        data: {
          secret,
          uri, // Can be used to generate QR code on frontend
          message: 'Scan the QR code with your authenticator app, then verify with a code',
        },
      })
    } catch (error) {
      logger.error('2FA setup error:', error)
      res.status(500).json({ message: 'Failed to setup 2FA' })
    }
  }
)

// Verify 2FA setup - confirms the setup with a code
router.post(
  '/2fa/verify',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { code } = req.body || {}

      if (!code) {
        return res.status(400).json({ message: 'Verification code is required' })
      }

      const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
        select: { id: true, two_factor_enabled: true, two_factor_secret: true },
      })

      if (!user) {
        return res.status(404).json({ message: 'User not found' })
      }

      if (user.two_factor_enabled) {
        return res.status(400).json({ message: '2FA is already enabled' })
      }

      if (!user.two_factor_secret) {
        return res.status(400).json({ message: 'Please setup 2FA first' })
      }

      // Verify the code
      const isValid = verifyTOTP(user.two_factor_secret, code)
      if (!isValid) {
        return res.status(401).json({ message: 'Invalid verification code' })
      }

      // Generate backup codes
      const backupCodes = generateBackupCodes()
      const hashedBackupCodes = backupCodes.map(hashBackupCode)

      // Enable 2FA
      await prisma.user.update({
        where: { id: user.id },
        data: {
          two_factor_enabled: true,
          two_factor_backup_codes: hashedBackupCodes,
        },
      })

      logger.log('[auth] 2FA enabled', { userId: user.id })

      res.status(200).json({
        success: true,
        data: {
          message: '2FA enabled successfully',
          backupCodes, // Return plaintext backup codes only once
          warning: 'Save these backup codes in a secure location. They cannot be shown again.',
        },
      })
    } catch (error) {
      logger.error('2FA verify error:', error)
      res.status(500).json({ message: 'Failed to verify 2FA' })
    }
  }
)

// Disable 2FA
router.post(
  '/2fa/disable',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { code, password } = req.body || {}

      if (!password) {
        return res.status(400).json({ message: 'Password is required to disable 2FA' })
      }

      const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
        select: {
          id: true,
          password_hash: true,
          two_factor_enabled: true,
          two_factor_secret: true,
        },
      })

      if (!user) {
        return res.status(404).json({ message: 'User not found' })
      }

      if (!user.two_factor_enabled) {
        return res.status(400).json({ message: '2FA is not enabled' })
      }

      // Verify password
      if (!user.password_hash) {
        return res.status(400).json({ message: 'Cannot disable 2FA for this account' })
      }

      const passwordValid = await comparePassword(password, user.password_hash)
      if (!passwordValid) {
        return res.status(401).json({ message: 'Invalid password' })
      }

      // Optionally verify 2FA code if provided
      if (code && user.two_factor_secret) {
        const isValid = verifyTOTP(user.two_factor_secret, code)
        if (!isValid) {
          return res.status(401).json({ message: 'Invalid 2FA code' })
        }
      }

      // Disable 2FA
      await prisma.user.update({
        where: { id: user.id },
        data: {
          two_factor_enabled: false,
          two_factor_secret: null,
          two_factor_backup_codes: [],
        },
      })

      logger.log('[auth] 2FA disabled', { userId: user.id })

      res.status(200).json({
        success: true,
        message: '2FA disabled successfully',
      })
    } catch (error) {
      logger.error('2FA disable error:', error)
      res.status(500).json({ message: 'Failed to disable 2FA' })
    }
  }
)

// Get 2FA status
router.get(
  '/2fa/status',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
        select: {
          id: true,
          two_factor_enabled: true,
          two_factor_backup_codes: true,
        },
      })

      if (!user) {
        return res.status(404).json({ message: 'User not found' })
      }

      res.status(200).json({
        success: true,
        data: {
          enabled: user.two_factor_enabled,
          backupCodesRemaining: user.two_factor_backup_codes.length,
        },
      })
    } catch (error) {
      logger.error('2FA status error:', error)
      res.status(500).json({ message: 'Failed to get 2FA status' })
    }
  }
)

// Regenerate backup codes
router.post(
  '/2fa/backup-codes',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { code, password } = req.body || {}

      if (!password || !code) {
        return res.status(400).json({ message: 'Password and 2FA code are required' })
      }

      const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
        select: {
          id: true,
          password_hash: true,
          two_factor_enabled: true,
          two_factor_secret: true,
        },
      })

      if (!user) {
        return res.status(404).json({ message: 'User not found' })
      }

      if (!user.two_factor_enabled || !user.two_factor_secret) {
        return res.status(400).json({ message: '2FA is not enabled' })
      }

      // Verify password
      if (!user.password_hash) {
        return res.status(400).json({ message: 'Cannot regenerate codes for this account' })
      }

      const passwordValid = await comparePassword(password, user.password_hash)
      if (!passwordValid) {
        return res.status(401).json({ message: 'Invalid password' })
      }

      // Verify 2FA code
      const isValid = verifyTOTP(user.two_factor_secret, code)
      if (!isValid) {
        return res.status(401).json({ message: 'Invalid 2FA code' })
      }

      // Generate new backup codes
      const backupCodes = generateBackupCodes()
      const hashedBackupCodes = backupCodes.map(hashBackupCode)

      await prisma.user.update({
        where: { id: user.id },
        data: { two_factor_backup_codes: hashedBackupCodes },
      })

      logger.log('[auth] Backup codes regenerated', { userId: user.id })

      res.status(200).json({
        success: true,
        data: {
          backupCodes,
          warning: 'Save these new backup codes. Previous codes are now invalid.',
        },
      })
    } catch (error) {
      logger.error('Backup codes regeneration error:', error)
      res.status(500).json({ message: 'Failed to regenerate backup codes' })
    }
  }
)

// ==========================================
// Password Management
// ==========================================

// Change password - respects organization password policy
router.post(
  '/change-password',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { currentPassword, newPassword } = req.body || {}

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: 'currentPassword and newPassword are required' })
      }

      // Get user with password hash
      const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
        select: { id: true, password_hash: true },
      })

      if (!user || !user.password_hash) {
        return res.status(400).json({ message: 'Cannot change password for this account' })
      }

      // Verify current password
      const isValid = await comparePassword(currentPassword, user.password_hash)
      if (!isValid) {
        return res.status(401).json({ message: 'Current password is incorrect' })
      }

      // Get the strictest password policy from user's organizations
      const memberships = await prisma.organizationMember.findMany({
        where: { user_id: req.user!.id },
        include: {
          organization: {
            select: { password_policy: true },
          },
        },
      })

      // Determine which policy to apply (strictest wins)
      let policy: PasswordPolicy = 'standard'
      for (const membership of memberships) {
        if (membership.organization.password_policy === 'strong') {
          policy = 'strong'
          break
        }
      }

      // Validate new password
      const validation = validatePassword(newPassword, policy)
      if (!validation.valid) {
        return res.status(400).json({
          message: 'New password does not meet requirements',
          errors: validation.errors,
          policy,
        })
      }

      // Update password
      const newHash = await hashPassword(newPassword)
      await prisma.user.update({
        where: { id: req.user!.id },
        data: { password_hash: newHash },
      })

      logger.log('[auth] Password changed', { userId: req.user!.id })
      res.status(200).json({ message: 'Password changed successfully' })
    } catch (error) {
      logger.error('Change password error:', error)
      res.status(500).json({ message: 'Failed to change password' })
    }
  }
)

export default router
