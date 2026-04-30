import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma.lib'
import { setAuthCookie, clearAuthCookie } from '../utils/auth/auth-cookie.util'
import { generateToken } from '../utils/auth/jwt.util'
import {
  authenticateToken,
  AuthenticatedRequest,
  requireAdmin,
} from '../middleware/auth.middleware'
import { revokeJti, revokeAllForUser } from '../services/auth/jwt-revocation.service'
import {
  issueRefreshToken,
  rotateRefreshToken,
  revokeAllForUser as revokeRefreshForUser,
} from '../services/auth/refresh-token.service'
import { hashPassword, comparePassword } from '../utils/core/password.util'
import { validatePasswordWithBreachCheck, PasswordPolicy } from '../utils/auth/password-policy.util'
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
import {
  encrypt2faSecret,
  decrypt2faSecret,
  is2faSecretLegacy,
} from '../services/auth/two-factor.service'
import { auditLogService } from '../services/core/audit-log.service'
import {
  issueEmailVerificationToken,
  consumeEmailVerificationToken,
  sendVerificationEmail,
} from '../services/auth/email-verification.service'
import { seedSampleWorkspace } from '../services/onboarding/sample-workspace-seeder.service'
import { getEffectivePermissions } from '../services/auth/permissions.service'

const router = Router()

// Get current user — extended in Phase 7 to return effective RBAC permissions
// for both the personal account and every org membership the user has.
// Frontend reads `personalPermissions` + `orgPermissions[]` to gate UI.
router.get('/me', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { id: true, email: true, account_type: true, role: true },
    })

    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }

    // Effective permission sets:
    // - personalPermissions: scope = no org. Matches what the user can do
    //   on /api endpoints that operate without an org context.
    // - orgPermissions: one entry per active membership. Frontend picks
    //   the entry matching `currentOrganization` and uses it for gating.
    const personalPermissions = await getEffectivePermissions(user.id, null)

    const memberships = await prisma.organizationMember.findMany({
      where: { user_id: user.id, deactivated_at: null },
      include: {
        organization: { select: { id: true, name: true, slug: true } },
      },
    })

    const orgPermissions = await Promise.all(
      memberships.map(async m => ({
        organizationId: m.organization.id,
        orgSlug: m.organization.slug,
        role: m.role,
        permissions: await getEffectivePermissions(user.id, m.organization.id),
      }))
    )

    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        account_type: user.account_type,
        role: user.role,
        personalPermissions,
        orgPermissions,
      },
    })
  } catch (error) {
    logger.error('Get me error:', error)
    return res.status(500).json({ message: 'Failed to get user' })
  }
})

// Logout (revoke current JWT's jti and clear session cookie)
router.post('/logout', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.id) {
      await auditLogService
        .logEvent({
          userId: req.user.id,
          eventType: 'logout',
          eventCategory: 'authentication',
          action: 'logout',
          metadata: { jti: req.user.jti },
          ipAddress: req.ip,
          userAgent: req.get('user-agent') ?? undefined,
        })
        .catch(() => {})
    }
    const jti = req.user?.jti
    if (jti) {
      // Worst-case TTL: full configured JWT lifetime (default 7 days) in milliseconds
      await revokeJti(jti, 7 * 24 * 60 * 60 * 1000)
    }
    clearAuthCookie(res)
    return res.status(200).json({ message: 'Logged out successfully' })
  } catch (error) {
    logger.error('Logout error:', error)
    return res.status(500).json({ message: 'Failed to logout' })
  }
})

// Logout from all sessions for the current user (revoke-since floor + refresh tokens)
router.post('/logout-all', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: 'Unauthorized' })
    }
    await Promise.all([revokeAllForUser(req.user.id), revokeRefreshForUser(req.user.id)])
    await auditLogService
      .logEvent({
        userId: req.user.id,
        eventType: 'session_revoked',
        eventCategory: 'security',
        action: 'logout-all',
        metadata: { scope: 'self' },
        ipAddress: req.ip,
        userAgent: req.get('user-agent') ?? undefined,
      })
      .catch(() => {})
    clearAuthCookie(res)
    res.clearCookie('cognia_refresh', { path: '/api/auth/refresh' })
    return res.status(200).json({ message: 'All sessions revoked' })
  } catch (error) {
    logger.error('Logout-all error:', error)
    return res.status(500).json({ message: 'Failed to revoke sessions' })
  }
})

