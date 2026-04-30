import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import UsageBurndownCard from "./UsageBurndownCard"

describe("UsageBurndownCard", () => {
  it("renders the unlimited badge when limit is -1", () => {
    render(<UsageBurndownCard label="Memories" current={42} limit={-1} />)
    // The badge text is uppercase via CSS but in DOM is "Unlimited" — there
    // are two matches (badge + count fallback), so assert at least one exists.
    expect(screen.getAllByText(/unlimited/i).length).toBeGreaterThan(0)
    // No progress bar when unlimited
    expect(screen.queryByTestId("usage-progress")).not.toBeInTheDocument()
  })

  it("renders the at-limit badge when current >= limit (and limit !== -1)", () => {
    render(<UsageBurndownCard label="Seats" current={10} limit={10} />)
    expect(screen.getByTestId("at-limit-badge")).toBeInTheDocument()
    expect(screen.getByText(/at limit/i)).toBeInTheDocument()
  })

  it("renders count and limit normally below the limit", () => {
    render(<UsageBurndownCard label="Integrations" current={2} limit={5} />)
    expect(screen.getByText("2")).toBeInTheDocument()
    expect(screen.getByText(/\/\s*5/)).toBeInTheDocument()
    expect(screen.queryByTestId("at-limit-badge")).not.toBeInTheDocument()
    expect(screen.getByTestId("usage-progress")).toBeInTheDocument()
  })
})
