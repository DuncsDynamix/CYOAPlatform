import { describe, it, expect } from "vitest"
import { DEMO_NODE_COPY } from "@/lib/training/demo-node-copy"

describe("DEMO_NODE_COPY", () => {
  it("has no em-dashes", () => {
    for (const [key, copy] of Object.entries(DEMO_NODE_COPY)) {
      expect(copy.label, key).not.toMatch(/—/)
      expect(copy.blurb, key).not.toMatch(/—/)
    }
  })
})
