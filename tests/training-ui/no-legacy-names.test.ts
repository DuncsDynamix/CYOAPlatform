import { describe, it, expect } from "vitest"
import { existsSync } from "node:fs"
import path from "node:path"
import { REPO, read, rel, walk } from "../helpers/source-files"

const files = ["app", "components", "lib"]
  .flatMap((d) => walk(path.join(REPO, d)))
  .filter((f) => /\.(ts|tsx|css)$/.test(f))

describe("legacy training UI", () => {
  it("is gone", () => {
    for (const p of ["components/training", "components/traverse-training", "app/globals-traverse-training.css", "lib/branding.ts"]) {
      expect(existsSync(path.join(REPO, p)), p).toBe(false)
    }
  })

  it("leaves no t-, tt-, --t- or --c- names behind", () => {
    const offenders: string[] = []
    for (const file of files) {
      const src = read(file)
      if (/--(?:t|c)-[a-z]/.test(src)) offenders.push(`${rel(file)}: --t- or --c- token`)
      if (file.endsWith(".css")) {
        if (/(?<![\w-])\.(?:t|tt)-[a-z]/.test(src)) offenders.push(`${rel(file)}: .t- or .tt- selector`)
        continue
      }
      for (const m of src.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\}|\{"([^"]*)"\})/g)) {
        const value = m[1] ?? m[2] ?? m[3] ?? ""
        if (/(?<![\w-])(?:t|tt)-[a-z]/.test(value)) offenders.push(`${rel(file)}: class "${value}"`)
      }
    }
    expect(offenders).toEqual([])
  })
})
