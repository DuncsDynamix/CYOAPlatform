import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { SheetBind } from "@/components/library/bindery/SheetBind"
import type { BinderyDraft } from "@/components/library/bindery/Desk"
import type { Segment } from "@/types/experience"

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) } as Response)
}

function draftWithSegments(segments: Segment[], overrides: Partial<BinderyDraft> = {}): BinderyDraft {
  return {
    id: "exp-1",
    title: "The Hollow Crown",
    genre: "fantasy",
    description: null,
    contextPack: {},
    shape: {},
    segments,
    coverImageUrl: null,
    slug: "the-hollow-crown",
    ...overrides,
  }
}

// A dangling choice: one option wired, one left unset -> a broken link.
const LOOSE_SEGMENTS: Segment[] = [
  {
    id: "seg-1",
    label: "Chapter One",
    order: 0,
    nodes: [
      {
        id: "node-choice",
        type: "CHOICE",
        label: "The Fork",
        responseType: "closed",
        options: [
          { id: "opt-1", label: "Left", nextNodeId: "node-page", isLoadBearing: false },
          { id: "opt-2", label: "Right", nextNodeId: "", isLoadBearing: false },
        ],
      },
      {
        id: "node-page",
        type: "FIXED",
        label: "The Landing",
        content: "You arrive.",
        mandatory: false,
        nextNodeId: "",
      },
    ],
  },
]

// A closed, fully-wired loop: choice -> page -> ending. No loose stitches.
const VALID_SEGMENTS: Segment[] = [
  {
    id: "seg-1",
    label: "Chapter One",
    order: 0,
    nodes: [
      {
        id: "node-page",
        type: "FIXED",
        label: "The Opening",
        content: "It begins.",
        mandatory: false,
        nextNodeId: "node-choice",
      },
      {
        id: "node-choice",
        type: "CHOICE",
        label: "The Fork",
        responseType: "closed",
        options: [{ id: "opt-1", label: "Onward", nextNodeId: "node-end", isLoadBearing: false }],
      },
      {
        id: "node-end",
        type: "ENDPOINT",
        label: "The Close",
        endpointId: "end-1",
        outcomeLabel: "The Close",
        closingLine: "It is done.",
        summaryInstruction: "Summarize the ending.",
        outcomeCard: { shareable: true, showChoiceStats: true, showDepthStats: true, showReadingTime: true },
      },
    ],
  },
]

// A broken link (blocking) plus an orphan page nothing points to (adrift) —
// the chain start -> choice -> end stays fully reachable and valid on its
// own; the orphan is wired forward (to node-end) so it registers only as
// unreachable, never also as a dead end.
const MIXED_SEGMENTS: Segment[] = [
  {
    id: "seg-1",
    label: "Chapter One",
    order: 0,
    nodes: [
      {
        id: "node-page",
        type: "FIXED",
        label: "The Opening",
        content: "It begins.",
        mandatory: false,
        nextNodeId: "node-choice",
      },
      {
        id: "node-choice",
        type: "CHOICE",
        label: "The Fork",
        responseType: "closed",
        options: [
          { id: "opt-1", label: "Left", nextNodeId: "node-end", isLoadBearing: false },
          { id: "opt-2", label: "Right", nextNodeId: "", isLoadBearing: false },
        ],
      },
      {
        id: "node-end",
        type: "ENDPOINT",
        label: "The Close",
        endpointId: "end-1",
        outcomeLabel: "The Close",
        closingLine: "It is done.",
        summaryInstruction: "Summarize the ending.",
        outcomeCard: { shareable: true, showChoiceStats: true, showDepthStats: true, showReadingTime: true },
      },
      {
        id: "node-orphan",
        type: "FIXED",
        label: "The Cellar",
        content: "No one comes here.",
        mandatory: false,
        nextNodeId: "node-end",
      },
    ],
  },
]

// Same chain, minus the broken link: only the orphan page is unwired-to —
// adrift only, no blocking stitches.
const ADRIFT_ONLY_SEGMENTS: Segment[] = [
  {
    id: "seg-1",
    label: "Chapter One",
    order: 0,
    nodes: [
      VALID_SEGMENTS[0].nodes[0],
      VALID_SEGMENTS[0].nodes[1],
      VALID_SEGMENTS[0].nodes[2],
      {
        id: "node-orphan",
        type: "FIXED",
        label: "The Cellar",
        content: "No one comes here.",
        mandatory: false,
        nextNodeId: "node-end",
      },
    ],
  },
]

beforeEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe("SheetBind", () => {
  it("with a loose graph, the bind button is disabled and stitches list in-fiction messages linking page labels", () => {
    const onShelved = vi.fn()
    const onJumpToNode = vi.fn()
    render(
      <SheetBind draft={draftWithSegments(LOOSE_SEGMENTS)} onJumpToNode={onJumpToNode} onShelved={onShelved} />
    )

    expect(screen.getByRole("button", { name: /bind and shelve this book/i })).toBeDisabled()

    const stitchLink = screen.getByRole("link", { name: /is not yet tied to a page/i })
    expect(stitchLink).toBeInTheDocument()

    fireEvent.click(stitchLink)
    expect(onJumpToNode).toHaveBeenCalledWith("node-choice")
  })

  it("with a valid graph, the button enables and a stubbed publish flips to the shelved state with the walk-to-shelf link", async () => {
    const fetchMock = vi.fn(() => jsonResponse({ status: "published" }))
    vi.stubGlobal("fetch", fetchMock)
    const onShelved = vi.fn()

    render(
      <SheetBind draft={draftWithSegments(VALID_SEGMENTS)} onJumpToNode={vi.fn()} onShelved={onShelved} />
    )

    const bindButton = screen.getByRole("button", { name: /bind and shelve this book/i })
    expect(bindButton).toBeEnabled()

    fireEvent.click(bindButton)

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/v1/experience/exp-1/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "published" }),
      })
    )

    await screen.findByText(/it is bound\./i)
    const shelfLink = screen.getByRole("link", { name: /walk to the shelf/i })
    expect(shelfLink).toHaveAttribute("href", "/hall/fantasy")
    expect(onShelved).toHaveBeenCalledWith("the-hollow-crown")
  })

  it("renders both a blocking section and an adrift section for a mixed fixture, and keeps the bind button disabled", () => {
    render(
      <SheetBind draft={draftWithSegments(MIXED_SEGMENTS)} onJumpToNode={vi.fn()} onShelved={vi.fn()} />
    )

    expect(screen.getByText(/the binding is loose on these pages:/i)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /is not yet tied to a page/i })).toBeInTheDocument()

    expect(screen.getByText(/no path leads to these pages\. readers will never find them:/i)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /no path reaches 'the cellar'/i })).toBeInTheDocument()

    // A blocking stitch is present, so the button stays disabled.
    expect(screen.getByRole("button", { name: /bind and shelve this book/i })).toBeDisabled()
  })

  it("an adrift-only graph (no blocking stitches) enables the bind button, showing only the adrift section", () => {
    render(
      <SheetBind draft={draftWithSegments(ADRIFT_ONLY_SEGMENTS)} onJumpToNode={vi.fn()} onShelved={vi.fn()} />
    )

    expect(screen.queryByText(/the binding is loose on these pages:/i)).not.toBeInTheDocument()
    expect(screen.getByText(/no path leads to these pages\. readers will never find them:/i)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /no path reaches 'the cellar'/i })).toBeInTheDocument()

    // Unreachable pages are a warning only — the drive proved adrift-only enables the button.
    expect(screen.getByRole("button", { name: /bind and shelve this book/i })).toBeEnabled()
  })

  it("a publish 400 renders the in-theme failure list and never calls window.alert", async () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {})
    const fetchMock = vi.fn(() =>
      jsonResponse(
        {
          error: "Experience graph has problems that would break playthroughs",
          brokenLinks: [{ nodeId: "node-choice", handle: "option:opt-2", targetId: "" }],
          deadEnds: ["node-page"],
          unreachable: [],
        },
        400
      )
    )
    vi.stubGlobal("fetch", fetchMock)

    render(
      <SheetBind draft={draftWithSegments(VALID_SEGMENTS)} onJumpToNode={vi.fn()} onShelved={vi.fn()} />
    )

    fireEvent.click(screen.getByRole("button", { name: /bind and shelve this book/i }))

    await screen.findByText(/the binding is loose on these pages/i)
    expect(screen.getByText(/the fork.*not yet tied to a page/i)).toBeInTheDocument()
    expect(alertSpy).not.toHaveBeenCalled()
  })
})
