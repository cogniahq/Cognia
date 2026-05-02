import { describe, it, expect, beforeEach, vi } from 'vitest'

// Stub the chrome API surface that the service consumes via `@/lib/browser`.
// We construct independent stores per test so writes don't leak between cases.
type StorageMap = Record<string, unknown>

function makeStorageArea(initial: StorageMap = {}) {
  let state = { ...initial }
  return {
    state: () => state,
    get: vi.fn(
      (
        keys: string | string[] | { [key: string]: unknown } | null,
        cb?: (out: StorageMap) => void
      ) => {
        let out: StorageMap = {}
        if (keys === null) {
          out = { ...state }
        } else if (typeof keys === 'string') {
          if (keys in state) out[keys] = state[keys]
        } else if (Array.isArray(keys)) {
          for (const k of keys) {
            if (k in state) out[k] = state[k]
          }
        } else {
          for (const [k, v] of Object.entries(keys)) {
            out[k] = k in state ? state[k] : v
          }
        }
        if (cb) cb(out)
      }
    ),
    set: vi.fn((items: StorageMap, cb?: () => void) => {
      state = { ...state, ...items }
      if (cb) cb()
    }),
    remove: vi.fn((keys: string | string[], cb?: () => void) => {
      const list = Array.isArray(keys) ? keys : [keys]
      for (const k of list) delete state[k]
      if (cb) cb()
    }),
  }
}

let syncArea = makeStorageArea()
let sessionArea = makeStorageArea()
let localArea = makeStorageArea()

beforeEach(() => {
  syncArea = makeStorageArea()
  sessionArea = makeStorageArea()
  localArea = makeStorageArea()
  vi.stubGlobal('chrome', {
    storage: {
      sync: syncArea,
      session: sessionArea,
      local: localArea,
    },
    runtime: { id: 'test', lastError: undefined },
  })
})

describe('getEffectiveCaptureTarget', () => {
  it('returns personal when nothing is set', async () => {
    const { getEffectiveCaptureTarget } = await import('./capture-target.service')
    const target = await getEffectiveCaptureTarget()
    expect(target).toEqual({ organizationId: null, workspaceId: null })
  })

  it('returns sync default when only the default is set', async () => {
    syncArea.set({
      capture_target_default: { organizationId: 'org-1', workspaceId: 'ws-1' },
    })
    vi.resetModules()
    const { getEffectiveCaptureTarget } = await import('./capture-target.service')
    const target = await getEffectiveCaptureTarget()
    expect(target).toEqual({ organizationId: 'org-1', workspaceId: 'ws-1' })
  })

  it('returns session override when both default and override are set', async () => {
    syncArea.set({
      capture_target_default: { organizationId: 'org-default', workspaceId: 'ws-default' },
    })
    sessionArea.set({
      capture_target_override: { organizationId: 'org-override', workspaceId: null },
    })
    vi.resetModules()
    const { getEffectiveCaptureTarget } = await import('./capture-target.service')
    const target = await getEffectiveCaptureTarget()
    expect(target).toEqual({ organizationId: 'org-override', workspaceId: null })
  })

  it('collapses workspace-without-org to personal', async () => {
    sessionArea.set({
      capture_target_override: { organizationId: null, workspaceId: 'ws-orphan' },
    })
    vi.resetModules()
    const { getEffectiveCaptureTarget } = await import('./capture-target.service')
    const target = await getEffectiveCaptureTarget()
    expect(target).toEqual({ organizationId: null, workspaceId: null })
  })

  it('setSessionOverride writes to session storage', async () => {
    vi.resetModules()
    const { setSessionOverride, getEffectiveCaptureTarget } = await import(
      './capture-target.service'
    )
    await setSessionOverride({ organizationId: 'org-xyz', workspaceId: null })
    const target = await getEffectiveCaptureTarget()
    expect(target).toEqual({ organizationId: 'org-xyz', workspaceId: null })
  })

  it('clearSessionOverride removes the override', async () => {
    vi.resetModules()
    const { setSessionOverride, clearSessionOverride, getEffectiveCaptureTarget } = await import(
      './capture-target.service'
    )
    await setSessionOverride({ organizationId: 'org-xyz', workspaceId: null })
    await clearSessionOverride()
    const target = await getEffectiveCaptureTarget()
    expect(target).toEqual({ organizationId: null, workspaceId: null })
  })

  it('setSyncDefault persists the default', async () => {
    vi.resetModules()
    const { setSyncDefault, getSyncDefault } = await import('./capture-target.service')
    await setSyncDefault({ organizationId: 'org-aaa', workspaceId: 'ws-aaa' })
    const def = await getSyncDefault()
    expect(def).toEqual({ organizationId: 'org-aaa', workspaceId: 'ws-aaa' })
  })
})
