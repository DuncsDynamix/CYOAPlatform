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
    vi.stubGlobal("EventSource", FakeEventSource as unknown as typeof EventSource)
    const onReady = vi.fn()
    render(<Opening sessionId="s1" genre="fantasy" onReady={onReady} />)

    act(() => FakeEventSource.last!.onmessage!({ data: JSON.stringify({ status: "progress", progress: 60, message: "The story stirs..." }) }))
    expect(screen.getByText(/story stirs/i)).toBeInTheDocument()

    act(() => FakeEventSource.last!.onmessage!({ data: JSON.stringify({ status: "ready", progress: 100, sessionId: "s1" }) }))
    expect(onReady).toHaveBeenCalled()
  })

  it("falls through to onReady on stream error (content already cached)", () => {
    vi.stubGlobal("EventSource", FakeEventSource as unknown as typeof EventSource)
    const onReady = vi.fn()
    render(<Opening sessionId="s1" genre="fantasy" onReady={onReady} />)
    act(() => FakeEventSource.last!.onerror!())
    expect(onReady).toHaveBeenCalled()
  })
})
