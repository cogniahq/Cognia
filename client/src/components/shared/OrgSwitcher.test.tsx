import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import { OrgSwitcher } from "./OrgSwitcher"

// Mock the organization context with a manually-driven module mock so we can
// drive `selectOrganization` and inspect calls without spinning up the real
// provider (which performs network requests on mount).
const selectOrganization = vi.fn().mockResolvedValue(undefined)
const mockState = {
  organizations: [
    {
      id: "org-1",
      name: "Acme Inc.",
      slug: "acme",
      created_at: "2024-01-01",
      updated_at: "2024-01-01",
      userRole: "ADMIN" as const,
    },
    {
      id: "org-2",
      name: "Globex",
      slug: "globex",
      created_at: "2024-01-01",
      updated_at: "2024-01-01",
      userRole: "ADMIN" as const,
    },
  ],
  currentOrganization: null as null | {
    id: string
    name: string
    slug: string
  },
  isLoading: false,
  selectOrganization,
}

vi.mock("@/contexts/organization.context", () => ({
  useOrganization: () => mockState,
}))

// Avoid pulling in the full create-organization dialog (which depends on the
// real organization context for createOrganization).
vi.mock("@/components/organization/CreateOrganizationDialog", () => ({
  CreateOrganizationDialog: () => null,
}))

describe("OrgSwitcher", () => {
  beforeAll(() => {
    // Radix Popper / Dropdown leans on these DOM APIs which jsdom does not
    // implement. Provide no-op shims so the menu can mount.
    type ElementWithPointer = Element & {
      hasPointerCapture?: (id: number) => boolean
      releasePointerCapture?: (id: number) => void
      scrollIntoView?: () => void
    }
    const proto = window.HTMLElement.prototype as ElementWithPointer
    if (!proto.hasPointerCapture) {
      proto.hasPointerCapture = () => false
    }
    if (!proto.releasePointerCapture) {
      proto.releasePointerCapture = () => undefined
    }
    if (!proto.scrollIntoView) {
      proto.scrollIntoView = () => undefined
    }
  })

  beforeEach(() => {
    selectOrganization.mockClear()
    mockState.currentOrganization = null
  })

  it("renders the trigger label and lists Personal + workspaces when opened", async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <OrgSwitcher />
      </MemoryRouter>
    )

    const trigger = screen.getByRole("button", { name: /switch workspace/i })
    expect(trigger).toBeInTheDocument()
    expect(trigger.textContent || "").toMatch(/Personal/i)

    await user.click(trigger)

    await waitFor(() => {
      expect(screen.getByText("Acme Inc.")).toBeInTheDocument()
    })
    expect(screen.getByText("Globex")).toBeInTheDocument()
    // Personal pseudo-entry is also present in the dropdown.
    expect(screen.getAllByText(/personal/i).length).toBeGreaterThan(0)
  })

  it("calls selectOrganization when a workspace is clicked", async () => {
    const user = userEvent.setup()
    const onNavigate = vi.fn()
    render(
      <MemoryRouter>
        <OrgSwitcher onNavigate={onNavigate} />
      </MemoryRouter>
    )

    await user.click(screen.getByRole("button", { name: /switch workspace/i }))

    const acmeItem = await screen.findByText("Acme Inc.")
    await user.click(acmeItem)

    await waitFor(() => {
      expect(selectOrganization).toHaveBeenCalledWith("acme")
    })
    await waitFor(() => {
      expect(onNavigate).toHaveBeenCalledWith("/organization")
    })
  })
})
