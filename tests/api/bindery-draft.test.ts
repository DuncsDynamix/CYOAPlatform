import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"
import type { BookOutline } from "@/lib/library/bindery"
import type { ChoiceNode, GeneratedNode, Segment } from "@/types/experience"

// ─── MOCK SETUP (follows tests/engine/generator.test.ts convention) ─────────

const mockMessagesCreate = vi.fn()

vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: mockMessagesCreate },
  })),
}))

vi.mock("@/lib/engine/queue", () => ({
  generationQueue: {
    add: (fn: () => unknown) => fn(),
  },
}))

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn(),
  canEditExperience: vi.fn(),
  getAnthropicKey: vi.fn().mockReturnValue("test-api-key"),
}))

// Import after mocks are registered
const { draftOutline, draftChapter, draftSinglePage, sampleTelling } = await import("@/lib/engine/bindery-draft")
const { POST: draftOutlineRoute } = await import("@/app/api/v1/bindery/outline/route")
const { POST: draftChapterRoute } = await import("@/app/api/v1/bindery/draft-chapter/route")
const { db } = await import("@/lib/db/prisma")
const { requireAuth, canEditExperience } = await import("@/lib/auth")
const { createTestExperience, createTestNodeGraph } = await import("../helpers/factories")

const mockFindExperience = vi.mocked(db.experience.findUnique)
const mockUpdateExperience = vi.mocked(db.experience.update)
const mockRequireAuth = vi.mocked(requireAuth)
const mockCanEditExperience = vi.mocked(canEditExperience)

// ─── FIXTURES ────────────────────────────────────────────────────────────────

const validOutline: BookOutline = {
  chapters: [
    { title: "The Dig", arc: "The crew unearths a sealed door.", approxPages: 4, choiceMoments: 1, convergesInto: null },
    { title: "The Vault", arc: "Two paths converge at the vault's heart.", approxPages: 5, choiceMoments: 2, convergesInto: null },
  ],
  endpointCount: 2,
  depthMin: 5,
  depthMax: 9,
}

// The chapter proposal fixture from Task 3's test (tests/library/bindery-plan.test.ts)
const chapterProposalFixture = {
  nodes: [
    { kind: "page", mode: "told", label: "The chamber", text: "Dust and old gold", next: "The reader decides" },
    {
      kind: "choice",
      label: "The reader decides",
      prompt: "Take it?",
      options: [
        { label: "Lift it free", next: "Crowned" },
        { label: "Leave it", next: "EXIT:2" },
      ],
    },
    { kind: "ending", label: "Crowned", closingLine: "It will not come off.", summaryInstruction: "Reflect on the claim" },
  ],
}

const testSegments: Segment[] = [
  { id: "seg-0", label: "The Dig", description: "The crew unearths a sealed door.", order: 0, nodes: [] },
  { id: "seg-1", label: "The Vault", description: "Two paths converge at the vault's heart.", order: 1, nodes: [] },
]

