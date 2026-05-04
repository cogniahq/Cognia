/**
 * Centralized boot-time validation of required environment variables.
 *
 * Each entry below is enumerated explicitly. Missing or empty values cause
 * the process to exit before any services come up — better to fail loudly
 * at boot than to surface a runtime crash hours later when a code path
 * happens to hit an unset variable.
 *
 * Run via `validateEnv()` as the first thing in App.ts (after `dotenv/config`).
 */

interface RequiredEnvVar {
  name: string
  /** Why the application cannot run without this; surfaced in the error. */
  reason: string
}

const REQUIRED_ENV_VARS: RequiredEnvVar[] = [
  {
    name: 'DATABASE_URL',
    reason: 'Postgres connection string. Prisma cannot initialize without it.',
  },
  {
    name: 'JWT_SECRET',
    reason: 'Used to sign and verify access tokens. Must be a high-entropy secret.',
  },
  {
    name: 'TOKEN_ENCRYPTION_KEY',
    reason: 'AES-256-GCM key (64 hex chars) for integration OAuth tokens at rest.',
  },
  {
    name: 'TWO_FACTOR_ENCRYPTION_KEY',
    reason: 'AES-256-GCM key (64 hex chars) for TOTP secret encryption at rest.',
  },
]

/**
 * Runs at boot. Logs every missing variable in one pass (so an operator
 * fixing the deploy doesn't have to iterate one error at a time), then exits.
 */
export function validateEnv(): void {
  const missing: RequiredEnvVar[] = REQUIRED_ENV_VARS.filter(v => {
    const value = process.env[v.name]
    return !value || value.trim() === ''
  })

  if (missing.length === 0) return

  // Pino-friendly structured error to stderr.
  for (const entry of missing) {
    process.stderr.write(
      `[FATAL] required environment variable "${entry.name}" is missing or empty. ${entry.reason}\n`
    )
  }
  process.stderr.write(
    `[FATAL] ${missing.length} required environment variable(s) missing; refusing to start.\n`
  )
  process.exit(1)
}
