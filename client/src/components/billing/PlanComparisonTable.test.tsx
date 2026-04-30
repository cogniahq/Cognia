import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import PlanComparisonTable from "./PlanComparisonTable"

describe("PlanComparisonTable", () => {
  it("renders all 3 tiers", () => {
    render(<PlanComparisonTable />)
    expect(screen.getByTestId("plan-card-free")).toBeInTheDocument()
    expect(screen.getByTestId("plan-card-pro")).toBeInTheDocument()
    expect(screen.getByTestId("plan-card-enterprise")).toBeInTheDocument()
  })

  it("shows 'Current plan' for the current tier and CTAs for others", () => {
    render(<PlanComparisonTable currentPlanId="pro" />)
    // Pro card should not have a CTA — it's the current plan
    expect(screen.queryByTestId("plan-cta-pro")).not.toBeInTheDocument()
    // The other tiers should still show their CTA buttons
    expect(screen.getByTestId("plan-cta-free")).toBeInTheDocument()
    expect(screen.getByTestId("plan-cta-enterprise")).toBeInTheDocument()
    // "Current plan" badge appears
    expect(screen.getAllByText(/current plan/i).length).toBeGreaterThan(0)
  })

  it("invokes onUpgrade with the planId when a non-current CTA is clicked", () => {
    const onUpgrade = vi.fn()
    render(<PlanComparisonTable currentPlanId="free" onUpgrade={onUpgrade} />)
    fireEvent.click(screen.getByTestId("plan-cta-pro"))
    expect(onUpgrade).toHaveBeenCalledWith("pro")
  })
})
