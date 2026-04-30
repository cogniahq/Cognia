import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { MemoriesEmptyState } from "./MemoriesEmptyState"

describe("MemoriesEmptyState", () => {
  it("renders the install-extension CTA", () => {
    render(<MemoriesEmptyState />)
    expect(
      screen.getByRole("heading", { name: /no memories yet/i })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /install the extension/i })
    ).toBeInTheDocument()
  })

  it("invokes the override CTA handler when provided", () => {
    const onInstall = vi.fn()
    const onCreate = vi.fn()
    render(
      <MemoriesEmptyState
        onInstallExtension={onInstall}
        onCreateMemory={onCreate}
      />
    )
    fireEvent.click(
      screen.getByRole("button", { name: /install the extension/i })
    )
    fireEvent.click(screen.getByRole("button", { name: /add a memory/i }))
    expect(onInstall).toHaveBeenCalledTimes(1)
    expect(onCreate).toHaveBeenCalledTimes(1)
  })
})
