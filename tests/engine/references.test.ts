import { describe, it, expect } from "vitest"
import { referencesFor, selectWithinBudget, renderReference, buildReferenceBlock, mustOverBudget } from "@/lib/engine/references"
import type { ReferenceItem } from "@/lib/engine/contract"
import { createTestContextPack } from "../helpers/factories"

const text = (id: string, role: ReferenceItem["role"], priority: ReferenceItem["priority"], body = "x", visibleTo?: ReferenceItem["visibleTo"]): ReferenceItem =>
  ({ id, label: id, role, priority, source: { kind: "text", text: body }, ...(visibleTo && { visibleTo }) })

describe("referencesFor", () => {
  it("applies role defaults", () => {
    const items = [text("r", "reference", "must"), text("e", "exemplar", "must"), text("c", "case_data", "must")]
    expect(referencesFor(items, "scenes").map((i) => i.id)).toEqual(["r", "c"])
    expect(referencesFor(items, "characters").map((i) => i.id)).toEqual(["r", "e", "c"])
    expect(referencesFor(items, "assessor").map((i) => i.id)).toEqual(["r", "e"])
  })
  it("honours explicit visibleTo", () => {
    expect(referencesFor([text("r", "reference", "must", "x", ["assessor"])], "characters")).toEqual([])
  })
  it("never includes retrieval items", () => {
    const r: ReferenceItem = { id: "q", label: "q", role: "reference", priority: "must", source: { kind: "retrieval", ref: "manual" } }
    expect(referencesFor([r], "scenes")).toEqual([])
  })
})

describe("selectWithinBudget", () => {
  it("includes must, then should, then may until the budget is reached", () => {
    const items = [text("may", "reference", "may", "a".repeat(50)), text("should", "reference", "should", "b".repeat(50)), text("must", "reference", "must", "c".repeat(50))]
    expect(selectWithinBudget(items, 140).map((i) => i.id)).toEqual(["must", "should"])
  })
  it("always includes must items even over budget", () => {
    expect(selectWithinBudget([text("big", "reference", "must", "z".repeat(500))], 10).map((i) => i.id)).toEqual(["big"])
  })
})

describe("renderReference", () => {
  it("renders transcripts as speaker lines", () => {
    const t: ReferenceItem = { id: "t", label: "Call 12", role: "exemplar", priority: "should", source: { kind: "transcript", turns: [{ speaker: "Customer", text: "Hello?" }, { speaker: "Agent", text: "Hi" }] } }
    expect(renderReference(t)).toBe("Call 12 (transcript):\nCustomer: Hello?\nAgent: Hi")
  })
})

describe("buildReferenceBlock", () => {
  it("returns empty string when nothing is visible", () => {
    const pack = createTestContextPack()
    pack.core.references = [text("c", "case_data", "must")]
    expect(buildReferenceBlock(pack, "assessor")).toBe("")
  })
  it("labels exemplars for characters", () => {
    const pack = createTestContextPack()
    pack.core.references = [text("e", "exemplar", "must", "Customer: I want a refund")]
    expect(buildReferenceBlock(pack, "characters")).toContain("EXAMPLES OF REAL")
  })
  it("adds session case data", () => {
    const pack = createTestContextPack()
    pack.core.references = []
    expect(buildReferenceBlock(pack, "scenes", [text("acct", "case_data", "must", "Balance £40")])).toContain("Balance £40")
  })
})

describe("mustOverBudget", () => {
  it("flags audiences whose must items exceed the budget", () => {
    const pack = createTestContextPack()
    pack.core.references = [text("big", "reference", "must", "z".repeat(13000))]
    expect(mustOverBudget(pack)).toEqual(["scenes", "characters", "assessor"])
  })
})
