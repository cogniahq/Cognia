import { storage } from '@/lib/browser'
import { STORAGE_KEYS } from '@/utils/core/constants.util'
import type { CaptureTarget } from '@/types/destinations.types'

const PERSONAL: CaptureTarget = { organizationId: null, workspaceId: null }

function normalize(value: unknown): CaptureTarget | null {
  if (!value || typeof value !== 'object') return null
  const v = value as { organizationId?: unknown; workspaceId?: unknown }
  const orgId = typeof v.organizationId === 'string' ? v.organizationId : null
  const wsId = typeof v.workspaceId === 'string' ? v.workspaceId : null
  // workspace without org is invalid — collapse to personal rather than send
  // a malformed payload.
  if (wsId && !orgId) return PERSONAL
  return { organizationId: orgId, workspaceId: wsId }
}

async function readSyncDefault(): Promise<CaptureTarget | null> {
  try {
    const result = await storage.sync.get([STORAGE_KEYS.CAPTURE_TARGET_DEFAULT])
    return normalize(result[STORAGE_KEYS.CAPTURE_TARGET_DEFAULT])
  } catch {
    return null
  }
}

async function readSessionOverride(): Promise<CaptureTarget | null> {
  try {
    const result = await storage.session.get([STORAGE_KEYS.CAPTURE_TARGET_OVERRIDE])
    return normalize(result[STORAGE_KEYS.CAPTURE_TARGET_OVERRIDE])
  } catch {
    return null
  }
}

/**
 * Resolve the effective capture target for the next memory POST.
 *
 * Precedence: session override (per-capture, set by the popup) > sync default
 * (the user's saved preference, follows them across browsers via Chrome sync)
 * > personal vault.
 *
 * Always returns a value — failures fall through to personal so capture never
 * silently picks an unintended workspace.
 */
export async function getEffectiveCaptureTarget(): Promise<CaptureTarget> {
  const override = await readSessionOverride()
  if (override) return override
  const def = await readSyncDefault()
  if (def) return def
  return PERSONAL
}

export async function setSessionOverride(target: CaptureTarget): Promise<void> {
  await storage.session.set({ [STORAGE_KEYS.CAPTURE_TARGET_OVERRIDE]: target })
}

export async function clearSessionOverride(): Promise<void> {
  await storage.session.remove(STORAGE_KEYS.CAPTURE_TARGET_OVERRIDE)
}

export async function setSyncDefault(target: CaptureTarget): Promise<void> {
  await storage.sync.set({ [STORAGE_KEYS.CAPTURE_TARGET_DEFAULT]: target })
}

export async function getSyncDefault(): Promise<CaptureTarget> {
  return (await readSyncDefault()) ?? PERSONAL
}

export async function getSessionOverride(): Promise<CaptureTarget | null> {
  return await readSessionOverride()
}
