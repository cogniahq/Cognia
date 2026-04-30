import { render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import ActivityTab from "./ActivityTab"

vi.mock("@/services/org-admin.service", () => ({
  orgAdminService: {
    getActivity: vi.fn(async () => ({
      success: true,
      data: [
        {
          id: "a1",
          event_type: "login_success",
          event_category: "authentication",
          action: "login",
          actor_email: "jane@x.io",
          created_at: "2026-04-29T10:00:00.000Z",
          metadata: null,
          user_id: "u1",
          organization_id: "o1",
          target_user_id: null,
          target_resource_type: null,
          target_resource_id: null,
          ip_address: "127.0.0.1",
          user_agent: null,
          user: { id: "u1", email: "jane@x.io" },
        },
      ],
      pagination: { total: 1, limit: 50, offset: 0 },
    })),
    activityCsvUrl: vi.fn(() => "http://test/csv"),
  },
}))

describe("ActivityTab", () => {
  it("renders a row from the API", async () => {
    render(<ActivityTab slug="acme" />)
    await waitFor(() => {
      expect(screen.getByText("login_success")).toBeInTheDocument()
      expect(screen.getByText("jane@x.io")).toBeInTheDocument()
    })
  })

  it("renders an Export CSV link", async () => {
    render(<ActivityTab slug="acme" />)
    await waitFor(() => {
      expect(screen.getByText("Export CSV")).toBeInTheDocument()
    })
    const link = screen.getByText("Export CSV").closest("a")
    expect(link).toHaveAttribute("href", "http://test/csv")
  })
})