function textResponse(text: string) {
  return { content: [{ type: "text", text }], usage: { input_tokens: 100, output_tokens: 50 } }
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── 1. draftOutline: fence tolerance ───────────────────────────────────────

describe("draftOutline", () => {
  it("parses a fenced ```json outline response into a BookOutline", async () => {
    mockMessagesCreate.mockResolvedValueOnce(
      textResponse("```json\n" + JSON.stringify(validOutline) + "\n```")
    )

    const experience = createTestExperience()
    const outline = await draftOutline(experience, undefined, "test-key")

    expect(outline).toEqual(validOutline)
    expect(mockMessagesCreate).toHaveBeenCalledTimes(1)
    const call = mockMessagesCreate.mock.calls[0][0] as { model: string; thinking: { type: string }; max_tokens: number }
    expect(call.model).toBe("claude-sonnet-5")
    expect(call.thinking).toEqual({ type: "disabled" })
    expect(call.max_tokens).toBe(1000)
  })

  // ─── 2. single retry then throw ───────────────────────────────────────────
  it("retries once on invalid JSON, then throws when the retry also fails", async () => {
    mockMessagesCreate.mockResolvedValueOnce(textResponse("not json at all"))
    mockMessagesCreate.mockResolvedValueOnce(textResponse("still not json"))

    const experience = createTestExperience()

    await expect(draftOutline(experience, undefined, "test-key")).rejects.toThrow()
    expect(mockMessagesCreate).toHaveBeenCalledTimes(2)

    // The retry prompt must carry the validation/parse failure forward
    const secondCallUser = mockMessagesCreate.mock.calls[1][0].messages[0].content as string
    expect(secondCallUser).toMatch(/invalid|failed/i)
  })
})

// ─── 3. draftChapter: proposal materialised into wired nodes ───────────────

describe("draftChapter", () => {
  it("drafts a chapter and wires nodes: page.next resolves to choice id, EXIT ref resolves to empty string", async () => {
    mockMessagesCreate.mockResolvedValueOnce(textResponse(JSON.stringify(chapterProposalFixture)))

    const experience = createTestExperience({ segments: testSegments })
    const { nodes, pendingRefs } = await draftChapter(experience, 0, "test-key")

    expect(nodes).toHaveLength(3)
    const page = nodes[0] as GeneratedNode
    const choice = nodes[1] as ChoiceNode
    expect(page.nextNodeId).toBe(choice.id)
    expect(choice.options![0].nextNodeId).toBe(nodes[2].id)
    expect(choice.options![1].nextNodeId).toBe("") // EXIT:2 ref — author wires it later
    // The symbolic EXIT:2 ref travels forward as a PendingRef for the apply path.
    expect(pendingRefs).toEqual([
      { nodeId: choice.id, optionId: choice.options![1].id, ref: "EXIT:2" },
    ])

    const call = mockMessagesCreate.mock.calls[0][0] as { max_tokens: number }
    expect(call.max_tokens).toBe(3000)
  })

  it("strips em-dashes from every author-visible string in the proposal", async () => {
    const dashedProposal = {
      nodes: [
        {
          kind: "page",
          mode: "written",
          label: "The chamber",
          text: "Dust and old gold — and something else.",
          next: "The reader decides",
        },
        {
          kind: "choice",
          label: "The reader decides",
          prompt: "Take it — or leave it?",
          options: [
            { label: "Lift it free — carefully", next: "Crowned" },
            { label: "Leave it", next: "EXIT:2" },
          ],
        },
        {
          kind: "ending",
          label: "Crowned",
          closingLine: "It will not come off — ever.",
          summaryInstruction: "Reflect on the claim",
        },
      ],
    }
    mockMessagesCreate.mockResolvedValueOnce(textResponse(JSON.stringify(dashedProposal)))

    const experience = createTestExperience({ segments: testSegments })
    const { nodes, pendingRefs } = await draftChapter(experience, 0, "test-key")

    const page = nodes[0] as { content: string }
    const choice = nodes[1] as ChoiceNode
    const ending = nodes[2] as { closingLine: string }
    expect(page.content).toBe("Dust and old gold, and something else.")
    expect(choice.prompt).toBe("Take it, or leave it?")
    expect(choice.options![0].label).toBe("Lift it free, carefully")
    expect(ending.closingLine).toBe("It will not come off, ever.")
    // The choice option still resolves to the ending despite the stripping.
    expect(choice.options![0].nextNodeId).toBe(nodes[2].id)
    // The em-dash strip runs before materialisation but must not touch the
    // symbolic ref itself — pendingRefs still carries the untouched "EXIT:2".
    expect(pendingRefs).toEqual([
      { nodeId: choice.id, optionId: choice.options![1].id, ref: "EXIT:2" },
    ])
  })

  it("humanises identifier-style labels and their matching refs, keeping wiring intact", async () => {
    const snakeCaseProposal = {
      nodes: [
        { kind: "page", mode: "told", label: "the_well", text: "Dust and old gold", next: "the-choice" },
        {
          kind: "choice",
          label: "the-choice",
          prompt: "Take it?",
          options: [
            { label: "Lift it free", next: "crowned" },
            { label: "Leave it", next: "EXIT:2" },
          ],
        },
        { kind: "ending", label: "crowned", closingLine: "It will not come off.", summaryInstruction: "Reflect on the claim" },
      ],
    }
    mockMessagesCreate.mockResolvedValueOnce(textResponse(JSON.stringify(snakeCaseProposal)))

    const experience = createTestExperience({ segments: testSegments })
    const { nodes, pendingRefs } = await draftChapter(experience, 0, "test-key")

    expect(nodes).toHaveLength(3)
    const page = nodes[0] as GeneratedNode
    const choice = nodes[1] as ChoiceNode
    const ending = nodes[2] as { label: string }
    expect(page.label).toBe("The Well")
    expect(choice.label).toBe("The Choice")
    expect(ending.label).toBe("Crowned")
    // Wiring survives: the humanised ref still resolves to the humanised label's id.
    expect(page.nextNodeId).toBe(choice.id)
    expect(choice.options![0].nextNodeId).toBe(nodes[2].id)
    expect(choice.options![1].nextNodeId).toBe("") // EXIT:2 untouched by the transform
    // The humanise transform must not alter the symbolic ref carried in pendingRefs.
    expect(pendingRefs).toEqual([
      { nodeId: choice.id, optionId: choice.options![1].id, ref: "EXIT:2" },
    ])
  })
})

// ─── draftSinglePage: one page redrafted in place ───────────────────────────

// The route's nodeId branch reads the page through getAllNodes, which prefers
// segments when present — so the page graph must live inside the segment the
// chapterIndex bounds-check passes for.
const pageSegments: Segment[] = [
  { id: "seg-0", label: "The Dig", description: "The crew unearths a sealed door.", order: 0, nodes: createTestNodeGraph() },
]

describe("draftSinglePage", () => {
  it("redrafts a told page in place: same id/type/nextNodeId, new beat instruction, em-dashes stripped", async () => {
    mockMessagesCreate.mockResolvedValueOnce(
      textResponse(JSON.stringify({ text: "The forest closes in — silent and watchful." }))
    )

    const experience = createTestExperience({ segments: pageSegments })
    const { nodes, pendingRefs } = await draftSinglePage(experience, "node-2a", "test-key")
    const drafted = nodes[0] as GeneratedNode

    expect(drafted.id).toBe("node-2a")
    expect(drafted.type).toBe("GENERATED")
    expect(drafted.nextNodeId).toBe("endpoint-1") // wiring preserved
    expect(drafted.beatInstruction).toBe("The forest closes in, silent and watchful.")
    expect(pendingRefs).toEqual([]) // no proposal materialisation involved
    expect(mockUpdateExperience).not.toHaveBeenCalled()
  })

  it("retries once when the first response fails validation, then succeeds", async () => {
    mockMessagesCreate.mockResolvedValueOnce(textResponse(JSON.stringify({ wrong: "shape" })))
    mockMessagesCreate.mockResolvedValueOnce(textResponse(JSON.stringify({ text: "A clean second take." })))

    const experience = createTestExperience({ segments: pageSegments })
    const { nodes } = await draftSinglePage(experience, "node-2a", "test-key")
    const drafted = nodes[0] as GeneratedNode

    expect(mockMessagesCreate).toHaveBeenCalledTimes(2)
    expect(drafted.beatInstruction).toBe("A clean second take.")

    // The retry prompt must carry the validation failure forward.
    const secondCallUser = mockMessagesCreate.mock.calls[1][0].messages[0].content as string
    expect(secondCallUser).toMatch(/invalid|failed/i)
  })

  it("throws for a node that is not a page", async () => {
    const experience = createTestExperience({ segments: pageSegments })
    await expect(draftSinglePage(experience, "choice-1", "test-key")).rejects.toThrow(/not a page/)
    expect(mockMessagesCreate).not.toHaveBeenCalled()
  })
})

// ─── 4. sampleTelling: em-dash stripped, never persisted ────────────────────

describe("sampleTelling", () => {
  it("returns prose with em-dashes stripped and never touches the database", async () => {
    mockMessagesCreate.mockResolvedValueOnce(
      textResponse("The vault door groaned open — ancient and unwilling.")
    )

    const experience = createTestExperience() // node-2a is GENERATED with a beatInstruction
    const sample = await sampleTelling(experience, "node-2a", "test-key")

    expect(sample).not.toMatch(/—/)
    expect(sample).toContain("The vault door groaned open, ancient and unwilling.")

    const call = mockMessagesCreate.mock.calls[0][0] as { max_tokens: number }
    expect(call.max_tokens).toBe(400)

    expect(mockUpdateExperience).not.toHaveBeenCalled()
  })
})

// ─── 5. outline route: auth matrix ──────────────────────────────────────────

function outlineRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/v1/bindery/outline", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  })
}

