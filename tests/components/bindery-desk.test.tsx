import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react"
import { Desk } from "@/components/library/bindery/Desk"

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) } as Response)
}

const drafts = [
  { id: "exp-1", title: "The Glass Orchard", genre: "fantasy", updatedAt: "2026-07-01T00:00:00.000Z" },
  { id: "exp-2", title: "Static and Salt", genre: "sci-fi", updatedAt: "2026-06-20T00:00:00.000Z" },
]

beforeEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

afterEach(() => {
  vi.useRealTimers()
})

describe("Desk", () => {
  it("renders the drawer with drafts and a 'begin a new binding' button", () => {
    render(<Desk drafts={drafts} />)

    expect(screen.getByRole("button", { name: /the glass orchard/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /static and salt/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /begin a new binding/i })).toBeInTheDocument()
  })

  it("drawer resume calls fetch for the experience and shows sheet 1 with its title", async () => {
    const fetchMock = vi.fn(() =>
      jsonResponse({
        id: "exp-1",
        title: "The Glass Orchard",
        genre: "fantasy",
        description: "An orchard that isn't there.",
        contextPack: {},
        shape: {},
        segments: [],
        coverImageUrl: null,
      })
    )
    vi.stubGlobal("fetch", fetchMock)

    render(<Desk drafts={drafts} />)
    fireEvent.click(screen.getByRole("button", { name: /the glass orchard/i }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/v1/experience/exp-1"))
    expect(await screen.findByDisplayValue("The Glass Orchard")).toBeInTheDocument()
  })

  it("SheetTitle: typing a title + choosing a genre updates the scene's data-hall attribute", () => {
    const { container } = render(<Desk drafts={[]} />)
    fireEvent.click(screen.getByRole("button", { name: /begin a new binding/i }))

    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: "New Book" } })
    fireEvent.change(screen.getByLabelText(/genre/i), { target: { value: "sci-fi" } })

    expect(container.querySelector('[data-hall="sci-fi"]')).not.toBeNull()
  })

  it("sheet tabs 2-5 are disabled until an experience exists (no id yet)", () => {
    render(<Desk drafts={[]} />)
    fireEvent.click(screen.getByRole("button", { name: /begin a new binding/i }))

    expect(screen.getByRole("button", { name: /title & genre/i })).toBeEnabled()
    expect(screen.getByRole("button", { name: /the premise/i })).toBeDisabled()
    expect(screen.getByRole("button", { name: /the cover/i })).toBeDisabled()
    expect(screen.getByRole("button", { name: /the pages/i })).toBeDisabled()
    expect(screen.getByRole("button", { name: /bind & shelve/i })).toBeDisabled()
  })

  it("a failed discard keeps the drawer item and reports the stove's refusal", async () => {
    const fetchMock = vi.fn(() => jsonResponse({ error: "nope" }, 500))
    vi.stubGlobal("fetch", fetchMock)

    render(<Desk drafts={drafts} />)
    fireEvent.click(screen.getAllByRole("button", { name: /^discard$/i })[0])
    fireEvent.click(screen.getByRole("button", { name: /yes, discard/i }))

    await screen.findByText(/the stove refuses it\. try again\./i)
    expect(screen.getByRole("button", { name: /the glass orchard/i })).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/experience/exp-1", { method: "DELETE" })
  })

  it("rapid double-trigger of the first save issues exactly ONE POST", async () => {
    vi.useFakeTimers()
    let resolveCreate: ((r: Response) => void) | null = null
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "POST") {
        // Held open past both debounce windows — the second debounce fires
        // while this create is still on the wire.
        return new Promise<Response>((resolve) => {
          resolveCreate = resolve
        })
      }
      return jsonResponse({ id: "exp-9" })
    })
    vi.stubGlobal("fetch", fetchMock)

    render(<Desk drafts={[]} />)
    fireEvent.click(screen.getByRole("button", { name: /begin a new binding/i }))

    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: "First" } })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000) // debounce 1 fires → POST goes out (held)
    })

    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: "First, refined" } })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000) // debounce 2 fires while POST is in flight
    })

    const postCalls = fetchMock.mock.calls.filter((c) => (c[1] as RequestInit | undefined)?.method === "POST")
    expect(postCalls).toHaveLength(1)

    // Release the create; the deferred save must now PUT against the new id, not POST again.
    await act(async () => {
      resolveCreate!({
        ok: true,
        status: 201,
        json: () =>
          Promise.resolve({
            id: "exp-9",
            title: "First",
            genre: null,
            description: null,
            // A populated server default shape, as the create route actually
            // returns (see app/api/v1/experience/route.ts's defaultShape) —
            // exercises that Desk adopts it into state rather than leaving
            // local `shape` at its initial `{}`.
            shape: { totalDepthMin: 6, totalDepthMax: 12, endpointCount: 3, pacingModel: "narrative_arc" },
            contextPack: {},
            segments: [],
            coverImageUrl: null,
          }),
      } as Response)
      await vi.advanceTimersByTimeAsync(4000)
    })

    const finalPostCalls = fetchMock.mock.calls.filter((c) => (c[1] as RequestInit | undefined)?.method === "POST")
    expect(finalPostCalls).toHaveLength(1)
    const putCalls = fetchMock.mock.calls.filter((c) => (c[1] as RequestInit | undefined)?.method === "PUT")
    expect(putCalls.length).toBeGreaterThanOrEqual(1)
    expect(String(putCalls[0][0])).toBe("/api/v1/experience/exp-9")

    // Sheet 3 ("the cover") is now enabled since `experience` is set.
    // Shuffling immediately must PUT a shape that still carries the server's
    // real defaults (pacingModel here) merged with the new coverVariant —
    // not `{ coverVariant }` alone, which would clobber them.
    fireEvent.click(screen.getByRole("button", { name: /the cover/i }))
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /shuffle the binding/i }))
      await vi.advanceTimersByTimeAsync(0)
    })

    const shuffleCall = fetchMock.mock.calls.find(
      (c) =>
        (c[1] as RequestInit | undefined)?.method === "PUT" &&
        String((c[1] as RequestInit).body).includes("coverVariant")
    )
    expect(shuffleCall).toBeDefined()
    const shuffleBody = JSON.parse(String((shuffleCall![1] as RequestInit).body))
    expect(shuffleBody.shape.pacingModel).toBe("narrative_arc")
    expect(shuffleBody.shape.coverVariant).toBe(1)
  })
})
