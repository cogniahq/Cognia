import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { MemoryEditDialog } from "./MemoryEditDialog"

vi.mock("@/services/memory-v2.service", () => ({
  memoryV2Service: {
    update: vi.fn(async () => ({ success: true, data: { id: "m1" } })),
  },
}))

vi.mock("@/services/tag.service", () => ({
  tagService: {
    list: vi.fn(async () => ({ success: true, data: [] })),
    create: vi.fn(),
    attach: vi.fn(),
    detach: vi.fn(),
  },
}))

describe("MemoryEditDialog", () => {
  it("renders title and content fields when open with seed values", () => {
    render(
      <MemoryEditDialog
        open={true}
        onOpenChange={() => {}}
        memory={{
          id: "m1",
          title: "old title",
          content: "old body",
          full_content: null,
        }}
      />
    )

    expect(screen.getByDisplayValue("old title")).toBeInTheDocument()
    expect(screen.getByTestId("memory-edit-content")).toHaveValue("old body")
    expect(
      screen.getByRole("heading", { name: /edit memory/i })
    ).toBeInTheDocument()
  })

  it("does not render dialog content when closed", () => {
    render(
      <MemoryEditDialog
        open={false}
        onOpenChange={() => {}}
        memory={{
          id: "m1",
          title: "anything",
          content: "anything",
          full_content: null,
        }}
      />
    )

    expect(
      screen.queryByRole("heading", { name: /edit memory/i })
    ).not.toBeInTheDocument()
  })
})
