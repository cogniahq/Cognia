/**
 * Password Policy Enforcement
 *
 * Policies:
 * - standard: 8+ characters
 * - strong: 12+ chars, uppercase, lowercase, number, special char
 * - custom: configurable (future)
 */

export type PasswordPolicy = 'standard' | 'strong' | 'custom'

export interface PasswordValidationResult {
  valid: boolean
  errors: string[]
}

const SPECIAL_CHARS = /[-!@#$%^&*()_+=\\{};':"|,.<>/?\][]/

/**
 * Validate password against a policy
 */
export function validatePassword(
  password: string,
  policy: PasswordPolicy = 'standard'
): PasswordValidationResult {
  const errors: string[] = []

  if (!password) {
    return { valid: false, errors: ['Password is required'] }
  }

  switch (policy) {
    case 'strong':
      // 12+ characters
      if (password.length < 12) {
        errors.push('Password must be at least 12 characters')
      }
      // Uppercase letter
      if (!/[A-Z]/.test(password)) {
        errors.push('Password must contain at least one uppercase letter')
      }
      // Lowercase letter
      if (!/[a-z]/.test(password)) {
        errors.push('Password must contain at least one lowercase letter')
      }
      // Number
      if (!/[0-9]/.test(password)) {
        errors.push('Password must contain at least one number')
      }
      // Special character
      if (!SPECIAL_CHARS.test(password)) {
        errors.push('Password must contain at least one special character')
      }
      break

    case 'standard':
    default:
      // 8+ characters
      if (password.length < 8) {
        errors.push('Password must be at least 8 characters')
      }
      break
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Get password requirements description for a policy
 */
export function getPasswordRequirements(policy: PasswordPolicy = 'standard'): string[] {
  switch (policy) {
    case 'strong':
      return [
        'At least 12 characters',
        'At least one uppercase letter (A-Z)',
        'At least one lowercase letter (a-z)',
        'At least one number (0-9)',
        'At least one special character (!@#$%^&*...)',
      ]
    case 'standard':
    default:
      return ['At least 8 characters']
  }
}
