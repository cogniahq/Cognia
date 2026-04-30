import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

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
