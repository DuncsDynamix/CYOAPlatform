import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { BindingMap } from "@/components/library/bindery/BindingMap"
import type { ChoiceNode, FixedNode, Node, Segment } from "@/types/experience"

function page(id: string, label: string, nextNodeId: string): FixedNode {
  return { id, type: "FIXED", label, content: "x", mandatory: false, nextNodeId }
}

function choice(id: string, label: string, options: { id: string; label: string; nextNodeId: string }[]): ChoiceNode {
  return {
    id,
    type: "CHOICE",
    label,
    responseType: "closed",
    options: options.map((o) => ({ ...o, isLoadBearing: false })),
  }
}

function segmentOf(nodes: Node[]): Segment {
  return { id: "seg-1", label: "The Dig", order: 0, nodes }
}

describe("BindingMap", () => {
  it("renders one leaf per plan row with accessible names", () => {
    const nodes: Node[] = [
      page("n1", "The Cellar Door", "n2"),
      page("n2", "A Damp Corridor", ""),
    ]
    render(<BindingMap segment={segmentOf(nodes)} allNodes={nodes} onJump={vi.fn()} />)

    expect(screen.getByRole("button", { name: "The Cellar Door" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "A Damp Corridor" })).toBeInTheDocument()
    expect(screen.getAllByRole("button")).toHaveLength(2)
  })

  it("the SVG is a group, not an img, so its button leaves stay in the accessibility tree", () => {
    const nodes: Node[] = [page("n1", "The Cellar Door", "")]
    render(<BindingMap segment={segmentOf(nodes)} allNodes={nodes} onJump={vi.fn()} />)

    expect(screen.getByRole("group", { name: /binding map for the dig/i })).toBeInTheDocument()
    expect(screen.queryByRole("img")).not.toBeInTheDocument()
  })

  it("calls onJump with the node id on click and on keyboard Enter", () => {
    const nodes: Node[] = [
      page("n1", "The Cellar Door", "n2"),
      page("n2", "A Damp Corridor", ""),
    ]
    const onJump = vi.fn()
    render(<BindingMap segment={segmentOf(nodes)} allNodes={nodes} onJump={onJump} />)

    fireEvent.click(screen.getByRole("button", { name: "The Cellar Door" }))
    expect(onJump).toHaveBeenCalledWith("n1")

    fireEvent.keyDown(screen.getByRole("button", { name: "A Damp Corridor" }), { key: "Enter" })
    expect(onJump).toHaveBeenCalledWith("n2")
    expect(onJump).toHaveBeenCalledTimes(2)
  })

  it("calls onJump on keyboard Space, matching the button role convention", () => {
    const nodes: Node[] = [
      page("n1", "The Cellar Door", "n2"),
      page("n2", "A Damp Corridor", ""),
    ]
    const onJump = vi.fn()
    render(<BindingMap segment={segmentOf(nodes)} allNodes={nodes} onJump={onJump} />)

    fireEvent.keyDown(screen.getByRole("button", { name: "The Cellar Door" }), { key: " " })
    expect(onJump).toHaveBeenCalledWith("n1")
    expect(onJump).toHaveBeenCalledTimes(1)
  })

  it("renders more paths for a forking chapter than a linear chapter of equal length", () => {
    const linearNodes: Node[] = [
      page("l1", "Opening the Gate", "l2"),
      page("l2", "Crossing the Yard", "l3"),
      page("l3", "Reaching the Door", ""),
    ]
    const forkingNodes: Node[] = [
      choice("f1", "A Fork in the Path", [
        { id: "opt-a", label: "Left", nextNodeId: "f2" },
        { id: "opt-b", label: "Right", nextNodeId: "f3" },
      ]),
      page("f2", "The Left Path", ""),
      page("f3", "The Right Path", ""),
    ]

    const { container: linearContainer } = render(
      <BindingMap segment={segmentOf(linearNodes)} allNodes={linearNodes} onJump={vi.fn()} />
    )
    const { container: forkingContainer } = render(
      <BindingMap segment={segmentOf(forkingNodes)} allNodes={forkingNodes} onJump={vi.fn()} />
    )

    const linearPaths = linearContainer.querySelectorAll("path").length
    const forkingPaths = forkingContainer.querySelectorAll("path").length
    expect(forkingPaths).toBeGreaterThan(linearPaths)
  })
})
