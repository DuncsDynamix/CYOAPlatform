import { describe, it, expect, vi } from "vitest"
import { render, screen, act } from "@testing-library/react"
import { Opening } from "@/components/reader/Opening"

class FakeEventSource {
  static last: FakeEventSource | null = null
  onmessage: ((e: { data: string }) => void) | null = null
  onerror: (() => void) | null = null
  constructor(public url: string) { FakeEventSource.last = this }
  close = vi.fn()
}

describe("Opening", () => {
  it("plays ritual messages from the stream and fires onReady on ready", () => {
    vi.useFakeTimers()
    vi.stubGlobal("EventSource", FakeEventSource as unknown as typeof EventSource)
    const onReady = vi.fn()
    render(<Opening sessionId="s1" genre="fantasy" title="The Hollow Crown" author="D. Brown" onReady={onReady} />)

    expect(screen.getByRole("img", { name: /the hollow crown/i })).toBeInTheDocument()

    act(() => FakeEventSource.last!.onmessage!({ data: JSON.stringify({ status: "progress", progress: 60, message: "The story stirs..." }) }))
    expect(screen.getByText(/story stirs/i)).toBeInTheDocument()

    act(() => FakeEventSource.last!.onmessage!({ data: JSON.stringify({ status: "ready", progress: 100, sessionId: "s1" }) }))
    // 400ms settle beat: the reader sees the rule reach 100% before the page turns.
    expect(onReady).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(400))
    expect(onReady).toHaveBeenCalled()
    vi.useRealTimers()
  })

  it("falls through to onReady on stream error (content already cached)", () => {
    vi.stubGlobal("EventSource", FakeEventSource as unknown as typeof EventSource)
    const onReady = vi.fn()
    render(<Opening sessionId="s1" genre="fantasy" title="The Hollow Crown" author="D. Brown" onReady={onReady} />)
    act(() => FakeEventSource.last!.onerror!())
    expect(onReady).toHaveBeenCalled()
  })
})
