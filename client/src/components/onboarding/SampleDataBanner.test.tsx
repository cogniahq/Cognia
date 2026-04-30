import type { onboardingService as Service } from "@/services/onboarding.service"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { SampleDataBanner } from "./SampleDataBanner"

type ServiceShape = typeof Service

describe("SampleDataBanner", () => {
  it("hides itself when demoMemoryCount is zero", () => {
    const { container } = render(<SampleDataBanner demoMemoryCount={0} />)
    expect(container).toBeEmptyDOMElement()
  })

  it("calls dismissDemo on the service when the user clicks dismiss", async () => {
    const dismissDemo = vi.fn().mockResolvedValue({ success: true })
    const tourCompleted = vi.fn().mockResolvedValue({ success: true })
    const getState = vi.fn().mockResolvedValue({})
    const onDismissed = vi.fn()

    render(
      <SampleDataBanner
        demoMemoryCount={5}
        onDismissed={onDismissed}
        service={
          {
            dismissDemo,
            tourCompleted,
            getState,
          } as unknown as ServiceShape
        }
      />
    )

    const button = screen.getByRole("button", { name: /dismiss demo data/i })
    fireEvent.click(button)

    await waitFor(() => {
      expect(dismissDemo).toHaveBeenCalledTimes(1)
    })
    expect(onDismissed).toHaveBeenCalledTimes(1)
  })
})
