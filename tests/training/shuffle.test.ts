import { describe, it, expect } from "vitest"

const { shuffleWith } = await import("@/lib/training/shuffle")

describe("shuffleWith", () => {
  const items = ["a", "b", "c", "d"]

  it("preserves every element", () => {
    const out = shuffleWith(items, Math.random)
    expect([...out].sort()).toEqual(["a", "b", "c", "d"])
  })

  it("does not mutate the input array", () => {
    const input = ["a", "b", "c", "d"]
    shuffleWith(input, Math.random)
    expect(input).toEqual(["a", "b", "c", "d"])
  })

  it("is deterministic for a fixed rng", () => {
    // rng always 0 → Fisher-Yates swaps each i with index 0
    const zeros = () => 0
    expect(shuffleWith(items, zeros)).toEqual(shuffleWith(items, zeros))
    expect(shuffleWith(items, zeros)).not.toEqual(items)
  })

  it("actually reorders across many random runs", () => {
    const seen = new Set<string>()
    for (let i = 0; i < 50; i++) seen.add(shuffleWith(items, Math.random).join(""))
    expect(seen.size).toBeGreaterThan(1)
  })
})
