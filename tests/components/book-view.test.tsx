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

beforeEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe("BookView", () => {
  it("shows the cover first and only starts the session on Begin", async () => {
    const fetchMock = vi.fn((_input: RequestInfo | URL) => jsonResponse({ sessionId: "s1", node: { id: "n1", type: "FIXED" }, content: proseContent, experienceTitle: "The Hollow Crown" }))
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

  it("submits margin-input text as freeTextResponse, not choiceId", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, _init?: RequestInit) => {
      const url = String(input)
      if (url.includes("/engine/start"))
        return jsonResponse({
          sessionId: "s1",
          node: { id: "c1", type: "CHOICE", responseType: "open", openPrompt: "What now?" },
          content: { type: "choice", prompt: "What now?", options: [] },
          experienceTitle: "T",
        })
      if (url.includes("/engine/choose"))
        return jsonResponse({ node: { id: "n2", type: "GENERATED" }, content: proseContent })
      return jsonResponse({}, 500)
    })
    vi.stubGlobal("fetch", fetchMock)

    render(<BookView {...bookProps()} />)
    fireEvent.click(screen.getByRole("button", { name: /begin/i }))

    const box = await screen.findByPlaceholderText(/what do you do/i)
    fireEvent.change(box, { target: { value: "run away" } })
    fireEvent.click(screen.getByRole("button", { name: /write/i }))

    await waitFor(() => expect(screen.getByText(/gate stands open/i)).toBeInTheDocument())
    const chooseCall = fetchMock.mock.calls.find((call) => String(call[0]).includes("/engine/choose"))
    expect(chooseCall).toBeDefined()
    const body = JSON.parse((chooseCall![1] as RequestInit).body as string)
    expect(body.freeTextResponse).toBe("run away")
    expect(body.choiceId).toBeUndefined()
  })

  it("keeps the last prose visible on the choice page after a background prefetch merges it in — no Continue click, single fetch", async () => {
    // Minimal EventSource stub: erroring immediately makes Opening fall
    // through to onReady, which dispatches the held prose content.
    class InstantErrorEventSource {
      onmessage: ((e: { data: string }) => void) | null = null
      onerror: (() => void) | null = null
      constructor() { setTimeout(() => this.onerror?.(), 0) }
      close() {}
    }
    vi.stubGlobal("EventSource", InstantErrorEventSource as unknown as typeof EventSource)

    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes("/engine/start"))
        return jsonResponse({ sessionId: "s1", node: { id: "n1", type: "GENERATED", nextNodeId: "c1" }, content: proseContent, experienceTitle: "T" })
      if (url.includes("/engine/node"))
        return jsonResponse({ node: { id: "c1", type: "CHOICE" }, content: choiceContent })
      return jsonResponse({}, 500)
    })
    vi.stubGlobal("fetch", fetchMock)

    render(<BookView {...bookProps()} />)
    fireEvent.click(screen.getByRole("button", { name: /begin/i }))

    // The choice should appear on its own, from a background prefetch fired
    // the moment the prose landed — no Continue click required.
    await screen.findByRole("button", { name: /step through/i })
    expect(screen.getByText(/gate stands open/i)).toBeInTheDocument()

    const nodeCalls = fetchMock.mock.calls.filter((call) => String(call[0]).includes("/engine/node"))
    expect(nodeCalls).toHaveLength(1)
  })

  it("prefetches the next node from a prose page: prefetched choices merge onto the same page with a single fetch", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes("/engine/start"))
        return jsonResponse({ sessionId: "s1", node: { id: "n1", type: "FIXED" }, content: proseContent, experienceTitle: "T" })
      if (url.includes("/engine/node"))
        return jsonResponse({ node: { id: "c1", type: "CHOICE" }, content: choiceContent })
      return jsonResponse({}, 500)
    })
    vi.stubGlobal("fetch", fetchMock)

    render(<BookView {...bookProps()} />)
    fireEvent.click(screen.getByRole("button", { name: /begin/i }))

    const enabled = await screen.findByRole("button", { name: /step through/i })
    expect(enabled).toBeEnabled()
    expect(screen.getByText(/gate stands open/i)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /continue/i })).not.toBeInTheDocument()

    const nodeCalls = fetchMock.mock.calls.filter((call) => String(call[0]).includes("/engine/node"))
    expect(nodeCalls).toHaveLength(1)
  })

  it("stashes a prefetched non-choice node and dispatches it on Continue without waiting on a second fetch", async () => {
    const secondProse = { type: "prose", content: "The second page turns quietly." }
    let nodeCalls = 0
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes("/engine/start"))
        return jsonResponse({ sessionId: "s1", node: { id: "n1", type: "FIXED" }, content: proseContent, experienceTitle: "T" })
      if (url.includes("/engine/node")) {
        nodeCalls++
        if (nodeCalls === 1) return jsonResponse({ node: { id: "n2", type: "FIXED" }, content: secondProse })
        return new Promise(() => {}) // page 2's own background prefetch — deliberately never resolves
      }
      return jsonResponse({}, 500)
    })
    vi.stubGlobal("fetch", fetchMock)

    render(<BookView {...bookProps()} />)
    fireEvent.click(screen.getByRole("button", { name: /begin/i }))
    await screen.findByText(/gate stands open/i)

    // Let the background prefetch resolve and stash before pressing Continue.
    await waitFor(() => expect(nodeCalls).toBe(1))
    expect(screen.getByText(/gate stands open/i)).toBeInTheDocument() // nothing visible changed yet

    fireEvent.click(screen.getByRole("button", { name: /continue/i }))
    await screen.findByText(/second page turns quietly/i)

    // The second /engine/node call is page 2's own (never-resolving) background
    // prefetch — proof that landing on page 2 did not wait on a network round trip.
    expect(nodeCalls).toBe(2)
  })

  it("discards a failed prefetch silently and falls back to a live advance on Continue", async () => {
    let nodeCalls = 0
    const laterProse = { type: "prose", content: "A slower page, fetched live." }
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes("/engine/start"))
        return jsonResponse({ sessionId: "s1", node: { id: "n1", type: "FIXED" }, content: proseContent, experienceTitle: "T" })
      if (url.includes("/engine/node")) {
        nodeCalls++
        if (nodeCalls === 1) return jsonResponse({}, 500) // the failed background prefetch
        if (nodeCalls === 2) return jsonResponse({ node: { id: "n2", type: "FIXED" }, content: laterProse })
        return new Promise(() => {}) // page 2's own background prefetch — never resolves
      }
      return jsonResponse({}, 500)
    })
    vi.stubGlobal("fetch", fetchMock)

    render(<BookView {...bookProps()} />)
    fireEvent.click(screen.getByRole("button", { name: /begin/i }))
    await screen.findByText(/gate stands open/i)

    await waitFor(() => expect(nodeCalls).toBe(1))
    // Nothing visible changes for a failed prefetch — no smudged page.
    expect(screen.getByText(/gate stands open/i)).toBeInTheDocument()
    expect(screen.queryByText(/ink has smudged/i)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /continue/i }))
    await screen.findByText(/slower page, fetched live/i)

    // 1: the failed background prefetch. 2: Continue's live advance(), which
    // succeeded. 3: the new page's own (never-resolving) background prefetch.
    expect(nodeCalls).toBe(3)
  })

  it("double-clicking Continue during an in-flight prefetch consumes exactly one node — no skip, no extra fetch", async () => {
    const secondProse = { type: "prose", content: "The second page turns quietly." }
    let resolvePrefetch: ((value: Response) => void) | null = null
    let nodeCalls = 0
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes("/engine/start"))
        return jsonResponse({ sessionId: "s1", node: { id: "n1", type: "FIXED" }, content: proseContent, experienceTitle: "T" })
      if (url.includes("/engine/node")) {
        nodeCalls++
        if (nodeCalls === 1)
          return new Promise<Response>((resolve) => { resolvePrefetch = resolve }) // held open until we release it
        return new Promise<Response>(() => {}) // page 2's own background prefetch — never resolves
      }
      return jsonResponse({}, 500)
    })
    vi.stubGlobal("fetch", fetchMock)

    render(<BookView {...bookProps()} />)
    fireEvent.click(screen.getByRole("button", { name: /begin/i }))
    await screen.findByText(/gate stands open/i)
    await waitFor(() => expect(resolvePrefetch).not.toBeNull())

    // Two rapid Continue clicks while the prefetch is still on the wire.
    const continueBtn = screen.getByRole("button", { name: /continue/i })
    fireEvent.click(continueBtn)
    fireEvent.click(continueBtn)

    resolvePrefetch!({ ok: true, status: 200, json: () => Promise.resolve({ node: { id: "n2", type: "FIXED" }, content: secondProse }) } as Response)

    await screen.findByText(/second page turns quietly/i)

    // 1: the held prefetch (consumed once). 2: page 2's own background prefetch.
    // A re-entrant second click would have fired a THIRD live fetch and
    // skipped past n2 entirely.
    expect(nodeCalls).toBe(2)
  })

  it("shows the turning interstitial when Continue is clicked while the prefetch is still in flight", async () => {
    const secondProse = { type: "prose", content: "The second page turns quietly." }
    let resolvePrefetch: ((value: Response) => void) | null = null
    let nodeCalls = 0
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes("/engine/start"))
        return jsonResponse({ sessionId: "s1", node: { id: "n1", type: "FIXED" }, content: proseContent, experienceTitle: "T" })
      if (url.includes("/engine/node")) {
        nodeCalls++
        if (nodeCalls === 1)
          return new Promise<Response>((resolve) => { resolvePrefetch = resolve })
        return new Promise<Response>(() => {})
      }
      return jsonResponse({}, 500)
    })
    vi.stubGlobal("fetch", fetchMock)

    render(<BookView {...bookProps()} />)
    fireEvent.click(screen.getByRole("button", { name: /begin/i }))
    await screen.findByText(/gate stands open/i)
    await waitFor(() => expect(resolvePrefetch).not.toBeNull())

    fireEvent.click(screen.getByRole("button", { name: /continue/i }))

    // The reader asked to advance while the page is still being written — the
    // turning interstitial (with its staged messages) must cover the wait.
    await screen.findByText(/turning the page/i)

    resolvePrefetch!({ ok: true, status: 200, json: () => Promise.resolve({ node: { id: "n2", type: "FIXED" }, content: secondProse }) } as Response)
    await screen.findByText(/second page turns quietly/i)
  })

  it("shows a graceful misbound page for training-only content types", async () => {
    const fetchMock = vi.fn(() => jsonResponse({ sessionId: "s1", node: { id: "d1", type: "DIALOGUE" }, content: { type: "dialogue", actorName: "Sam", actorRole: "", characterLine: "…", turnCount: 0, maxTurns: 5 }, experienceTitle: "T" }))
    vi.stubGlobal("fetch", fetchMock)

    render(<BookView {...bookProps()} />)
    fireEvent.click(screen.getByRole("button", { name: /begin/i }))
    await screen.findByText(/belongs to another binding/i)
  })
})
