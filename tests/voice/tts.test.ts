import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import type { ExperienceContextPack, Actor } from "@/types/experience"

const { isVoiceEnabled, resolveActorVoice, synthesizeSpeech } = await import("@/lib/voice/tts")

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function makeActor(overrides: Partial<Actor> = {}): Actor {
  return {
    name: "Margaret Ellery",
    role: "Client",
    personality: "Private, proud",
    speech: "Deflects with small talk",
    knowledge: "Knows about the money",
    relationshipToProtagonist: "Trusts her carer",
    ...overrides,
  }
}

function makePack(actors: Actor[]): ExperienceContextPack {
  return {
    world: { description: "w", rules: "r", atmosphere: "a" },
    actors,
    protagonist: { perspective: "you", role: "carer", knowledge: "k", goal: "g" },
    style: {
      tone: "quiet",
      language: "en-GB",
      register: "professional",
      targetLength: { min: 100, max: 200 },
      styleNotes: "n",
    },
    groundTruth: [],
    scripts: [],
  }
}

beforeEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

// ─── ENABLEMENT ──────────────────────────────────────────────────────────────

describe("isVoiceEnabled", () => {
  it("is disabled when ELEVENLABS_API_KEY is not set", () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "")
    expect(isVoiceEnabled()).toBe(false)
  })

  it("is enabled when ELEVENLABS_API_KEY is set", () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "el-test-key")
    expect(isVoiceEnabled()).toBe(true)
  })
})

// ─── VOICE RESOLUTION ────────────────────────────────────────────────────────

describe("resolveActorVoice", () => {
  it("returns the actor's cast voice id when a voice profile is set", () => {
    const pack = makePack([
      makeActor({ voice: { vendorVoiceId: "voice-margaret" } }),
    ])
    expect(resolveActorVoice(pack, "Margaret Ellery")).toBe("voice-margaret")
  })

  it("falls back to the env default voice when the actor has no profile", () => {
    vi.stubEnv("ELEVENLABS_DEFAULT_VOICE_ID", "voice-default")
    const pack = makePack([makeActor()])
    expect(resolveActorVoice(pack, "Margaret Ellery")).toBe("voice-default")
  })

  it("returns null when the actor has no profile and no default is configured", () => {
    vi.stubEnv("ELEVENLABS_DEFAULT_VOICE_ID", "")
    const pack = makePack([makeActor()])
    expect(resolveActorVoice(pack, "Margaret Ellery")).toBeNull()
  })

  it("returns null for an actor that does not exist in the pack, even with a default configured", () => {
    vi.stubEnv("ELEVENLABS_DEFAULT_VOICE_ID", "voice-default")
    const pack = makePack([makeActor()])
    expect(resolveActorVoice(pack, "Nobody Real")).toBeNull()
  })
})

// ─── SYNTHESIS ───────────────────────────────────────────────────────────────

describe("synthesizeSpeech", () => {
  it("posts the text to the vendor voice endpoint with the api key and returns audio bytes", async () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "el-test-key")
    const audio = new Uint8Array([1, 2, 3]).buffer
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(audio, { status: 200, headers: { "Content-Type": "audio/mpeg" } })
    )
    vi.stubGlobal("fetch", mockFetch)

    const result = await synthesizeSpeech("Don't fuss about me, love.", "voice-margaret")

    expect(new Uint8Array(result)).toEqual(new Uint8Array([1, 2, 3]))
    const [url, init] = mockFetch.mock.calls[0]
    expect(String(url)).toContain("/v1/text-to-speech/voice-margaret")
    expect(init.method).toBe("POST")
    expect(init.headers["xi-api-key"]).toBe("el-test-key")
    expect(JSON.parse(init.body).text).toBe("Don't fuss about me, love.")
  })

  it("throws with the vendor status when synthesis fails", async () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "el-test-key")
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("nope", { status: 401 }))
    )

    await expect(synthesizeSpeech("hello", "voice-x")).rejects.toThrow(/401/)
  })

  it("throws immediately when voice is not enabled, without calling the vendor", async () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "")
    const mockFetch = vi.fn()
    vi.stubGlobal("fetch", mockFetch)

    await expect(synthesizeSpeech("hello", "voice-x")).rejects.toThrow(/not enabled/i)
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
