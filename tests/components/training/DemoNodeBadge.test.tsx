import { describe, it, expect } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { DemoNodeBadge } from "@/components/training/DemoNodeBadge"
import { DEMO_NODE_COPY } from "@/lib/training/demo-node-copy"

/** Every node representation the player can put on screen in demo mode. */
const DISPLAYED_KEYS = [
  "FIXED",
  "GENERATED",
  "CHOICE",
  "CHOICE_OPEN",
  "SLIDE_DECK",
  "DIALOGUE",
  "OBSERVED_DIALOGUE",
  "EVALUATIVE",
  "ENDPOINT",
]

describe("DEMO_NODE_COPY", () => {
  it("has a label and blurb for every displayed node representation", () => {
    for (const key of DISPLAYED_KEYS) {
      expect(DEMO_NODE_COPY[key]?.label, `${key} label`).toBeTruthy()
      expect(DEMO_NODE_COPY[key]?.blurb, `${key} blurb`).toBeTruthy()
    }
  })

  it("deliberately has no entry for invisible checkpoints", () => {
    expect(DEMO_NODE_COPY["CHECKPOINT"]).toBeUndefined()
  })
})

describe("DemoNodeBadge", () => {
  it("renders the label with the blurb hidden until clicked", () => {
    render(<DemoNodeBadge copyKey="GENERATED" />)
    expect(screen.getByText(new RegExp(DEMO_NODE_COPY.GENERATED.label))).toBeInTheDocument()
    expect(screen.queryByText(DEMO_NODE_COPY.GENERATED.blurb)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button"))
    expect(screen.getByText(DEMO_NODE_COPY.GENERATED.blurb)).toBeInTheDocument()
  })

  it("renders nothing for a key without copy", () => {
    const { container } = render(<DemoNodeBadge copyKey="CHECKPOINT" />)
    expect(container).toBeEmptyDOMElement()
  })
})
