import { useEffect, useRef } from "react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { ObservedScreen } from "@/components/training-ui/screens/ObservedScreen"
import { SlideDeckScreen } from "@/components/training-ui/screens/SlideDeckScreen"
import { Shell } from "@/components/training-ui/shell/Shell"
import type { PlayerBrand } from "@/lib/training/views"

// jsdom implements neither scroll method; stub them so the calls can be observed.
const scrollIntoView = vi.fn()
const scrollTo = vi.fn()
const proto = Element.prototype as unknown as Record<string, unknown>
const saved = { scrollIntoView: proto.scrollIntoView, scrollTo: proto.scrollTo }

beforeEach(() => {
  scrollIntoView.mockClear()
  scrollTo.mockClear()
  proto.scrollIntoView = scrollIntoView
  proto.scrollTo = scrollTo
})

afterEach(() => {
  proto.scrollIntoView = saved.scrollIntoView
  proto.scrollTo = saved.scrollTo
})

describe("observed conversation", () => {
  const exchanges = [
    { speaker: "Pat", line: "Report illness before entering." },
    { speaker: "Sam", line: "Understood." },
    { speaker: "Pat", line: "Good." },
  ]

  it("brings each newly revealed line into view, but leaves the opening where it is", () => {
    render(<ObservedScreen exchanges={exchanges} onContinue={vi.fn()} />)
    expect(scrollIntoView).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Next" }))
    expect(scrollIntoView).toHaveBeenCalledTimes(1)
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "end" })
  })
})

describe("slide deck", () => {
  it("shows the top of each new slide", () => {
    const slides = [
      { id: "a", template: "text-only" as const, title: "One", body: "First" },
      { id: "b", template: "text-only" as const, title: "Two", body: "Second" },
    ]
    render(<SlideDeckScreen slides={slides} onContinue={vi.fn()} />)
    expect(scrollIntoView).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Next slide" }))
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "start" })
  })
})

describe("shell scroll area", () => {
  const brand: PlayerBrand = { displayName: "Gold Tap Training", header: "dark" }

  it("returns to the top when the screen changes, and stays put within a screen", () => {
    const { rerender } = render(<Shell brand={brand} title="T" screenKey="reading:n1"><p>one</p></Shell>)
    scrollTo.mockClear()
    rerender(<Shell brand={brand} title="T" screenKey="reading:n1"><p>one, updated</p></Shell>)
    expect(scrollTo).not.toHaveBeenCalled()
    rerender(<Shell brand={brand} title="T" screenKey="decision:n2"><p>two</p></Shell>)
    expect(scrollTo).toHaveBeenCalledWith({ top: 0 })
  })
})

describe("shell reset and screen scrolling order", () => {
  const brand: PlayerBrand = { displayName: "Gold Tap Training", header: "dark" }

  function ScrollsToEndOnMount() {
    const ref = useRef<HTMLDivElement>(null)
    useEffect(() => {
      ref.current?.scrollIntoView({ block: "end" })
    }, [])
    return <div ref={ref}>conversation</div>
  }

  it("resets to the top before a new screen scrolls itself (e.g. a resumed conversation)", () => {
    const { rerender } = render(<Shell brand={brand} title="T" screenKey="loading:"><p>wait</p></Shell>)
    rerender(<Shell brand={brand} title="T" screenKey="in_dialogue:d1"><ScrollsToEndOnMount /></Shell>)
    expect(scrollTo).toHaveBeenCalledWith({ top: 0 })
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "end" })
    expect(scrollTo.mock.invocationCallOrder[0]).toBeLessThan(scrollIntoView.mock.invocationCallOrder[0])
  })
})
