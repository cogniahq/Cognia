import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { OAuthButton } from "./OAuthButton"

const oauthStartMock = vi.fn()

vi.mock("@/services/identity.service", () => ({
  identityService: {
    oauthStart: (...args: unknown[]) => oauthStartMock(...args),
  },
}))

describe("OAuthButton", () => {
  beforeEach(() => {
    oauthStartMock.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("renders Google variant with correct label", () => {
    render(<OAuthButton provider="google" />)
    expect(screen.getByText("Continue with Google")).toBeInTheDocument()
  })

  it("renders Microsoft variant with correct label", () => {
    render(<OAuthButton provider="microsoft" />)
    expect(screen.getByText("Continue with Microsoft")).toBeInTheDocument()
  })

  it("calls identityService.oauthStart with provider + returnTo on click", () => {
    render(<OAuthButton provider="google" returnTo="/login" />)
    fireEvent.click(
      screen.getByRole("button", { name: /Continue with Google/i })
    )
    expect(oauthStartMock).toHaveBeenCalledTimes(1)
    expect(oauthStartMock).toHaveBeenCalledWith("google", "/login")
  })

  it("falls back to current location when returnTo is not provided", () => {
    render(<OAuthButton provider="microsoft" />)
    fireEvent.click(
      screen.getByRole("button", { name: /Continue with Microsoft/i })
    )
    expect(oauthStartMock).toHaveBeenCalledTimes(1)
    const [provider, returnTo] = oauthStartMock.mock.calls[0]
    expect(provider).toBe("microsoft")
    expect(typeof returnTo).toBe("string")
    expect(returnTo).toMatch(/\/?/)
  })

  it("respects disabled prop and does not fire", () => {
    render(<OAuthButton provider="google" disabled />)
    const button = screen.getByRole("button", { name: /Continue with Google/i })
    expect(button).toBeDisabled()
    fireEvent.click(button)
    expect(oauthStartMock).not.toHaveBeenCalled()
  })
})
