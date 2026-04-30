import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { Can } from "./Can"

const useHasPermissionMock = vi.fn<(p: string) => boolean>()

vi.mock("@/hooks/use-permissions", () => ({
  useHasPermission: (p: string) => useHasPermissionMock(p),
}))

describe("Can", () => {
  beforeEach(() => {
    useHasPermissionMock.mockReset()
  })

  it("renders children when permission matches", () => {
    useHasPermissionMock.mockImplementation((p) => p === "memory.write")
    render(
      <Can permission="memory.write">
        <div>visible</div>
      </Can>
    )
    expect(screen.getByText("visible")).toBeInTheDocument()
  })

  it("renders fallback when permission denied", () => {
    useHasPermissionMock.mockImplementation(() => false)
    render(
      <Can permission="memory.delete" fallback={<div>denied</div>}>
        <div>visible</div>
      </Can>
    )
    expect(screen.getByText("denied")).toBeInTheDocument()
    expect(screen.queryByText("visible")).not.toBeInTheDocument()
  })

  it("renders nothing by default when permission denied and no fallback", () => {
    useHasPermissionMock.mockImplementation(() => false)
    const { container } = render(
      <Can permission="member.remove">
        <span data-testid="forbidden">should not render</span>
      </Can>
    )
    expect(screen.queryByTestId("forbidden")).not.toBeInTheDocument()
    // Only React fragment, no children -> empty container
    expect(container.firstChild).toBeNull()
  })
})