// Admin-only: revoke all sessions for a given user (JWT floor + refresh tokens)
router.post(
  '/sessions/:userId/revoke',
  authenticateToken,
  requireAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { userId } = req.params
      await Promise.all([revokeAllForUser(userId), revokeRefreshForUser(userId)])
      await auditLogService
        .logEvent({
          userId,
          eventType: 'session_revoked',
          eventCategory: 'security',
          action: 'admin-revoke',
          metadata: { revokedBy: req.user?.id },
          ipAddress: req.ip,
          userAgent: req.get('user-agent') ?? undefined,
        })
        .catch(() => {})
      logger.log('[auth] Admin revoked user sessions', {
        adminId: req.user!.id,
        targetUserId: userId,
      })
      return res.status(200).json({ message: 'User sessions revoked', userId })
    } catch (error) {
      logger.error('Admin session revoke error:', error)
      return res.status(500).json({ message: 'Failed to revoke user sessions' })
    }
  }
)

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

    // Validate password against standard policy + HIBP breach check for new registrations
    const passwordValidation = await validatePasswordWithBreachCheck(password, 'standard')
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

    // Issue and send a verify-email token for the freshly created user
    const { token: vToken } = await issueEmailVerificationToken(user.id, 'verify_email')
    await sendVerificationEmail(user.email!, vToken, 'verify_email').catch(() => {})

    // Kick off sample-workspace seeding asynchronously so registration is not blocked
    seedSampleWorkspace(user.id).catch(err =>
      logger.warn('[register] seeder failed', { error: String(err) })
    )

    const token = generateToken({
      userId: user.id,
      email: user.email || undefined,
    })
    setAuthCookie(res, token)
    const { token: refreshToken } = await issueRefreshToken(user.id, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent') ?? undefined,
    })
    res.cookie('cognia_refresh', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/auth/refresh',
      maxAge: 14 * 24 * 60 * 60 * 1000,
    })
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
      await auditLogService
        .logEvent({
          userId: user.id,
          eventType: 'login_failed',
          eventCategory: 'authentication',
          action: 'login',
          metadata: { reason: 'invalid_password' },
          ipAddress: req.ip,
          userAgent: req.get('user-agent') ?? undefined,
        })
        .catch(() => {})
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
        const decryptedSecret = decrypt2faSecret(user.two_factor_secret)
        const isValid = verifyTOTP(decryptedSecret, totpCode)
        if (!isValid) {
          await auditLogService
            .logEvent({
              userId: user.id,
              eventType: 'login_failed',
              eventCategory: 'authentication',
              action: 'login',
              metadata: { reason: 'invalid_2fa' },
              ipAddress: req.ip,
              userAgent: req.get('user-agent') ?? undefined,
            })
            .catch(() => {})
          return res.status(401).json({ message: 'Invalid 2FA code' })
        }
        // Opportunistically re-encrypt legacy plaintext secrets after a
        // successful TOTP verification so the stored value is upgraded
        // without requiring an explicit backfill run.
        if (is2faSecretLegacy(user.two_factor_secret)) {
          await prisma.user.update({
            where: { id: user.id },
            data: { two_factor_secret: encrypt2faSecret(decryptedSecret) },
          })
        }
      }
      // Or verify backup code
      else if (backupCode) {
        const codeIndex = verifyBackupCode(backupCode, user.two_factor_backup_codes)
        if (codeIndex === -1) {
          await auditLogService
            .logEvent({
              userId: user.id,
              eventType: 'login_failed',
              eventCategory: 'authentication',
              action: 'login',
              metadata: { reason: 'invalid_2fa' },
              ipAddress: req.ip,
              userAgent: req.get('user-agent') ?? undefined,
            })
            .catch(() => {})
          return res.status(401).json({ message: 'Invalid backup code' })
        }
        // Remove used backup code
        const updatedCodes = [...user.two_factor_backup_codes]
        updatedCodes.splice(codeIndex, 1)
        await prisma.user.update({
          where: { id: user.id },
          data: { two_factor_backup_codes: updatedCodes },
        })
        logger.log('[auth] Backup code used', {
          userId: user.id,
          remainingCodes: updatedCodes.length,
        })
      }
    }

    const token = generateToken({
      userId: user.id,
      email: user.email || undefined,
    })
    setAuthCookie(res, token)
    const { token: refreshToken } = await issueRefreshToken(user.id, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent') ?? undefined,
    })
    res.cookie('cognia_refresh', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/auth/refresh',
      maxAge: 14 * 24 * 60 * 60 * 1000,
    })
    await auditLogService
      .logEvent({
        userId: user.id,
        eventType: 'login_success',
        eventCategory: 'authentication',
        action: 'login',
        metadata: { source: req.body?.source ?? 'web' },
        ipAddress: req.ip,
        userAgent: req.get('user-agent') ?? undefined,
      })
      .catch(() => {})
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

