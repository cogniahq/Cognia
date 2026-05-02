import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { ApiKeyManager } from "./ApiKeyManager"

const listApiKeys = vi.fn()
const createApiKey = vi.fn()
const revokeApiKey = vi.fn()

vi.mock("@/services/api-keys/api-keys.service", async () => {
  const actual = await vi.importActual<
    typeof import("@/services/api-keys/api-keys.service")
  >("@/services/api-keys/api-keys.service")
  return {
    ...actual,
    listApiKeys: (...a: unknown[]) => listApiKeys(...a),
    createApiKey: (...a: unknown[]) => createApiKey(...a),
    revokeApiKey: (...a: unknown[]) => revokeApiKey(...a),
  }
})

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

describe("ApiKeyManager", () => {
  beforeEach(() => {
    listApiKeys.mockReset()
    createApiKey.mockReset()
    revokeApiKey.mockReset()
  })

  it("renders empty state with a 'Create your first key' CTA", async () => {
    listApiKeys.mockResolvedValueOnce([])

    render(<ApiKeyManager />)

    await waitFor(() => {
      expect(screen.getByText("No API keys yet")).toBeInTheDocument()
    })
    expect(
      screen.getByRole("button", { name: /Create your first key/i })
    ).toBeInTheDocument()
  })

  it("renders a list of existing keys with status chips", async () => {
    listApiKeys.mockResolvedValueOnce([
      {
        id: "key-1",
        name: "Production",
        prefix: "ck_live_aaaaaaaa",
        scopes: ["memories.read", "search"],
        organization_id: null,
        last_used_at: null,
        revoked_at: null,
        created_at: "2026-04-29T10:00:00.000Z",
      },
      {
        id: "key-2",
        name: "Old laptop",
        prefix: "ck_live_bbbbbbbb",
        scopes: ["search"],
        organization_id: null,
        last_used_at: null,
        revoked_at: "2026-04-20T10:00:00.000Z",
        created_at: "2026-03-01T10:00:00.000Z",
      },
    ])

    render(<ApiKeyManager />)

    await waitFor(() => {
      expect(screen.getByText("Production")).toBeInTheDocument()
      expect(screen.getByText("Old laptop")).toBeInTheDocument()
    })

    expect(screen.getByText("Active")).toBeInTheDocument()
    expect(screen.getByText("Revoked")).toBeInTheDocument()
  })

  it("creates a key and reveals the plaintext exactly once with copy + curl helpers", async () => {
    listApiKeys.mockResolvedValueOnce([])
    createApiKey.mockResolvedValueOnce({
      id: "key-new",
      name: "Demo",
      prefix: "ck_live_demoabcd",
      scopes: ["memories.read", "search"],
      organization_id: null,
      last_used_at: null,
      revoked_at: null,
      created_at: "2026-05-02T10:00:00.000Z",
      token: "ck_live_demoabcd_full_secret_value",
    })
    listApiKeys.mockResolvedValue([
      {
        id: "key-new",
        name: "Demo",
        prefix: "ck_live_demoabcd",
        scopes: ["memories.read", "search"],
        organization_id: null,
        last_used_at: null,
        revoked_at: null,
        created_at: "2026-05-02T10:00:00.000Z",
      },
    ])

    render(<ApiKeyManager />)

    await waitFor(() => {
      expect(screen.getByText("No API keys yet")).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole("button", { name: /\+ Create API key/i }))

    await waitFor(() => {
      expect(screen.getByLabelText(/^Name$/i)).toBeInTheDocument()
    })
    fireEvent.change(screen.getByLabelText(/^Name$/i), {
      target: { value: "Demo" },
    })
    fireEvent.click(screen.getByRole("button", { name: /^Create$/i }))

    await waitFor(() => {
      expect(createApiKey).toHaveBeenCalledWith({
        name: "Demo",
        scopes: ["memories.read", "search"],
        organizationId: undefined,
      })
    })

    // Plaintext token revealed exactly once
    await waitFor(() => {
      expect(screen.getByTestId("plaintext-api-key")).toHaveTextContent(
        "ck_live_demoabcd_full_secret_value"
      )
    })

    // Done button is disabled until acknowledged
    const doneButton = screen.getByRole("button", { name: /^Done$/i })
    expect(doneButton).toBeDisabled()

    // Acknowledge -> Done becomes enabled
    fireEvent.click(screen.getByLabelText(/I've saved this key/i))
    expect(doneButton).not.toBeDisabled()

    // Curl helper is rendered with the user's actual key substituted
    expect(
      screen.getByText(
        (_text, node) =>
          (node?.textContent ?? "").includes(
            "Authorization: Bearer ck_live_demoabcd_full_secret_value"
          ) && node?.tagName === "PRE"
      )
    ).toBeInTheDocument()
  })

  it("requires confirm-dialog acknowledgement before revoking a key", async () => {
    listApiKeys.mockResolvedValueOnce([
      {
        id: "key-1",
        name: "Production",
        prefix: "ck_live_aaaaaaaa",
        scopes: ["memories.read"],
        organization_id: null,
        last_used_at: null,
        revoked_at: null,
        created_at: "2026-04-29T10:00:00.000Z",
      },
    ])
    listApiKeys.mockResolvedValue([])
    revokeApiKey.mockResolvedValueOnce(undefined)

    render(<ApiKeyManager />)

    await waitFor(() => {
      expect(screen.getByText("Production")).toBeInTheDocument()
    })

    // Click "Revoke" on the row — opens confirm dialog
    fireEvent.click(screen.getByRole("button", { name: /^Revoke$/i }))

    // Confirm dialog explains the action is irreversible
    await waitFor(() => {
      expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument()
    })

    // Service has NOT been called yet (we haven't confirmed)
    expect(revokeApiKey).not.toHaveBeenCalled()

    // Click the destructive Revoke in the dialog footer (second one)
    const revokeButtons = screen.getAllByRole("button", { name: /^Revoke$/i })
    fireEvent.click(revokeButtons[revokeButtons.length - 1])

    await waitFor(() => {
      expect(revokeApiKey).toHaveBeenCalledWith("key-1")
    })

    // List refreshed after revoke
    await waitFor(() => {
      expect(listApiKeys).toHaveBeenCalledTimes(2)
    })
  })

  it("scopes the create request to organizationId when provided", async () => {
    listApiKeys.mockResolvedValueOnce([])
    createApiKey.mockResolvedValueOnce({
      id: "key-org",
      name: "Backend service",
      prefix: "ck_live_orgxxxxx",
      scopes: ["memories.read", "search"],
      organization_id: "org-uuid-123",
      last_used_at: null,
      revoked_at: null,
      created_at: "2026-05-02T10:00:00.000Z",
      token: "ck_live_orgxxxxx_full_secret",
    })
    listApiKeys.mockResolvedValue([])

    render(
      <ApiKeyManager organizationId="org-uuid-123" organizationLabel="acme" />
    )

    await waitFor(() => {
      expect(listApiKeys).toHaveBeenCalledWith("org-uuid-123")
    })

    fireEvent.click(screen.getByRole("button", { name: /\+ Create API key/i }))
    await waitFor(() => {
      expect(screen.getByLabelText(/^Name$/i)).toBeInTheDocument()
    })
    fireEvent.change(screen.getByLabelText(/^Name$/i), {
      target: { value: "Backend service" },
    })
    fireEvent.click(screen.getByRole("button", { name: /^Create$/i }))

    await waitFor(() => {
      expect(createApiKey).toHaveBeenCalledWith({
        name: "Backend service",
        scopes: ["memories.read", "search"],
        organizationId: "org-uuid-123",
      })
    })
  })
})
