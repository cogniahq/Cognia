import { storage } from '@/lib/browser'
import { STORAGE_KEYS } from '@/utils/core/constants.util'
import type { CaptureTarget } from '@/types/destinations.types'

// Cognia is org-only; "no destination set" is represented by a null
// organizationId so the caller can decide whether to prompt the user
// (manual flow) or surface a notification (auto-capture flow). The server
// rejects payloads with no organization_id.
const UNSET: CaptureTarget = { organizationId: null, workspaceId: null }

function normalize(value: unknown): CaptureTarget | null {
  if (!value || typeof value !== 'object') return null
  const v = value as { organizationId?: unknown; workspaceId?: unknown }
  const orgId = typeof v.organizationId === 'string' ? v.organizationId : null
  const wsId = typeof v.workspaceId === 'string' ? v.workspaceId : null
  // workspace without org is invalid — drop both rather than send a
  // malformed payload.
  if (wsId && !orgId) return UNSET
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
 * > unset.
 *
 * Always returns a value. If both sources are missing (org-only model with
 * no default chosen yet), the returned target's `organizationId` is null —
 * callers should prompt the user / surface a notification rather than POST
 * a payload the server will reject.
 */
export async function getEffectiveCaptureTarget(): Promise<CaptureTarget> {
  const override = await readSessionOverride()
  if (override) return override
  const def = await readSyncDefault()
  if (def) return def
  return UNSET
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
  return (await readSyncDefault()) ?? UNSET
}

export async function getSessionOverride(): Promise<CaptureTarget | null> {
  return await readSessionOverride()
}
