import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act } from "@testing-library/react"

vi.mock("@/lib/voice/client", () => ({
  fetchActorAudio: vi.fn(),
}))

const { fetchActorAudio } = await import("@/lib/voice/client")
const { useActorVoice } = await import("@/components/training/useActorVoice")

const mockFetchActorAudio = vi.mocked(fetchActorAudio)

// ─── AUDIO STUB ──────────────────────────────────────────────────────────────

class MockAudio {
  static instances: MockAudio[] = []
  src: string
  onended: (() => void) | null = null
  play = vi.fn().mockResolvedValue(undefined)
  pause = vi.fn()
  constructor(src: string) {
    this.src = src
    MockAudio.instances.push(this)
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  MockAudio.instances = []
  vi.stubGlobal("Audio", MockAudio)
  URL.createObjectURL = vi.fn().mockReturnValue("blob:mock-audio")
  URL.revokeObjectURL = vi.fn()
})

// ─── TESTS ───────────────────────────────────────────────────────────────────

describe("useActorVoice", () => {
  it("fetches and plays audio for a spoken line", async () => {
    mockFetchActorAudio.mockResolvedValue({ kind: "audio", blob: new Blob(["x"], { type: "audio/mpeg" }) })
    const { result } = renderHook(() => useActorVoice("session-1"))

    await act(() => result.current.speak("Margaret Ellery", "Hello, love."))

    expect(mockFetchActorAudio).toHaveBeenCalledWith("session-1", "Margaret Ellery", "Hello, love.")
    expect(MockAudio.instances).toHaveLength(1)
    expect(MockAudio.instances[0].src).toBe("blob:mock-audio")
    expect(MockAudio.instances[0].play).toHaveBeenCalled()
  })

  it("does not fetch when the user has muted voice", async () => {
    const { result } = renderHook(() => useActorVoice("session-1"))

    act(() => result.current.toggle())
    await act(() => result.current.speak("Margaret Ellery", "Hello."))

    expect(result.current.voiceOn).toBe(false)
    expect(mockFetchActorAudio).not.toHaveBeenCalled()
  })

  it("stops asking after the server reports voice disabled", async () => {
    mockFetchActorAudio.mockResolvedValue({ kind: "disabled" })
    const { result } = renderHook(() => useActorVoice("session-1"))

    await act(() => result.current.speak("Margaret Ellery", "One."))
    await act(() => result.current.speak("Margaret Ellery", "Two."))

    expect(mockFetchActorAudio).toHaveBeenCalledTimes(1)
    expect(result.current.available).toBe(false)
  })

  it("keeps trying after a transient failure", async () => {
    mockFetchActorAudio.mockResolvedValue({ kind: "unavailable" })
    const { result } = renderHook(() => useActorVoice("session-1"))

    await act(() => result.current.speak("Margaret Ellery", "One."))
    await act(() => result.current.speak("Margaret Ellery", "Two."))

    expect(mockFetchActorAudio).toHaveBeenCalledTimes(2)
    expect(result.current.available).toBe(true)
  })

  it("pauses current playback when muted mid-line", async () => {
    mockFetchActorAudio.mockResolvedValue({ kind: "audio", blob: new Blob(["x"], { type: "audio/mpeg" }) })
    const { result } = renderHook(() => useActorVoice("session-1"))

    await act(() => result.current.speak("Margaret Ellery", "A long line."))
    act(() => result.current.toggle())

    expect(MockAudio.instances[0].pause).toHaveBeenCalled()
  })

  it("replaces current playback when a new line is spoken", async () => {
    mockFetchActorAudio.mockResolvedValue({ kind: "audio", blob: new Blob(["x"], { type: "audio/mpeg" }) })
    const { result } = renderHook(() => useActorVoice("session-1"))

    await act(() => result.current.speak("Margaret Ellery", "First."))
    await act(() => result.current.speak("Margaret Ellery", "Second."))

    expect(MockAudio.instances).toHaveLength(2)
    expect(MockAudio.instances[0].pause).toHaveBeenCalled()
  })
})