describe("POST /api/v1/bindery/outline — auth matrix", () => {
  it("401s anonymous requests", async () => {
    mockRequireAuth.mockResolvedValue(null)

    const res = await draftOutlineRoute(outlineRequest({ experienceId: "exp-1" }))
    expect(res.status).toBe(401)
  })

  it("403s a non-editor", async () => {
    mockRequireAuth.mockResolvedValue({ id: "someone-else", email: "x@y.z", isOperator: false })
    mockFindExperience.mockResolvedValue(createTestExperience({ authorId: "author-1" }) as never)
    mockCanEditExperience.mockResolvedValue(false)

    const res = await draftOutlineRoute(outlineRequest({ experienceId: "exp-1" }))
    expect(res.status).toBe(403)
  })

  it("404s a missing experience", async () => {
    mockRequireAuth.mockResolvedValue({ id: "author-1", email: "a@b.c", isOperator: false })
    mockFindExperience.mockResolvedValue(null as never)

    const res = await draftOutlineRoute(outlineRequest({ experienceId: "nope" }))
    expect(res.status).toBe(404)
  })

  it("502s a model/parse failure with the in-fiction error copy", async () => {
    mockRequireAuth.mockResolvedValue({ id: "author-1", email: "a@b.c", isOperator: false })
    mockFindExperience.mockResolvedValue(createTestExperience({ authorId: "author-1" }) as never)
    mockCanEditExperience.mockResolvedValue(true)
    mockMessagesCreate.mockResolvedValue(textResponse("not json"))

    const res = await draftOutlineRoute(outlineRequest({ experienceId: "exp-1" }))
    expect(res.status).toBe(502)
    const body = await res.json()
    expect(body.error).toBe("The Bindery's assistant lost the thread. Try again.")
  })

  it("200s with the parsed outline for an authorized editor", async () => {
    mockRequireAuth.mockResolvedValue({ id: "author-1", email: "a@b.c", isOperator: false })
    mockFindExperience.mockResolvedValue(createTestExperience({ authorId: "author-1" }) as never)
    mockCanEditExperience.mockResolvedValue(true)
    mockMessagesCreate.mockResolvedValueOnce(textResponse(JSON.stringify(validOutline)))

    const res = await draftOutlineRoute(outlineRequest({ experienceId: "exp-1" }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.outline).toEqual(validOutline)
  })
})

// ─── 6. draft-chapter route: chapterIndex bounds ────────────────────────────

function draftChapterRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/v1/bindery/draft-chapter", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  })
}

