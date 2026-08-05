import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { NextRequest } from "next/server"
import type { Actor, ExperienceContextPack } from "@/types/experience"

// ─── MOCK SETUP (follows tests/api/engine.test.ts convention) ────────────────

vi.mock("@/lib/engine/session", () => ({
  getSession: vi.fn(),
}))

vi.mock("@/lib/db/queries/experience", () => ({
  getExperienceById: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn().mockResolvedValue(null),
  canAccessSession: vi.fn().mockResolvedValue(true),
}))

vi.mock("@/lib/security/ratelimit", () => ({
  checkEngineLimit: vi.fn().mockResolvedValue({ success: true }),
}))

// Import after mocks are registered
const { POST } = await import("@/app/api/v1/voice/tts/route")
const { getSession } = await import("@/lib/engine/session")
const { getExperienceById } = await import("@/lib/db/queries/experience")
const { canAccessSession } = await import("@/lib/auth")
const { createTestExperience, createTestSession } = await import("../helpers/factories")

const mockGetSession = vi.mocked(getSession)
const mockGetExperienceById = vi.mocked(getExperienceById)
const mockCanAccessSession = vi.mocked(canAccessSession)

// ─── HELPERS ─────────────────────────────────────────────────────────────────

const SESSION_ID = "550e8400-e29b-41d4-a716-446655440010"

function actorWithVoice(overrides: Partial<Actor> = {}): Actor {
  return {
    name: "Margaret Ellery",
    role: "Client",
    personality: "p",
    speech: "s",
    knowledge: "k",
    relationshipToProtagonist: "r",
    voice: { vendorVoiceId: "voice-margaret" },
    ...overrides,
  }
}

function packWith(actors: Actor[]): ExperienceContextPack {
  return {
    world: { description: "w", rules: "r", atmosphere: "a" },
    actors,
    protagonist: { perspective: "you", role: "carer", knowledge: "k", goal: "g" },
    style: {
      tone: "t",
      language: "en-GB",
      register: "professional",
      targetLength: { min: 100, max: 200 },
      styleNotes: "n",
    },
    groundTruth: [],
    scripts: [],
  }
}

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/v1/voice/tts", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  })
}

function wireHappyPath() {
  mockGetSession.mockResolvedValue(createTestSession())
  mockGetExperienceById.mockResolvedValue(
    createTestExperience({
      contextPack: packWith([actorWithVoice()]),
    })
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockCanAccessSession.mockResolvedValue(true)
  vi.stubEnv("ELEVENLABS_API_KEY", "el-test-key")
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(new Uint8Array([9, 9, 9]).buffer, {
        status: 200,
        headers: { "Content-Type": "audio/mpeg" },
      })
    )
  )
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

// ─── TESTS ───────────────────────────────────────────────────────────────────

describe("POST /api/v1/voice/tts", () => {
  it("returns 501 when voice is not enabled, before touching the session", async () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "")
    const res = await POST(
      makeRequest({ sessionId: SESSION_ID, actorName: "Margaret Ellery", text: "hello" })
    )
    expect(res.status).toBe(501)
    expect(mockGetSession).not.toHaveBeenCalled()
  })

  it("returns 400 when the text exceeds the length cap", async () => {
    const res = await POST(
      makeRequest({ sessionId: SESSION_ID, actorName: "Margaret Ellery", text: "x".repeat(1201) })
    )
    expect(res.status).toBe(400)
  })

  it("returns 404 when the session does not exist", async () => {
    mockGetSession.mockResolvedValue(null)
    const res = await POST(
      makeRequest({ sessionId: SESSION_ID, actorName: "Margaret Ellery", text: "hello" })
    )
    expect(res.status).toBe(404)
  })

  it("returns 403 when the caller cannot access the session", async () => {
    wireHappyPath()
    mockCanAccessSession.mockResolvedValue(false)
    const res = await POST(
      makeRequest({ sessionId: SESSION_ID, actorName: "Margaret Ellery", text: "hello" })
    )
    expect(res.status).toBe(403)
  })

  it("returns 404 when no voice resolves for the named actor", async () => {
    vi.stubEnv("ELEVENLABS_DEFAULT_VOICE_ID", "")
    mockGetSession.mockResolvedValue(createTestSession())
    mockGetExperienceById.mockResolvedValue(
      createTestExperience({
        contextPack: packWith([actorWithVoice({ voice: undefined })]),
      })
    )
    const res = await POST(
      makeRequest({ sessionId: SESSION_ID, actorName: "Margaret Ellery", text: "hello" })
    )
    expect(res.status).toBe(404)
  })

  it("returns synthesised audio with an audio/mpeg content type on the happy path", async () => {
    wireHappyPath()
    const res = await POST(
      makeRequest({ sessionId: SESSION_ID, actorName: "Margaret Ellery", text: "Don't fuss." })
    )
    expect(res.status).toBe(200)
    expect(res.headers.get("Content-Type")).toBe("audio/mpeg")
    const body = new Uint8Array(await res.arrayBuffer())
    expect(body).toEqual(new Uint8Array([9, 9, 9]))
    // The vendor was called with the actor's cast voice
    const fetchMock = vi.mocked(global.fetch)
    expect(String(fetchMock.mock.calls[0][0])).toContain("voice-margaret")
  })
})