// Rotate the refresh token cookie and mint a fresh access JWT
router.post('/refresh', async (req: Request, res: Response) => {
  const presented = req.cookies?.cognia_refresh
  if (!presented) {
    return res.status(401).json({ message: 'No refresh token' })
  }
  try {
    const { token: nextRefresh, userId } = await rotateRefreshToken(presented, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent') ?? undefined,
    })
    const accessToken = generateToken({ userId })
    setAuthCookie(res, accessToken)
    res.cookie('cognia_refresh', nextRefresh, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/auth/refresh',
      maxAge: 14 * 24 * 60 * 60 * 1000,
    })
    return res.json({ token: accessToken })
  } catch (err) {
    res.clearCookie('cognia_refresh', { path: '/api/auth/refresh' })
    return res.status(401).json({ message: (err as Error).message })
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
router.post('/2fa/setup', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
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

    // Store secret temporarily (not enabled yet) — encrypted at rest.
    // The plaintext `secret` is still returned in the response so the
    // client can render the QR code / setup string.
    await prisma.user.update({
      where: { id: user.id },
      data: { two_factor_secret: encrypt2faSecret(secret) },
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
})

// Verify 2FA setup - confirms the setup with a code
router.post('/2fa/verify', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
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

    // Verify the code (decrypts dual-read: legacy plaintext or enc:v1:)
    const decryptedSecret = decrypt2faSecret(user.two_factor_secret)
    const isValid = verifyTOTP(decryptedSecret, code)
    if (!isValid) {
      return res.status(401).json({ message: 'Invalid verification code' })
    }

    // Opportunistically upgrade a legacy plaintext secret to encrypted
    // storage on a successful verify.
    if (is2faSecretLegacy(user.two_factor_secret)) {
      await prisma.user.update({
        where: { id: user.id },
        data: { two_factor_secret: encrypt2faSecret(decryptedSecret) },
      })
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

    await auditLogService
      .logEvent({
        userId: user.id,
        eventType: '2fa_enabled',
        eventCategory: 'security',
        action: '2fa-setup',
        ipAddress: req.ip,
        userAgent: req.get('user-agent') ?? undefined,
      })
      .catch(() => {})

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
})

// Disable 2FA
router.post('/2fa/disable', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
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
      const decryptedSecret = decrypt2faSecret(user.two_factor_secret)
      const isValid = verifyTOTP(decryptedSecret, code)
      if (!isValid) {
        return res.status(401).json({ message: 'Invalid 2FA code' })
      }
      // No re-encryption upgrade here: the secret is about to be cleared.
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

    await auditLogService
      .logEvent({
        userId: user.id,
        eventType: '2fa_disabled',
        eventCategory: 'security',
        action: '2fa-disable',
        ipAddress: req.ip,
        userAgent: req.get('user-agent') ?? undefined,
      })
      .catch(() => {})

    res.status(200).json({
      success: true,
      message: '2FA disabled successfully',
    })
  } catch (error) {
    logger.error('2FA disable error:', error)
    res.status(500).json({ message: 'Failed to disable 2FA' })
  }
})

