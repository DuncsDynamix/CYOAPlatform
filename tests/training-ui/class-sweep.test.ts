import { describe, it, expect } from "vitest"
import path from "node:path"
import { REPO, read, rel, walk } from "../helpers/source-files"

/**
 * Every tg- class used in markup must have a rule in the training
 * stylesheets (an unstyled class is a recurring defect in this repo), and
 * every stylesheet must be loaded by the training layout. Class names are
 * read from string literals; `tg-x--${...}` counts as a prefix.
 */
const UI = path.join(REPO, "components/training-ui")
const PAGES = path.join(REPO, "app/(traverse-training)")
const tsxFiles = [...walk(UI), ...walk(PAGES)].filter((f) => f.endsWith(".tsx"))
const cssFiles = walk(path.join(UI, "styles")).filter((f) => f.endsWith(".css"))
const defined = new Set(cssFiles.flatMap((f) => [...read(f).matchAll(/\.(tg-[a-z0-9_-]+)/g)].map((m) => m[1])))

export function usedClasses(src: string): { name: string; prefix: boolean }[] {
  return [...src.matchAll(/(?<![\w-])(tg-[a-z0-9-]*[a-z0-9-])(\$\{)?/g)].map((m) => ({ name: m[1], prefix: Boolean(m[2]) }))
}

describe("training UI class sweep", () => {
  it("reads plain, template and ternary class literals", () => {
    expect(usedClasses('<a className={wide ? "tg-a" : `tg-b tg-c--${x}`} />')).toEqual([
      { name: "tg-a", prefix: false },
      { name: "tg-b", prefix: false },
      { name: "tg-c--", prefix: true },
    ])
    expect(usedClasses('style={{ color: "var(--tg-brand)" }}')).toEqual([])
  })

  it("every tg- class used in markup has a CSS rule", () => {
    const missing: string[] = []
    for (const file of tsxFiles) {
      for (const c of usedClasses(read(file))) {
        const ok = c.prefix ? [...defined].some((d) => d.startsWith(c.name)) : defined.has(c.name)
        if (!ok) missing.push(`${rel(file)}: ${c.name}${c.prefix ? "*" : ""}`)
      }
    }
    expect([...new Set(missing)]).toEqual([])
  })

  it("never builds a class name dynamically", () => {
    const BARE = /(?<![\w-])tg-(?=["'`]|\$\{)/
    expect(BARE.test('"tg-" + x')).toBe(true)
    expect(BARE.test("`tg-${x}`")).toBe(true)
    expect(BARE.test("`tg-chip--${x}`")).toBe(false)
    expect(BARE.test('"tg-btn"')).toBe(false)
    const offenders = tsxFiles.flatMap((f) => (BARE.test(read(f)) ? [rel(f)] : []))
    expect(offenders).toEqual([])
  })

  it("every training stylesheet is imported by the training layout", () => {
    const layout = read(path.join(PAGES, "layout.tsx"))
    for (const f of cssFiles) expect(layout, path.basename(f)).toContain(`@/components/training-ui/styles/${path.basename(f)}`)
  })
})
