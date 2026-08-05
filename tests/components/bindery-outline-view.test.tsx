import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { SheetPages } from "@/components/library/bindery/SheetPages"
import { getBinderyPack } from "@/lib/library/bindery-packs"
import type { BookOutline } from "@/lib/library/bindery"
import type { ChoiceNode, FixedNode, Segment } from "@/types/experience"

const pack = getBinderyPack("cyoa_story")

// The hardened jargon/em-dash guard (tests/components/bindery-premise-cover.test.tsx):
// engine vocabulary and em-dashes must never leak into rendered copy.
const JARGON_RE = /\bFIXED\b|\bGENERATED\b|\bCHOICE\b|\bENDPOINT\b|JSON|contextPack|—/

const OUTLINE_FIXTURE: BookOutline = {
  chapters: [
    { title: "The Dig", arc: "The crown is found", approxPages: 4, choiceMoments: 1, convergesInto: null },
    { title: "The Claim", arc: "Two paths to the vault", approxPages: 5, choiceMoments: 2, convergesInto: 2 },
    { title: "The Vault", arc: "Endings", approxPages: 4, choiceMoments: 1, convergesInto: null },
  ],
  endpointCount: 2,
  depthMin: 5,
  depthMax: 9,
}

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) } as Response)
}

function draftWithSegments(segments: Segment[]) {
  return {
    id: "exp-1",
    title: "The Hollow Crown",
    genre: "fantasy",
    description: null,
    contextPack: {},
    shape: { totalDepthMin: 5, totalDepthMax: 9, endpointCount: 2, coverVariant: 5 },
    segments,
    coverImageUrl: null,
  }
}

beforeEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe("SheetPages: template picker -> outline draft", () => {
  it("clicking a template then Draft the outline fetches the endpoint and shows three editable chapter rows", async () => {
    const fetchMock = vi.fn(() => jsonResponse({ outline: OUTLINE_FIXTURE }))
    vi.stubGlobal("fetch", fetchMock)
    const onChange = vi.fn()

    render(<SheetPages draft={draftWithSegments([])} pack={pack} onChange={onChange} />)

    // Template cards render from the pack.
    for (const template of pack.templates) {
      expect(screen.getByRole("button", { name: new RegExp(template.label, "i") })).toBeInTheDocument()
    }

    fireEvent.click(screen.getByRole("button", { name: new RegExp(pack.templates[0].label, "i") }))
    fireEvent.click(screen.getByRole("button", { name: /draft the outline/i }))

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/v1/bindery/outline",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ experienceId: "exp-1", templateId: pack.templates[0].id }),
        })
      )
    )

    expect(await screen.findByDisplayValue("The Dig")).toBeInTheDocument()
    expect(screen.getByDisplayValue("The Claim")).toBeInTheDocument()
    expect(screen.getByDisplayValue("The Vault")).toBeInTheDocument()

    // No engine jargon or em-dashes leak into the rendered copy.
    expect(document.body.textContent).not.toMatch(/FIXED|GENERATED|JSON|—/)
  })
})

describe("SheetPages: lay out the chapters", () => {
  it("applies the drafted outline as segments via onChange", async () => {
    const fetchMock = vi.fn(() => jsonResponse({ outline: OUTLINE_FIXTURE }))
    vi.stubGlobal("fetch", fetchMock)
    const onChange = vi.fn()

    render(<SheetPages draft={draftWithSegments([])} pack={pack} onChange={onChange} />)

    fireEvent.click(screen.getByRole("button", { name: new RegExp(pack.templates[0].label, "i") }))
    fireEvent.click(screen.getByRole("button", { name: /draft the outline/i }))
    await screen.findByDisplayValue("The Dig")

    fireEvent.click(screen.getByRole("button", { name: /lay out the chapters/i }))

    expect(onChange).toHaveBeenCalledTimes(1)
    const patch = onChange.mock.calls[0][0] as { segments: Segment[]; shape: Record<string, unknown> }
    expect(patch.segments).toHaveLength(3)
    expect(patch.segments.map((s) => s.label)).toEqual(["The Dig", "The Claim", "The Vault"])
    // The patch must preserve fields already on shape (e.g. coverVariant) alongside the
    // outline-derived depth/endpoint fields — a naive rebuild would clobber them.
    // It must also guarantee the structural fields every other authoring path
    // supplies, or the reader-side arc calculation crashes on a GENERATED page.
    expect(patch.shape).toMatchObject({
      totalDepthMin: 5,
      totalDepthMax: 9,
      endpointCount: 2,
      coverVariant: 5,
      loadBearingChoices: [],
      convergencePoints: [],
      mandatoryNodeIds: [],
      endpoints: [],
      pacingModel: "narrative_arc",
    })
  })
})

