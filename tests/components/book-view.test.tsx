import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { BookView } from "@/components/reader/BookView"

const proseContent = { type: "prose", content: "The gate stands open." }
const choiceContent = {
  type: "choice", prompt: "What do you do?",
  options: [
    { id: "opt-a", label: "Step through", nextNodeId: "n2", isLoadBearing: true },
    { id: "opt-b", label: "Wait for dawn", nextNodeId: "n3", isLoadBearing: false, disabled: true },
  ],
}

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) } as Response)
}

function bookProps() {
  return { slug: "the-hollow-crown", title: "The Hollow Crown", author: "D. Brown", genre: "fantasy", coverImageUrl: null, description: "A crown, hollow.", endingsCount: 3 }
}

beforeEach(() => vi.restoreAllMocks())

describe("BookView", () => {
  it("shows the cover first and only starts the session on Begin", async () => {
    const fetchMock = vi.fn(() => jsonResponse({ sessionId: "s1", node: { id: "n1", type: "FIXED" }, content: proseContent, experienceTitle: "The Hollow Crown" }))
    vi.stubGlobal("fetch", fetchMock)

    render(<BookView {...bookProps()} />)
    expect(screen.getByRole("button", { name: /begin/i })).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole("button", { name: /begin/i }))
    await waitFor(() => expect(screen.getByText(/gate stands open/i)).toBeInTheDocument())
    expect(String(fetchMock.mock.calls[0][0])).toContain("/engine/start")
  })

  it("renders choices into the page foot, including faded disabled options", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      if (String(input).includes("/engine/start"))
        return jsonResponse({ sessionId: "s1", node: { id: "c1", type: "CHOICE" }, content: choiceContent, experienceTitle: "T" })
      return jsonResponse({}, 500)
    })
    vi.stubGlobal("fetch", fetchMock)

    render(<BookView {...bookProps()} />)
    fireEvent.click(screen.getByRole("button", { name: /begin/i }))

    const enabled = await screen.findByRole("button", { name: /step through/i })
    expect(enabled).toBeEnabled()
    const disabled = screen.getByRole("button", { name: /wait for dawn/i })
    expect(disabled).toBeDisabled()
  })

  it("shows the smudged-ink page with retry for retryable failures — and retries the SAME request", async () => {
    let chooseCalls = 0
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes("/engine/start"))
        return jsonResponse({ sessionId: "s1", node: { id: "c1", type: "CHOICE" }, content: choiceContent, experienceTitle: "T" })
      if (url.includes("/engine/choose")) {
        chooseCalls++
        if (chooseCalls === 1) return jsonResponse({ error: "busy", retryable: true }, 429)
        return jsonResponse({ node: { id: "n2", type: "GENERATED" }, content: proseContent })
      }
      return jsonResponse({}, 500)
    })
    vi.stubGlobal("fetch", fetchMock)

    render(<BookView {...bookProps()} />)
    fireEvent.click(screen.getByRole("button", { name: /begin/i }))
    fireEvent.click(await screen.findByRole("button", { name: /step through/i }))

    await screen.findByText(/ink has smudged/i)
    fireEvent.click(screen.getByRole("button", { name: /try the page again/i }))
    await waitFor(() => expect(screen.getByText(/gate stands open/i)).toBeInTheDocument())
    expect(chooseCalls).toBe(2)
  })

  it("treats an absent retryable flag as non-retryable but still offers the library", async () => {
    const fetchMock = vi.fn(() => jsonResponse({ error: "Too many requests" }, 429))
    vi.stubGlobal("fetch", fetchMock)

    render(<BookView {...bookProps()} />)
    fireEvent.click(screen.getByRole("button", { name: /begin/i }))

    await screen.findByText(/too many requests/i)
    expect(screen.queryByRole("button", { name: /try the page again/i })).not.toBeInTheDocument()
    expect(screen.getByRole("link", { name: /return to the library/i })).toBeInTheDocument()
  })

  it("shows the colophon at an ending", async () => {
    const fetchMock = vi.fn(() => jsonResponse({
      sessionId: "s1", node: { id: "e1", type: "ENDPOINT" },
      content: { type: "endpoint", closingLine: "Some doors close.", summary: "You walked the long way.", outcomeCard: { outcomeLabel: "The Long Way", closingLine: "Some doors close.", summary: "", shareable: false, showChoiceStats: false, showDepthStats: false, showReadingTime: false } },
      experienceTitle: "T",
    }))
    vi.stubGlobal("fetch", fetchMock)

    render(<BookView {...bookProps()} />)
    fireEvent.click(screen.getByRole("button", { name: /begin/i }))
    await screen.findByText("The Long Way")
    expect(screen.getByText(/one of 3 endings/i)).toBeInTheDocument()
  })

  it("shows a graceful misbound page for training-only content types", async () => {
    const fetchMock = vi.fn(() => jsonResponse({ sessionId: "s1", node: { id: "d1", type: "DIALOGUE" }, content: { type: "dialogue", actorName: "Sam", actorRole: "", characterLine: "…", turnCount: 0, maxTurns: 5 }, experienceTitle: "T" }))
    vi.stubGlobal("fetch", fetchMock)

    render(<BookView {...bookProps()} />)
    fireEvent.click(screen.getByRole("button", { name: /begin/i }))
    await screen.findByText(/belongs to another binding/i)
  })
})