describe("POST /api/v1/bindery/draft-chapter — chapterIndex validation", () => {
  it("400s when chapterIndex is out of range", async () => {
    mockRequireAuth.mockResolvedValue({ id: "author-1", email: "a@b.c", isOperator: false })
    mockFindExperience.mockResolvedValue(
      createTestExperience({ authorId: "author-1", segments: testSegments }) as never
    )
    mockCanEditExperience.mockResolvedValue(true)

    const res = await draftChapterRoute(draftChapterRequest({ experienceId: "exp-1", chapterIndex: 7 }))
    expect(res.status).toBe(400)
    expect(mockMessagesCreate).not.toHaveBeenCalled()
  })

  it("400s a negative chapterIndex", async () => {
    mockRequireAuth.mockResolvedValue({ id: "author-1", email: "a@b.c", isOperator: false })
    mockFindExperience.mockResolvedValue(
      createTestExperience({ authorId: "author-1", segments: testSegments }) as never
    )
    mockCanEditExperience.mockResolvedValue(true)

    const res = await draftChapterRoute(draftChapterRequest({ experienceId: "exp-1", chapterIndex: -1 }))
    expect(res.status).toBe(400)
  })

  it("200s with materialised nodes for a valid chapterIndex", async () => {
    mockRequireAuth.mockResolvedValue({ id: "author-1", email: "a@b.c", isOperator: false })
    mockFindExperience.mockResolvedValue(
      createTestExperience({ authorId: "author-1", segments: testSegments }) as never
    )
    mockCanEditExperience.mockResolvedValue(true)
    mockMessagesCreate.mockResolvedValueOnce(textResponse(JSON.stringify(chapterProposalFixture)))

    const res = await draftChapterRoute(draftChapterRequest({ experienceId: "exp-1", chapterIndex: 0 }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.nodes).toHaveLength(3)
    // EXIT:2 on "Leave it" travels through the endpoint as a pendingRef.
    const choice = body.nodes[1] as ChoiceNode
    expect(body.pendingRefs).toEqual([
      { nodeId: choice.id, optionId: choice.options![1].id, ref: "EXIT:2" },
    ])
  })

  it("drafts a single page in place when nodeId is sent without mode, preserving id and wiring", async () => {
    mockRequireAuth.mockResolvedValue({ id: "author-1", email: "a@b.c", isOperator: false })
    mockFindExperience.mockResolvedValue(
      createTestExperience({ authorId: "author-1", segments: pageSegments }) as never
    )
    mockCanEditExperience.mockResolvedValue(true)
    mockMessagesCreate.mockResolvedValueOnce(
      textResponse(JSON.stringify({ text: "A drafted beat — em-dash and all." }))
    )

    const res = await draftChapterRoute(
      draftChapterRequest({ experienceId: "exp-1", chapterIndex: 0, nodeId: "node-2a" })
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.nodes).toHaveLength(1)
    expect(body.nodes[0].id).toBe("node-2a")
    expect(body.nodes[0].type).toBe("GENERATED")
    expect(body.nodes[0].nextNodeId).toBe("endpoint-1")
    expect(body.nodes[0].beatInstruction).not.toMatch(/—/)
    expect(body.pendingRefs).toEqual([])
  })

  it("502s the in-fiction envelope when the nodeId is not a page", async () => {
    mockRequireAuth.mockResolvedValue({ id: "author-1", email: "a@b.c", isOperator: false })
    mockFindExperience.mockResolvedValue(
      createTestExperience({ authorId: "author-1", segments: pageSegments }) as never
    )
    mockCanEditExperience.mockResolvedValue(true)

    const res = await draftChapterRoute(
      draftChapterRequest({ experienceId: "exp-1", chapterIndex: 0, nodeId: "choice-1" })
    )
    expect(res.status).toBe(502)
    const body = await res.json()
    expect(body.error).toBe("The Bindery's assistant lost the thread. Try again.")
    expect(mockMessagesCreate).not.toHaveBeenCalled()
  })

  it("502s the in-fiction envelope for a nodeId that does not exist", async () => {
    mockRequireAuth.mockResolvedValue({ id: "author-1", email: "a@b.c", isOperator: false })
    mockFindExperience.mockResolvedValue(
      createTestExperience({ authorId: "author-1", segments: pageSegments }) as never
    )
    mockCanEditExperience.mockResolvedValue(true)

    const res = await draftChapterRoute(
      draftChapterRequest({ experienceId: "exp-1", chapterIndex: 0, nodeId: "no-such-node" })
    )
    expect(res.status).toBe(502)
    const body = await res.json()
    expect(body.error).toBe("The Bindery's assistant lost the thread. Try again.")
    expect(mockMessagesCreate).not.toHaveBeenCalled()
  })

  it("returns a sample telling without validating chapterIndex against chapter content", async () => {
    mockRequireAuth.mockResolvedValue({ id: "author-1", email: "a@b.c", isOperator: false })
    // No segments override here: sampleTelling reads from the flat node graph
    // (node-2a) via getAllNodes, and the sample path never checks chapterIndex.
    mockFindExperience.mockResolvedValue(createTestExperience({ authorId: "author-1" }) as never)
    mockCanEditExperience.mockResolvedValue(true)
    mockMessagesCreate.mockResolvedValueOnce(textResponse("A sample page — with an em-dash."))

    const res = await draftChapterRoute(
      draftChapterRequest({ experienceId: "exp-1", chapterIndex: 0, mode: "sample", nodeId: "node-2a" })
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.sample).not.toMatch(/—/)
    expect(mockUpdateExperience).not.toHaveBeenCalled()
  })
})
