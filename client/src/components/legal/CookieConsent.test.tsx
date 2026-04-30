import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { CookieConsent } from "./CookieConsent"

vi.mock("@/services/gdpr.service", () => ({
  gdprService: {
    recordConsent: vi.fn(async () => ({ success: true })),
  },
}))

beforeEach(() => {
  localStorage.clear()
})

describe("CookieConsent", () => {
  it("shows when no prior consent", () => {
    render(<CookieConsent />)
    expect(
      screen.getByRole("heading", { name: /cookies & analytics/i })
    ).toBeInTheDocument()
  })

  it("hides after Accept all and persists choice", () => {
    render(<CookieConsent />)
    fireEvent.click(screen.getByRole("button", { name: /accept all/i }))
    expect(
      screen.queryByRole("heading", { name: /cookies & analytics/i })
    ).toBeNull()
    expect(localStorage.getItem("cognia.consent.v1")).toBeTruthy()
  })
})
