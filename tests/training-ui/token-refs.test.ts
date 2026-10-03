import { describe, it, expect } from "vitest"
import path from "node:path"
import { brandTokens, defaultBrandPack } from "@/lib/training/brand-pack"
import { REPO, read, rel, walk } from "../helpers/source-files"

/** A typo'd var(--tg-x) falls back silently, like an unstyled class. */
const STYLES = path.join(REPO, "components/training-ui/styles")
const cssFiles = walk(STYLES).filter((f) => f.endsWith(".css"))
const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "")

const declared = new Set<string>(Object.keys(brandTokens(defaultBrandPack("X"))))
for (const f of cssFiles) for (const m of strip(read(f)).matchAll(/(--tg-[a-z0-9-]+)\s*:/g)) declared.add(m[1])

describe("token references", () => {
  it("every var(--tg-*) used in the training stylesheets is defined", () => {
    const missing: string[] = []
    for (const f of cssFiles) {
      for (const m of strip(read(f)).matchAll(/var\(\s*(--tg-[a-z0-9-]+)/g)) {
        if (!declared.has(m[1]) && !m[1].startsWith("--tg-ff-")) missing.push(`${rel(f)}: ${m[1]}`)
      }
    }
    expect([...new Set(missing)]).toEqual([])
  })
})
