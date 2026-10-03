import { describe, it, expect } from "vitest"
import { readFileSync } from "fs"

// I4: an EVALUATIVE arrival can take two assessment attempts (50s SDK timeout,
// one SDK retry each), and an ENDPOINT arrival makes a summary call, so every
// route that can arrive at either needs maxDuration 120. /engine/start only
// arrives at a starting node (FIXED, GENERATED or SLIDE_DECK), so 60 suffices.
const maxDurationOf = (route: string) => {
  const m = readFileSync(`app/api/v1/engine/${route}/route.ts`, "utf8").match(/export const maxDuration = (\d+)/)
  return m ? Number(m[1]) : undefined
}

describe("engine route durations (I4)", () => {
  it.each(["node", "choose", "dialogue", "reassess"])("%s allows 120s", (route) => {
    expect(maxDurationOf(route)).toBe(120)
  })
  it("start keeps 60s (it never arrives at an assessment or endpoint)", () => {
    expect(maxDurationOf("start")).toBe(60)
  })
})
