import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, cleanup, act } from "@testing-library/react"
import { TurningLeaf } from "@/components/reader/TurningLeaf"

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe("TurningLeaf", () => {
  it("stages in-fiction messages as elapsed time grows, then loops the rotation", () => {
    vi.useFakeTimers()
    render(<TurningLeaf />)

    expect(screen.getByText("Turning the page…")).toBeInTheDocument()

    act(() => { vi.advanceTimersByTime(2500) })
    expect(screen.getByText(/ink is still wet/i)).toBeInTheDocument()

    act(() => { vi.advanceTimersByTime(9000 - 2500) })
    expect(screen.getByText("The scribe does not hurry.")).toBeInTheDocument()

    act(() => { vi.advanceTimersByTime(7000) })
    expect(screen.getByText("Somewhere, a quill scratches on.")).toBeInTheDocument()
  })

  it("clears all timers on unmount without warning", () => {
    vi.useFakeTimers()
    const { unmount } = render(<TurningLeaf />)
    unmount()
    // If a timer fired after unmount and called setState, React would emit an
    // act() warning captured as a console.error — assert none was logged.
    const errorSpy = vi.spyOn(console, "error")
    act(() => { vi.advanceTimersByTime(60_000) })
    expect(errorSpy).not.toHaveBeenCalled()
  })
})
