import { describe, it, expect } from "vitest"
import { readFileSync } from "fs"
import { join } from "path"

const manifest = JSON.parse(
  readFileSync(join(process.cwd(), "public/manifest.json"), "utf-8")
)

describe("PWA manifest branding", () => {
  it('name is "TraverseStories"', () => {
    expect(manifest.name).toBe("TraverseStories")
  })

  it('short_name is "TraverseStories"', () => {
    expect(manifest.short_name).toBe("TraverseStories")
  })

  it("description reflects new brand", () => {
    expect(manifest.description).toBe("Your story, written as you read it.")
  })

  it("does not contain old brand names", () => {
    const raw = JSON.stringify(manifest)
    expect(raw).not.toContain("Turn To Page")
    expect(raw).not.toContain("TurnToPage")
    expect(raw).not.toContain("PageEngine")
  })
})
