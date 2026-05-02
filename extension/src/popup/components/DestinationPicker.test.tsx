import React from 'react'
import { afterEach, describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'

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
        if (keys === null) out = { ...state }
        else if (typeof keys === 'string') {
          if (keys in state) out[keys] = state[keys]
        } else if (Array.isArray(keys)) {
          for (const k of keys) if (k in state) out[k] = state[k]
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

const destinationsPayload = {
  personal: true as const,
  organizations: [
    {
      id: 'org-1',
      slug: 'acme',
      name: 'ACME',
      role: 'ADMIN' as const,
      workspaces: [{ id: 'ws-1', slug: 'eng', name: 'Engineering' }],
    },
  ],
  default: { organizationId: null, workspaceId: null },
}

let syncArea: ReturnType<typeof makeStorageArea>
let sessionArea: ReturnType<typeof makeStorageArea>
let localArea: ReturnType<typeof makeStorageArea>
let sentMessages: { type: string }[] = []
const fetchMock = vi.fn()

afterEach(() => {
  cleanup()
  vi.resetModules()
})

beforeEach(() => {
  syncArea = makeStorageArea({ apiEndpoint: 'http://localhost:3000/api/memory/process' })
  sessionArea = makeStorageArea()
  localArea = makeStorageArea({ auth_token: makeJwt() })
  sentMessages = []
  fetchMock.mockReset()
  fetchMock.mockImplementation(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: destinationsPayload }),
    } as unknown as Response)
  )
  vi.stubGlobal('fetch', fetchMock)
  vi.stubGlobal('chrome', {
    storage: { sync: syncArea, session: sessionArea, local: localArea },
    runtime: {
      id: 'test',
      lastError: undefined,
      sendMessage: vi.fn(
        (message: { type: string }, cb?: (response: unknown) => void) => {
          sentMessages.push(message)
          if (message.type === 'GET_DESTINATIONS') {
            cb?.({ success: true, data: destinationsPayload })
          } else {
            cb?.({ success: true })
          }
        }
      ),
    },
  })
})

function makeJwt(): string {
  // Minimal JWT-shaped string with a far-future exp; the popup hooks call
  // requireAuthToken() which decodes the payload's exp.
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = btoa(
    JSON.stringify({ userId: 'u-1', exp: Math.floor(Date.now() / 1000) + 3600 })
  )
  return `${header}.${payload}.sig`
}

describe('DestinationPicker', () => {
  it('renders given destinations payload and selecting a workspace writes session storage', async () => {
    const { DestinationPicker } = await import('./DestinationPicker')
    render(<DestinationPicker />)

    await waitFor(() => {
      expect(screen.getByTestId('pick-personal')).toBeTruthy()
      expect(screen.getByTestId('pick-ws:org-1:ws-1')).toBeTruthy()
    })

    const initialLabel = screen.getByTestId('active-label')
    expect(initialLabel.textContent).toBe('Personal')

    fireEvent.click(screen.getByTestId('pick-ws:org-1:ws-1'))

    await waitFor(() => {
      expect(screen.getByTestId('active-label').textContent).toBe('ACME / Engineering')
    })
    expect(sessionArea.state().capture_target_override).toEqual({
      organizationId: 'org-1',
      workspaceId: 'ws-1',
    })
  })

  it('Make default writes sync storage AND posts to capture-destination API', async () => {
    const { DestinationPicker } = await import('./DestinationPicker')
    render(<DestinationPicker />)

    // Wait for the destinations payload to render before locating the button.
    const button = await screen.findByTestId('default-org:org-1')
    fireEvent.click(button)

    await waitFor(() => {
      expect(syncArea.state().capture_target_default).toEqual({
        organizationId: 'org-1',
        workspaceId: null,
      })
    })

    await waitFor(() => {
      const profileCall = fetchMock.mock.calls.find(c =>
        String(c[0]).includes('/api/profile/capture-destination')
      )
      expect(profileCall).toBeTruthy()
      expect(profileCall![1]?.method).toBe('PUT')
      expect(JSON.parse(profileCall![1]?.body as string)).toEqual({
        organizationId: 'org-1',
        workspaceId: null,
      })
    })
  })
})
