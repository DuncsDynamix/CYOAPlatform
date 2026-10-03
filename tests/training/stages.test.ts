import { describe, it, expect } from "vitest"
import { courseStages, stageProgress, stageWarnings } from "@/lib/training/stages"

const nodes = [{ id: "n-intro" }, { id: "n-scene-1" }, { id: "n-scene-2" }, { id: "ev" }]

describe("courseStages", () => {
  it("uses authored stages, dropping any that start at an unknown node", () => {
    const stages = courseStages({
      nodes,
      presentation: { stages: [
        { label: "Briefing", startsAt: "n-intro" },
        { label: "Ghost", startsAt: "nope" },
        { label: "Doorstep 1 — the chain", startsAt: "n-scene-1" },
      ] },
    })
    expect(stages).toEqual([
      { label: "Briefing", startsAt: "n-intro" },
      { label: "Doorstep 1: the chain", startsAt: "n-scene-1" },
    ])
  })

  it("falls back to segments in order", () => {
    const stages = courseStages({
      nodes: [],
      segments: [
        { id: "s2", label: "Afternoon", order: 2, nodes: [{ id: "b1" }] },
        { id: "s1", label: "Morning", order: 1, nodes: [{ id: "a1" }] },
        { id: "s3", label: "Empty", order: 3, nodes: [] },
      ],
    })
    expect(stages).toEqual([{ label: "Morning", startsAt: "a1" }, { label: "Afternoon", startsAt: "b1" }])
  })

  it("returns no stages when there is nothing to go on", () => {
    expect(courseStages({ nodes })).toEqual([])
  })
})

describe("stageProgress", () => {
  const stages = [
    { label: "Briefing", startsAt: "n-intro" },
    { label: "Doorstep 1", startsAt: "n-scene-1" },
    { label: "Doorstep 2", startsAt: "n-scene-2" },
    { label: "Review", startsAt: "ev" },
  ]
  it("is the highest stage whose start has been visited", () => {
    expect(stageProgress(stages, ["n-intro", "n-scene-1"])).toEqual({ index: 1, total: 4, label: "Doorstep 1" })
    expect(stageProgress(stages, ["n-intro", "n-scene-1", "n-scene-2", "ev"])).toEqual({ index: 3, total: 4, label: "Review" })
  })
  it("starts at the first stage before anything is visited", () => {
    expect(stageProgress(stages, [])).toEqual({ index: 0, total: 4, label: "Briefing" })
  })
  it("is null without stages", () => {
    expect(stageProgress([], ["n-intro"])).toBeNull()
  })
})

describe("stageWarnings", () => {
  it("warns about missing stages and unknown start nodes", () => {
    expect(stageWarnings({ nodes })).toEqual(["Course has no stages: the header will show the title only."])
    expect(stageWarnings({ nodes, presentation: { stages: [{ label: "X", startsAt: "nope" }] } })).toEqual([
      'Stage "X" starts at unknown node "nope".',
      "Course has no stages: the header will show the title only.",
    ])
  })
})
