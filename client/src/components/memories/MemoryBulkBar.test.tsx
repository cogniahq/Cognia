import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { MemoryBulkBar } from "./MemoryBulkBar"

vi.mock("@/services/memory-v2.service", () => ({
  memoryV2Service: {
    bulkDelete: vi.fn(async () => ({ success: true, deleted: 2 })),
  },
}))

describe("MemoryBulkBar", () => {
  it("renders nothing when no rows selected", () => {
    const { container } = render(
      <MemoryBulkBar selectedIds={[]} onCleared={() => {}} />
    )
    expect(container.firstChild).toBeNull()
  })

  it("renders the selection count and triggers onCleared via the Clear button", () => {
    const onCleared = vi.fn()
    render(
      <MemoryBulkBar selectedIds={["a", "b", "c"]} onCleared={onCleared} />
    )

    expect(screen.getByText("3")).toBeInTheDocument()
    expect(screen.getByText(/selected/i)).toBeInTheDocument()
    expect(screen.getByTestId("bulk-delete-button")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /clear/i }))
    expect(onCleared).toHaveBeenCalledTimes(1)
  })
})