// Get 2FA status
router.get('/2fa/status', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
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
})

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

      // Verify 2FA code (decrypts dual-read: legacy plaintext or enc:v1:)
      const decryptedSecret = decrypt2faSecret(user.two_factor_secret)
      const isValid = verifyTOTP(decryptedSecret, code)
      if (!isValid) {
        return res.status(401).json({ message: 'Invalid 2FA code' })
      }

      // Opportunistically upgrade a legacy plaintext secret to encrypted
      // storage on a successful verify.
      if (is2faSecretLegacy(user.two_factor_secret)) {
        await prisma.user.update({
          where: { id: user.id },
          data: { two_factor_secret: encrypt2faSecret(decryptedSecret) },
        })
      }

      // Generate new backup codes
      const backupCodes = generateBackupCodes()
      const hashedBackupCodes = backupCodes.map(hashBackupCode)

      await prisma.user.update({
        where: { id: user.id },
        data: { two_factor_backup_codes: hashedBackupCodes },
      })

      logger.log('[auth] Backup codes regenerated', { userId: user.id })

      await auditLogService
        .logEvent({
          userId: user.id,
          eventType: 'backup_codes_regenerated',
          eventCategory: 'security',
          action: '2fa-backup-codes-regenerate',
          ipAddress: req.ip,
          userAgent: req.get('user-agent') ?? undefined,
        })
        .catch(() => {})

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

      // Validate new password against policy + HIBP breach check
      const validation = await validatePasswordWithBreachCheck(newPassword, policy)
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

      await auditLogService
        .logEvent({
          userId: req.user!.id,
          eventType: 'password_changed',
          eventCategory: 'security',
          action: 'password-change',
          ipAddress: req.ip,
          userAgent: req.get('user-agent') ?? undefined,
        })
        .catch(() => {})

      res.status(200).json({ message: 'Password changed successfully' })
    } catch (error) {
      logger.error('Change password error:', error)
      res.status(500).json({ message: 'Failed to change password' })
    }
  }
)

// ==========================================
// Email verification + magic-link endpoints
// ==========================================

// Public endpoint to verify an email address using a token previously sent to it
router.post('/verify-email', async (req: Request, res: Response) => {
  const { token } = req.body ?? {}
  if (!token) return res.status(400).json({ message: 'token required' })
  try {
    const { userId } = await consumeEmailVerificationToken(token, 'verify_email')
    res.json({ success: true, userId })
  } catch (err) {
    res.status(400).json({ success: false, message: (err as Error).message })
  }
})

// Re-issue a verification email for the currently authenticated user
router.post(
  '/resend-verification',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user?.id || !req.user.email) return res.status(401).json({ message: 'Unauthorized' })
    const { token } = await issueEmailVerificationToken(req.user.id, 'verify_email')
    await sendVerificationEmail(req.user.email, token, 'verify_email').catch(() => {})
    res.json({ success: true })
  }
)

// Magic-link flow (passwordless)
router.post('/magic-link/send', async (req: Request, res: Response) => {
  const { email } = req.body ?? {}
  if (!email) return res.status(400).json({ message: 'email required' })
  const user = await prisma.user.findUnique({ where: { email } })
  // Always 200 to prevent enumeration
  if (!user) return res.json({ success: true })
  const { token } = await issueEmailVerificationToken(user.id, 'magic_link')
  await sendVerificationEmail(email, token, 'magic_link').catch(() => {})
  res.json({ success: true })
})

router.post('/magic-link/consume', async (req: Request, res: Response) => {
  const { token } = req.body ?? {}
  if (!token) return res.status(400).json({ message: 'token required' })
  try {
    const { userId } = await consumeEmailVerificationToken(token, 'magic_link')
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) return res.status(401).json({ message: 'User not found' })
    // Issue access + refresh tokens, mirroring /login success path
    const accessToken = generateToken({ userId: user.id, email: user.email ?? undefined })
    const { token: refreshToken } = await issueRefreshToken(user.id, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent') ?? undefined,
    })
    res.cookie('cognia_refresh', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/auth/refresh',
      maxAge: 14 * 24 * 60 * 60 * 1000,
    })
    res.json({ success: true, token: accessToken })
  } catch (err) {
    res.status(400).json({ success: false, message: (err as Error).message })
  }
})

export default router
