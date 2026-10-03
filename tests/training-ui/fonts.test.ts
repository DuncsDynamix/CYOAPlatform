import { describe, it, expect } from "vitest"
import path from "node:path"
import { FONT_KEYS } from "@/lib/training/brand-pack"
import { REPO, read } from "../helpers/source-files"

// fonts.ts is compiled by next/font, which cannot run under Vitest, so the
// file is checked as text.
describe("training fonts", () => {
  const src = read(path.join(REPO, "app/(traverse-training)/fonts.ts"))

  it("defines a --tg-ff-* variable for every curated font key", () => {
    for (const key of FONT_KEYS) expect(src, key).toContain(`variable: "--tg-ff-${key}"`)
  })

  it("never preloads, so a page downloads only the faces it uses", () => {
    const calls = src.match(/variable: "--tg-ff-/g) ?? []
    const noPreload = src.match(/preload: false/g) ?? []
    expect(noPreload.length).toBe(calls.length)
  })
})