describe("SheetPages: chapter rail", () => {
  it("lists segments in order and switches the current chapter on click", () => {
    const segments: Segment[] = [
      { id: "s-b", label: "The Claim", order: 1, nodes: [] },
      { id: "s-a", label: "The Dig", order: 0, nodes: [{ id: "n1", type: "FIXED", label: "p", content: "x", mandatory: false, nextNodeId: "" } as never] },
      { id: "s-c", label: "The Vault", order: 2, nodes: [] },
    ]

    render(<SheetPages draft={draftWithSegments(segments)} pack={pack} onChange={vi.fn()} />)

    const rail = document.querySelector(".lib-chapter-rail")
    expect(rail).not.toBeNull()
    const buttons = rail!.querySelectorAll("button")
    expect(Array.from(buttons).map((b) => b.textContent)).toEqual([
      expect.stringMatching(/The Dig/),
      expect.stringMatching(/The Claim/),
      expect.stringMatching(/The Vault/),
    ])

    // First chapter (order 0) is current by default.
    expect(screen.getByRole("button", { name: /The Dig/i })).toHaveAttribute("aria-current", "true")
    // A chapter with zero nodes is flagged as rough.
    expect(screen.getByRole("button", { name: /The Claim/i }).textContent).toMatch(/rough/i)

    fireEvent.click(screen.getByRole("button", { name: /The Vault/i }))
    expect(screen.getByRole("button", { name: /The Vault/i })).toHaveAttribute("aria-current", "true")
    expect(screen.getByRole("button", { name: /The Dig/i })).not.toHaveAttribute("aria-current", "true")

    // The Vault has no pages yet: Task 11's ChapterPlan shows the draft
    // invitation rather than the old "This chapter is unbound" placeholder.
    expect(screen.getByRole("button", { name: /draft this chapter/i })).toBeInTheDocument()
  })
})

describe("SheetPages: chapter draft sweeps pending refs and reports the tie", () => {
  it("applies pendingRefs, persists the swept segments, and shows the tied-for-you line", async () => {
    const chapter1Page: FixedNode = {
      id: "chapter1-page-1",
      type: "FIXED",
      label: "Vault Entrance",
      content: "The vault door stands ajar.",
      mandatory: false,
      nextNodeId: "",
    }
    const segments: Segment[] = [
      { id: "s-a", label: "The Dig", order: 0, nodes: [] },
      { id: "s-b", label: "The Claim", order: 1, nodes: [chapter1Page] },
    ]

    const draftedPage: FixedNode = {
      id: "draft-page-1",
      type: "FIXED",
      label: "Cave Mouth",
      content: "Cold air rises from the dark.",
      mandatory: false,
      nextNodeId: "draft-choice-1",
    }
    const draftedChoice: ChoiceNode = {
      id: "draft-choice-1",
      type: "CHOICE",
      label: "Which way",
      responseType: "closed",
      prompt: "Which way?",
      options: [{ id: "opt-a", label: "Onward", nextNodeId: "", isLoadBearing: false }],
    }

    const fetchMock = vi.fn(() =>
      jsonResponse({
        nodes: [draftedPage, draftedChoice],
        pendingRefs: [{ nodeId: "draft-choice-1", optionId: "opt-a", ref: "EXIT:1" }],
      })
    )
    vi.stubGlobal("fetch", fetchMock)
    const onChange = vi.fn()

    render(<SheetPages draft={draftWithSegments(segments)} pack={pack} onChange={onChange} />)

    fireEvent.click(screen.getByRole("button", { name: /draft this chapter/i }))

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/v1/bindery/draft-chapter",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ experienceId: "exp-1", chapterIndex: 0 }),
        })
      )
    )

    // (a) the persisted segments have the option tied to chapter 1's first page id.
    await waitFor(() => expect(onChange).toHaveBeenCalled())
    const patch = onChange.mock.calls[onChange.mock.calls.length - 1][0] as { segments: Segment[] }
    const persistedChapter0 = patch.segments.find((s) => s.id === "s-a")!
    const persistedChoice = persistedChapter0.nodes.find((n) => n.id === "draft-choice-1") as ChoiceNode
    expect(persistedChoice.options![0].nextNodeId).toBe("chapter1-page-1")

    // (b) the tied-for-you line renders with the correct count and pluralisation.
    expect(await screen.findByText("One thread tied for you. Change any of them with Turn to…")).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(JARGON_RE)
  })

  it("shows no tied-for-you line when the response has no refs and nothing was loose", async () => {
    const segments: Segment[] = [
      { id: "s-a", label: "The Dig", order: 0, nodes: [] },
      { id: "s-b", label: "The Claim", order: 1, nodes: [] },
    ]

    const draftedPage: FixedNode = {
      id: "solo-page-1",
      type: "FIXED",
      label: "Cave Mouth",
      content: "Cold air rises from the dark.",
      mandatory: false,
      nextNodeId: "already-set",
    }

    const fetchMock = vi.fn(() => jsonResponse({ nodes: [draftedPage], pendingRefs: [] }))
    vi.stubGlobal("fetch", fetchMock)
    const onChange = vi.fn()

    render(<SheetPages draft={draftWithSegments(segments)} pack={pack} onChange={onChange} />)

    fireEvent.click(screen.getByRole("button", { name: /draft this chapter/i }))

    await waitFor(() => expect(onChange).toHaveBeenCalled())

    expect(screen.queryByText(/tied for you/i)).not.toBeInTheDocument()
  })
})
