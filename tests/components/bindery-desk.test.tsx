import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
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
})
