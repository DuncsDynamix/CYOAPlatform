import { describe, it, expect } from "vitest"
import { parseSessionState } from "@/lib/engine/session"
import type { SessionState } from "@/types/session"

const validState: SessionState = {
  flags: { path: "forest", hasKey: true },
  counters: { trust: 3 },
  returnStack: ["node-5"],
  choicesMade: 4,
  nodesVisited: ["node-1", "choice-1"],
  depthPercentage: 33,
  pacingInstruction: "Build tension",
  dialogue: {
    nodeId: "dlg-1",
    actorName: "Sam",
    turns: [{ role: "character", content: "Hello.", timestamp: "2026-01-01T00:00:00Z" }],
    breakthroughAchieved: false,
    turnCount: 0,
  },
  competencyProfile: [
    {
      nodeId: "eval-1",
      rubricCriterionId: "crit-1",
      criterionLabel: "Empathy",
      passed: true,
      evidence: "Acknowledged the concern.",
      weight: "major",
    },
  ],
}

describe("parseSessionState", () => {
  it("returns a fully valid state unchanged", () => {
    expect(parseSessionState(validState)).toEqual(validState)
  })

  it("returns default state for null, undefined, and non-object input", () => {
    for (const raw of [null, undefined, "corrupt", 42, []]) {
      const state = parseSessionState(raw)
      expect(state.flags).toEqual({})
      expect(state.counters).toEqual({})
      expect(state.choicesMade).toBe(0)
      expect(state.nodesVisited).toEqual([])
      expect(state.dialogue).toBeNull()
      expect(state.competencyProfile).toEqual([])
    }
  })

  it("fills missing fields from defaults while keeping valid ones", () => {
    const state = parseSessionState({ flags: { path: "forest" }, choicesMade: 7 })
    expect(state.flags).toEqual({ path: "forest" })
    expect(state.choicesMade).toBe(7)
    expect(state.counters).toEqual({})
    expect(state.nodesVisited).toEqual([])
    expect(state.depthPercentage).toBe(0)
    expect(state.pacingInstruction).toBe("")
    expect(state.dialogue).toBeNull()
  })

  it("replaces corrupt field values with defaults without losing healthy fields", () => {
    const state = parseSessionState({
      ...validState,
      choicesMade: "five",
      nodesVisited: "node-1",
      counters: ["not", "a", "record"],
    })
    expect(state.choicesMade).toBe(0)
    expect(state.nodesVisited).toEqual([])
    expect(state.counters).toEqual({})
    // Healthy fields survive
    expect(state.flags).toEqual(validState.flags)
    expect(state.depthPercentage).toBe(33)
  })

  it("drops a malformed dialogue blob to null", () => {
    const state = parseSessionState({ ...validState, dialogue: { nodeId: 99 } })
    expect(state.dialogue).toBeNull()
  })

  it("does not mutate or alias the default state across calls", () => {
    const a = parseSessionState(null)
    a.flags.poisoned = true
    a.nodesVisited.push("x")
    const b = parseSessionState(null)
    expect(b.flags).toEqual({})
    expect(b.nodesVisited).toEqual([])
  })
})

// ─── NARRATIVE HISTORY CAP ───────────────────────────────────

import { appendNarrativeEntry, NARRATIVE_HISTORY_CAP } from "@/lib/engine/session"
import type { NarrativeHistoryEntry } from "@/types/session"

function entry(n: number): NarrativeHistoryEntry {
  return {
    nodeId: `node-${n}`,
    content: `prose ${n}`,
    scaffold: {
      nodeId: `node-${n}`,
      nodeLabel: `Node ${n}`,
      beatAchieved: "x",
      keyFactsEstablished: [],
      stateSnapshot: {},
    },
    generatedAt: "2026-01-01T00:00:00Z",
  }
}

describe("appendNarrativeEntry", () => {
  it("appends normally below the cap", () => {
    const history: NarrativeHistoryEntry[] = [entry(1), entry(2)]
    appendNarrativeEntry(history, entry(3))
    expect(history).toHaveLength(3)
    expect(history[2].nodeId).toBe("node-3")
  })

  it("drops the oldest entries once the cap is reached", () => {
    const history: NarrativeHistoryEntry[] = []
    for (let i = 1; i <= NARRATIVE_HISTORY_CAP; i++) appendNarrativeEntry(history, entry(i))
    expect(history).toHaveLength(NARRATIVE_HISTORY_CAP)

    appendNarrativeEntry(history, entry(NARRATIVE_HISTORY_CAP + 1))
    expect(history).toHaveLength(NARRATIVE_HISTORY_CAP)
    expect(history[0].nodeId).toBe("node-2")
    expect(history[history.length - 1].nodeId).toBe(`node-${NARRATIVE_HISTORY_CAP + 1}`)
  })
})
