import { describe, it, expect } from "vitest"
import path from "node:path"
import { REPO, read, rel, walk } from "../helpers/source-files"

/**
 * Brand packs only work if nothing outside the token layer names a colour
 * or a font. The token layer is tokens.css and fonts.ts (lib/training/
 * brand-pack.ts is outside the scanned folders).
 */
const UI = path.join(REPO, "components/training-ui")
const PAGES = path.join(REPO, "app/(traverse-training)")
const TOKEN_LAYER = new Set([path.join(UI, "styles/tokens.css"), path.join(PAGES, "fonts.ts")])
const files = [...walk(UI), ...walk(PAGES)].filter((f) => /\.(ts|tsx|css)$/.test(f) && !TOKEN_LAYER.has(f))

const COLOUR = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(/
const FONT_NAME = /\b(?:Montserrat|Open[ _]Sans|Inter|Source[ _]Serif|Lato|Nunito|Arial|Helvetica|Georgia|Roboto|Times New Roman|system-ui|sans-serif|monospace)\b/
const FONT_DECL = /font-family\s*:(?!\s*(?:var\(--tg-font-(?:heading|body)\)|inherit)\s*[;}])/
const FONT_SHORTHAND = /(?<![\w-])font\s*:(?!\s*inherit\s*[;}])/

function stripComments(src: string): string {
  // Each comment becomes the same number of newlines, so line numbers stay true.
  const blank = (m: string) => m.replace(/[^\n]/g, "")
  return src.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/^[ \t]*\/\/.*$/gm, "")
}

describe("training UI hardcoding guard", () => {
  it("scans the training UI", () => {
    expect(files.some((f) => f.endsWith("BrandScope.tsx"))).toBe(true)
  })

  it("has no colour literals or font names outside the token layer", () => {
    const offenders: string[] = []
    for (const file of files) {
      const isCss = file.endsWith(".css")
      stripComments(read(file))
        .split("\n")
        .forEach((line, i) => {
          const at = `${rel(file)}:${i + 1}: ${line.trim()}`
          if (COLOUR.test(line)) offenders.push(`colour  ${at}`)
          if (FONT_NAME.test(line)) offenders.push(`font    ${at}`)
          if (isCss && (FONT_DECL.test(line) || FONT_SHORTHAND.test(line))) offenders.push(`family  ${at}`)
          if (!isCss && /\bfontFamily\b/.test(line)) offenders.push(`family  ${at}`)
        })
    }
    expect(offenders).toEqual([])
  })

  it("catches what it should and allows the token references", () => {
    expect(COLOUR.test("color: #C09F51;")).toBe(true)
    expect(COLOUR.test('<path stroke="#fff" />')).toBe(true)
    expect(COLOUR.test("box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);")).toBe(true)
    expect(COLOUR.test("color: var(--tg-brand);")).toBe(false)
    expect(FONT_NAME.test("font-family: Montserrat, sans-serif;")).toBe(true)
    expect(FONT_DECL.test("font-family: var(--tg-font-body);")).toBe(false)
    expect(FONT_DECL.test("font-family: serif;")).toBe(true)
    expect(FONT_SHORTHAND.test("font: inherit;")).toBe(false)
    expect(FONT_SHORTHAND.test("font: 16px serif;")).toBe(true)
  })
})
