import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"

import { ErrorBoundary } from "./ErrorBoundary"

function Bomb(): never {
  throw new Error("boom")
}

describe("ErrorBoundary", () => {
  it("renders fallback UI when a child throws", () => {
    const consoleErr = vi.spyOn(console, "error").mockImplementation(() => {})
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>
    )
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()
    consoleErr.mockRestore()
  })

  it("renders children when no error", () => {
    render(
      <ErrorBoundary>
        <div>hello</div>
      </ErrorBoundary>
    )
    expect(screen.getByText("hello")).toBeInTheDocument()
  })
})
