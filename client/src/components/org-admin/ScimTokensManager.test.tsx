import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import ScimTokensManager from "./ScimTokensManager"

const listScimTokens = vi.fn()
const createScimToken = vi.fn()
const revokeScimToken = vi.fn()

vi.mock("@/services/identity.service", () => ({
  identityService: {
    listScimTokens: (...a: unknown[]) => listScimTokens(...a),
    createScimToken: (...a: unknown[]) => createScimToken(...a),
    revokeScimToken: (...a: unknown[]) => revokeScimToken(...a),
  },
}))

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

describe("ScimTokensManager", () => {
  beforeEach(() => {
    listScimTokens.mockReset()
    createScimToken.mockReset()
    revokeScimToken.mockReset()
  })

  it("renders existing tokens from the API", async () => {
    listScimTokens.mockResolvedValueOnce({
      success: true,
      data: [
        {
          id: "tok-1",
          prefix: "scim_abc",
          name: "Okta production",
          last_used_at: "2026-04-29T10:00:00.000Z",
          revoked_at: null,
        },
        {
          id: "tok-2",
          prefix: "scim_def",
          name: "Old token",
          last_used_at: null,
          revoked_at: "2026-04-20T10:00:00.000Z",
        },
      ],
    })

    render(<ScimTokensManager slug="acme" />)

    await waitFor(() => {
      expect(screen.getByText("Okta production")).toBeInTheDocument()
      expect(screen.getByText("Old token")).toBeInTheDocument()
    })

    expect(screen.getByText("Active")).toBeInTheDocument()
    expect(screen.getByText("Revoked")).toBeInTheDocument()
  })

  it("creates a token and shows the plaintext once", async () => {
    listScimTokens.mockResolvedValue({ success: true, data: [] })
    createScimToken.mockResolvedValueOnce({
      success: true,
      data: {
        id: "tok-new",
        prefix: "scim_new",
        name: "New",
        token: "scim_new_full_secret_value",
      },
    })

    render(<ScimTokensManager slug="acme" />)

    await waitFor(() => {
      expect(screen.getByText("No SCIM tokens yet.")).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole("button", { name: /\+ New token/ }))

    // Modal is open — type a name and submit
    await waitFor(() => {
      expect(screen.getByLabelText(/Name \(optional\)/i)).toBeInTheDocument()
    })
    fireEvent.change(screen.getByLabelText(/Name \(optional\)/i), {
      target: { value: "New" },
    })
    fireEvent.click(screen.getByRole("button", { name: /Generate/i }))

    await waitFor(() => {
      expect(createScimToken).toHaveBeenCalledWith("acme", "New")
    })

    // Plaintext token revealed exactly once
    await waitFor(() => {
      expect(screen.getByText("scim_new_full_secret_value")).toBeInTheDocument()
    })
  })

  it("revokes a token via the service", async () => {
    listScimTokens.mockResolvedValueOnce({
      success: true,
      data: [
        {
          id: "tok-1",
          prefix: "scim_abc",
          name: "Active token",
          last_used_at: null,
          revoked_at: null,
        },
      ],
    })
    listScimTokens.mockResolvedValue({ success: true, data: [] })
    revokeScimToken.mockResolvedValueOnce({ success: true })

    render(<ScimTokensManager slug="acme" />)

    await waitFor(() => {
      expect(screen.getByText("Active token")).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole("button", { name: /Revoke/i }))

    await waitFor(() => {
      expect(revokeScimToken).toHaveBeenCalledWith("acme", "tok-1")
    })
  })
})
