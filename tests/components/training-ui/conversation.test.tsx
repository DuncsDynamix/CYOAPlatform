import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"

vi.mock("@/lib/voice/client", () => ({ fetchActorAudio: vi.fn().mockResolvedValue({ kind: "disabled" }) }))

const { ConversationScreen } = await import("@/components/training-ui/screens/ConversationScreen")
const { ObservedScreen } = await import("@/components/training-ui/screens/ObservedScreen")

const turn = (role: "participant" | "character", content: string) => ({ role, content, timestamp: "2026-10-03T10:00:00Z" })

const base = {
  sessionId: "s1",
  actorName: "Margaret Hale",
  actorRole: "Behind the door chain — wary",
  history: [turn("character", "Who are you?")],
  turnCount: 0,
  maxTurns: 8,
  onSubmit: vi.fn(),
  onConclude: vi.fn(),
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("ConversationScreen", () => {
  it("shows the persona, the situation and the turn count", () => {
    render(<ConversationScreen {...base} />)
    expect(screen.getByText("Margaret Hale")).toBeInTheDocument()
    expect(screen.getByText("Behind the door chain: wary")).toBeInTheDocument()
    expect(screen.getByText("Turn 1 of up to 8")).toBeInTheDocument()
    expect(screen.getByText("MH")).toBeInTheDocument()
  })

  it("labels each bubble for screen readers", () => {
    render(<ConversationScreen {...base} history={[turn("character", "Who are you?"), turn("participant", "Sam, from the water company.")]} turnCount={1} />)
    const items = screen.getAllByRole("listitem")
    expect(items[0]).toHaveTextContent("Margaret Hale: Who are you?")
    expect(items[1]).toHaveTextContent("You: Sam, from the water company.")
    expect(items[1]).toHaveClass("tg-msg--mine")
  })

  it("sends on Enter once, shows the typing indicator, and keeps Shift+Enter for new lines", async () => {
    let finish: () => void = () => {}
    const onSubmit = vi.fn(() => new Promise<void>((resolve) => { finish = resolve }))
    render(<ConversationScreen {...base} onSubmit={onSubmit} />)
    const box = screen.getByLabelText("Your reply")

    fireEvent.change(box, { target: { value: "Hello" } })
    fireEvent.keyDown(box, { key: "Enter", shiftKey: true })
    expect(onSubmit).not.toHaveBeenCalled()

    fireEvent.keyDown(box, { key: "Enter" })
    fireEvent.keyDown(box, { key: "Enter" })
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit).toHaveBeenCalledWith("Hello")
    expect(screen.getByText("Margaret Hale is replying")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled()

    finish()
    await waitFor(() => expect(screen.queryByText("Margaret Hale is replying")).not.toBeInTheDocument())
  })

  it("offers to finish the conversation after the first turn", () => {
    const { rerender } = render(<ConversationScreen {...base} />)
    expect(screen.queryByRole("button", { name: /Finish the conversation/ })).not.toBeInTheDocument()
    rerender(<ConversationScreen {...base} turnCount={1} />)
    fireEvent.click(screen.getByRole("button", { name: /Finish the conversation/ }))
    expect(base.onConclude).toHaveBeenCalledOnce()
  })

  it("scrolls to the true bottom, so the newest turn is never parked under the pinned composer", () => {
    const scrollIntoView = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoView
    try {
      const { container, rerender } = render(<ConversationScreen {...base} />)
      rerender(<ConversationScreen {...base} history={[...base.history, turn("participant", "Sam, from the water company.")]} turnCount={1} />)
      expect(scrollIntoView).toHaveBeenCalledWith({ block: "end" })
      const target = scrollIntoView.mock.contexts.at(-1) as Element
      const composer = container.querySelector(".tg-composer")!
      // The sentinel follows the sticky composer: scrolling it into view reaches the end of the scroll area.
      expect(composer.compareDocumentPosition(target) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      expect(composer.contains(target)).toBe(false)
    } finally {
      delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView
    }
  })

  it("hides the voice toggle when the server reports voice unavailable", async () => {
    render(<ConversationScreen {...base} />)
    await waitFor(() => expect(screen.queryByRole("button", { name: /actor voice/ })).not.toBeInTheDocument())
  })
})

describe("ObservedScreen", () => {
  const exchanges = [
    { speaker: "Pat Doherty", line: "Report illness before entering." },
    { speaker: "Sam Taylor", line: "Understood." },
    { speaker: "Pat Doherty", line: "Good." },
  ]

  it("reveals the exchange one line at a time, then continues", () => {
    const onContinue = vi.fn()
    render(<ObservedScreen exchanges={exchanges} openingContext="At the site gate." onContinue={onContinue} />)
    expect(screen.getByText("At the site gate.")).toBeInTheDocument()
    expect(screen.getByText("Report illness before entering.")).toBeInTheDocument()
    expect(screen.queryByText("Understood.")).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Next" }))
    fireEvent.click(screen.getByRole("button", { name: "Next" }))
    expect(screen.getByText("Good.")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Continue" }))
    expect(onContinue).toHaveBeenCalledOnce()
  })

  it("puts the second speaker on the other side", () => {
    const { container } = render(<ObservedScreen exchanges={exchanges.slice(0, 2)} onContinue={vi.fn()} />)
    fireEvent.click(screen.getByRole("button", { name: "Next" }))
    expect(container.querySelectorAll(".tg-observe-row--b")).toHaveLength(1)
  })
})
