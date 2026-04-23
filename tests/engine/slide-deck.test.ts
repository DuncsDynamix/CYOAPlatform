import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/db/prisma", () => ({
  db: {
    experienceSession: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock("@/lib/engine/session", async () => {
  const actual = await vi.importActual<typeof import("@/lib/engine/session")>("@/lib/engine/session")
  return {
    ...actual,
    getSession: vi.fn(),
    updateSessionState: vi.fn().mockResolvedValue(undefined),
  }
})

vi.mock("@/lib/analytics", () => ({
  trackEvent: vi.fn(),
}))

import { arriveAtNode } from "@/lib/engine/executor"
import { getSession } from "@/lib/engine/session"
import { createTestExperience, createTestSession } from "@/tests/helpers/factories"
import type { SlideDeckNode, Slide } from "@/types/experience"

const mockGetSession = vi.mocked(getSession)

beforeEach(() => {
  vi.clearAllMocks()
})

describe("SLIDE_DECK engine branch", () => {
  const slides: Slide[] = [
    { id: "s1", template: "title", title: "Welcome", body: "Intro" },
    { id: "s2", template: "image-left", title: "Safety", body: "Rules", mediaUrl: "/uploads/a.png" },
    { id: "s3", template: "text-only", body: "Summary" },
  ]

  const deckNode: SlideDeckNode = {
    id: "deck-1",
    type: "SLIDE_DECK",
    label: "Opening deck",
    slides,
    nextNodeId: "after-deck",
  }

  it("resolves a SLIDE_DECK node to a slide_deck payload without throwing", async () => {
    const experience = createTestExperience({ nodes: [deckNode] })
    const session = createTestSession({ currentNodeId: "deck-1" })
    mockGetSession.mockResolvedValue(session)

    const result = await arriveAtNode(session.id, "deck-1", experience)

    expect(result.content.type).toBe("slide_deck")
    if (result.content.type === "slide_deck") {
      expect(result.content.slides).toEqual(slides)
      expect(result.content.nextNodeId).toBe("after-deck")
    }
    expect(result.node.id).toBe("deck-1")
  })

  it("passes through an empty slide list without error", async () => {
    const emptyDeck: SlideDeckNode = { ...deckNode, id: "deck-empty", slides: [], nextNodeId: "next" }
    const experience = createTestExperience({ nodes: [emptyDeck] })
    const session = createTestSession({ currentNodeId: "deck-empty" })
    mockGetSession.mockResolvedValue(session)

    const result = await arriveAtNode(session.id, "deck-empty", experience)

    expect(result.content.type).toBe("slide_deck")
    if (result.content.type === "slide_deck") {
      expect(result.content.slides).toEqual([])
      expect(result.content.nextNodeId).toBe("next")
    }
  })
})
