import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

const { fetchActorAudio } = await import("@/lib/voice/client")

beforeEach(() => vi.unstubAllGlobals())
afterEach(() => vi.unstubAllGlobals())

describe("fetchActorAudio", () => {
  it("returns an audio blob when synthesis succeeds", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(new Uint8Array([7, 7]).buffer, {
          status: 200,
          headers: { "Content-Type": "audio/mpeg" },
        })
      )
    )

    const result = await fetchActorAudio("session-1", "Margaret Ellery", "Hello, love.")

    expect(result.kind).toBe("audio")
    if (result.kind === "audio") {
      expect(result.blob.type).toBe("audio/mpeg")
      expect(result.blob.size).toBe(2)
    }
    const [url, init] = vi.mocked(global.fetch).mock.calls[0]
    expect(String(url)).toBe("/api/v1/voice/tts")
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      sessionId: "session-1",
      actorName: "Margaret Ellery",
      text: "Hello, love.",
    })
  })

  it("reports voice as disabled on 501 so the caller stops asking", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 501 })))
    const result = await fetchActorAudio("session-1", "Margaret Ellery", "hi")
    expect(result.kind).toBe("disabled")
  })

  it("reports voice as disabled on 404 (uncast actor)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 404 })))
    const result = await fetchActorAudio("session-1", "Margaret Ellery", "hi")
    expect(result.kind).toBe("disabled")
  })

  it("reports transient unavailability on server errors without disabling", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 502 })))
    const result = await fetchActorAudio("session-1", "Margaret Ellery", "hi")
    expect(result.kind).toBe("unavailable")
  })

  it("reports transient unavailability when the network throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("network down")))
    const result = await fetchActorAudio("session-1", "Margaret Ellery", "hi")
    expect(result.kind).toBe("unavailable")
  })
})
