import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { ChapterPlan } from "@/components/library/bindery/ChapterPlan"
import { PageCard } from "@/components/library/bindery/PageCard"
import { ChoiceCard } from "@/components/library/bindery/ChoiceCard"
import { makeBinderyPage, makeBinderyChoice, makeBinderyEnding } from "@/lib/library/bindery"
import { getBinderyPack } from "@/lib/library/bindery-packs"
import type { ChoiceNode, FixedNode, GeneratedNode, Segment } from "@/types/experience"

const pack = getBinderyPack("cyoa_story")

// The hardened jargon/em-dash guard (tests/components/bindery-premise-cover.test.tsx):
// engine vocabulary and em-dashes must never leak into rendered copy.
const JARGON_RE = /\bFIXED\b|\bGENERATED\b|\bCHOICE\b|\bENDPOINT\b|JSON|contextPack|—/

describe("ChapterPlan", () => {
  it("shows 'Draft this chapter' for an empty segment", () => {
    const segment: Segment = { id: "seg-0", label: "The Dig", order: 0, nodes: [] }
    render(
      <ChapterPlan
        segment={segment}
        allNodes={[]}
        segments={[segment]}
        pack={pack}
        onNodesChange={vi.fn()}
        onDraftChapter={vi.fn()}
        onDraftPage={vi.fn()}
        onSample={vi.fn()}
      />
    )
    expect(screen.getByRole("button", { name: /draft this chapter/i })).toBeInTheDocument()
  })

  it("lists a populated chapter's rows in plan order with in-fiction kind labels, never FIXED/GENERATED", () => {
    const page1 = makeBinderyPage("written") as FixedNode
    page1.label = "Opening"
    const page2 = makeBinderyPage("told") as GeneratedNode
    page2.label = "The Descent"
    const choice = makeBinderyChoice() as ChoiceNode
    choice.label = "The Fork"
    choice.prompt = "Which way?"
    const ending = makeBinderyEnding("The End")

    page1.nextNodeId = page2.id
    page2.nextNodeId = choice.id
    choice.options![0].nextNodeId = ending.id
    choice.options![1].nextNodeId = ending.id

    const all = [page1, page2, choice, ending]
    const segment: Segment = { id: "seg-0", label: "The Dig", order: 0, nodes: all }

    const { container } = render(
      <ChapterPlan
        segment={segment}
        allNodes={all}
        segments={[segment]}
        pack={pack}
        onNodesChange={vi.fn()}
        onDraftChapter={vi.fn()}
        onDraftPage={vi.fn()}
        onSample={vi.fn()}
      />
    )

    // "written by you"/"told by the engine" appear twice each (the kind badge
    // plus PageCard's own toggle control) — assert presence, not uniqueness.
    expect(screen.getAllByText(/written by you/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/told by the engine/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/the reader decides/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/closing page/i).length).toBeGreaterThan(0)
    expect(container.textContent).not.toMatch(JARGON_RE)

    // No "Draft this chapter" once the chapter has pages.
    expect(screen.queryByRole("button", { name: /draft this chapter/i })).not.toBeInTheDocument()
  })
})

describe("PageCard", () => {
  it("mode toggle converts a written page to told after confirming, preserving id/label/nextNodeId", () => {
    const node = makeBinderyPage("written") as FixedNode
    node.label = "The Chamber"
    node.nextNodeId = "next-1"
    node.content = "Dust and old gold."
    const onChange = vi.fn()

    render(
      <PageCard
        node={node}
        vocabulary={pack.vocabulary}
        targets={[]}
        turnToCandidates={[]}
        onChange={onChange}
        onDraft={vi.fn()}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: /told by the engine/i }))
    // The destructive direction is gated behind an inline confirm.
    expect(screen.getByText(/set aside/i)).toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole("button", { name: /yes/i }))

    expect(onChange).toHaveBeenCalledTimes(1)
    const converted = onChange.mock.calls[0][0] as GeneratedNode
    expect(converted.type).toBe("GENERATED")
    expect(converted.id).toBe(node.id)
    expect(converted.label).toBe("The Chamber")
    expect(converted.nextNodeId).toBe("next-1")
  })

  it("renders a resolved sample telling into the document", async () => {
    const node = makeBinderyPage("told") as GeneratedNode
    node.label = "The Descent"
    node.beatInstruction = "The stairs spiral down into cold air."
    const onSample = vi.fn().mockResolvedValue("A cold telling.")

    const { container } = render(
      <PageCard
        node={node}
        vocabulary={pack.vocabulary}
        targets={[]}
        turnToCandidates={[]}
        onChange={vi.fn()}
        onDraft={vi.fn()}
        onSample={onSample}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: /hear a sample telling/i }))

    await waitFor(() => expect(onSample).toHaveBeenCalledTimes(1))
    expect(await screen.findByText("A cold telling.")).toBeInTheDocument()
    expect(container.querySelector(".lib-sample")?.textContent).toBe("A cold telling.")
  })
})

describe("ChoiceCard", () => {
  it("retargeting an option's Turn to select fires onChange with the picked nextNodeId", () => {
    const node = makeBinderyChoice() as ChoiceNode
    node.label = "The Fork"
    node.prompt = "Which way?"
    node.options![0].label = "Go left"
    node.options![1].label = "Go right"
    const onChange = vi.fn()

    render(
      <ChoiceCard
        node={node}
        targets={[]}
        turnToCandidates={[{ id: "n9", label: "The Vault", chapter: "The Claim" }]}
        onChange={onChange}
      />
    )

    const selects = screen.getAllByLabelText(/turn to/i)
    fireEvent.change(selects[1], { target: { value: "n9" } })

    expect(onChange).toHaveBeenCalledTimes(1)
    const updated = onChange.mock.calls[0][0] as ChoiceNode
    expect(updated.options![1].nextNodeId).toBe("n9")
    expect(updated.options![0].nextNodeId).toBe("") // untouched
  })
})

describe("ChapterPlan: rejoins", () => {
  it("marks a node with two inbound links with the rejoin marker", () => {
    // Reused from tests/library/bindery-plan.test.ts's derivePlan fixture.
    const a = makeBinderyPage("written")
    const b = makeBinderyChoice() as ChoiceNode
    const c = makeBinderyPage("told")
    const d = makeBinderyPage("told")
    a.label = "Opening"
    b.label = "The Fork"
    c.label = "Left Path"
    d.label = "Rejoin"
    a.nextNodeId = b.id
    b.options![0].nextNodeId = c.id
    b.options![1].nextNodeId = d.id
    ;(c as GeneratedNode).nextNodeId = d.id // d is a rejoin: reached from b AND c
    ;(d as GeneratedNode).nextNodeId = ""

    const all = [a, b, c, d]
    const segment: Segment = { id: "seg-0", label: "Chapter One", order: 0, nodes: all }

    render(
      <ChapterPlan
        segment={segment}
        allNodes={all}
        segments={[segment]}
        pack={pack}
        onNodesChange={vi.fn()}
        onDraftChapter={vi.fn()}
        onDraftPage={vi.fn()}
        onSample={vi.fn()}
      />
    )

    expect(screen.getByText(/paths rejoin here/i)).toBeInTheDocument()
    expect(document.querySelector(".lib-plan-rejoin")).not.toBeNull()
  })
})
