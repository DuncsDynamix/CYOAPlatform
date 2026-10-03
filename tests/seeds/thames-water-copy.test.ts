import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import path from "node:path"

describe("Thames Water seed copy", () => {
  it("has no em-dashes in segment descriptions", () => {
    const src = readFileSync(path.resolve(__dirname, "../../prisma/seed-thames-water.ts"), "utf8")
    const descriptions = [...src.matchAll(/description: "([^"]*)"/g)].map((m) => m[1])
    expect(descriptions.length).toBeGreaterThan(0)
    for (const d of descriptions) expect(d).not.toMatch(/—/)
  })
})
