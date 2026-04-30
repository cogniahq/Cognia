import { prisma } from '../../lib/prisma.lib'
import { decryptString, encryptString } from '../../utils/auth/crypto.util'

export type LlmProvider = 'openai' | 'anthropic' | 'azure_openai' | 'bedrock' | 'system'

export interface LlmCredentials {
  provider: LlmProvider
  apiKey: string
  config?: Record<string, unknown>
}

const SYSTEM_KEY = process.env.OPENAI_API_KEY ?? ''

/**
 * Resolve LLM credentials for the given organization.
 * - If the org has a configured BYOK provider + encrypted key, decrypt and return it.
 * - Otherwise (no org, no provider, decrypt failure, missing TOKEN_ENCRYPTION_KEY),
 *   fall back to system credentials sourced from OPENAI_API_KEY.
 */
export async function getLlmCredentialsForOrg(orgId: string | null): Promise<LlmCredentials> {
  if (!orgId) return { provider: 'system', apiKey: SYSTEM_KEY }

  const org = await prisma.organization.findUnique({ where: { id: orgId } })
  if (!org?.llm_provider || !org.llm_key_encrypted) {
    return { provider: 'system', apiKey: SYSTEM_KEY }
  }

  const tokenKey = process.env.TOKEN_ENCRYPTION_KEY
  if (!tokenKey) return { provider: 'system', apiKey: SYSTEM_KEY }

  let plaintext: string
  try {
    plaintext = decryptString(org.llm_key_encrypted, tokenKey)
  } catch {
    return { provider: 'system', apiKey: SYSTEM_KEY }
  }

  return {
    provider: org.llm_provider as LlmProvider,
    apiKey: plaintext,
    config: (org.llm_config as Record<string, unknown> | null) ?? undefined,
  }
}

export interface SetOrgLlmConfigInput {
  provider: string | null
  config?: Record<string, unknown>
  apiKey?: string | null
}

/**
 * Set or clear an organization's BYOK LLM configuration.
 * - apiKey === null: clear stored key
 * - apiKey === undefined: leave existing key untouched
 * - apiKey === string: encrypt with TOKEN_ENCRYPTION_KEY and store
 */
export async function setOrgLlmConfig(orgId: string, input: SetOrgLlmConfigInput): Promise<void> {
  const tokenKey = process.env.TOKEN_ENCRYPTION_KEY
  if (input.apiKey && !tokenKey) {
    throw new Error('TOKEN_ENCRYPTION_KEY required to set BYOK key')
  }

  const data: Record<string, unknown> = {
    llm_provider: input.provider,
    llm_config: input.config ?? null,
  }

  if (input.apiKey === null) {
    data.llm_key_encrypted = null
  } else if (input.apiKey !== undefined && tokenKey) {
    data.llm_key_encrypted = encryptString(input.apiKey, tokenKey)
  }

  await prisma.organization.update({ where: { id: orgId }, data })
}
