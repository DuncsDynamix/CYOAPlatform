import { describe, it, expect } from "vitest"
import path from "node:path"
import { contrastRatio, MIN_CONTRAST } from "@/lib/training/brand-pack"
import { REPO, read } from "../helpers/source-files"

const css = read(path.join(REPO, "components/training-ui/styles/tokens.css"))
const token = (name: string): string => {
  const m = css.match(new RegExp(`--tg-${name}:\\s*(#[0-9A-Fa-f]{6})`))
  if (!m) throw new Error(`token --tg-${name} not found`)
  return m[1]
}

describe("fixed token contrast", () => {
  it("status chips and tone text are readable on their tints", () => {
    for (const s of ["pass", "fail", "na"]) {
      expect(contrastRatio(token(`status-${s}-ink`), token(`status-${s}-tint`)), s).toBeGreaterThanOrEqual(MIN_CONTRAST)
    }
    expect(contrastRatio(token("tone-develop"), token("tone-develop-tint"))).toBeGreaterThanOrEqual(MIN_CONTRAST)
    expect(contrastRatio(token("tone-develop"), "#FFFFFF")).toBeGreaterThanOrEqual(MIN_CONTRAST)
    expect(contrastRatio(token("status-na-ink"), "#FFFFFF")).toBeGreaterThanOrEqual(MIN_CONTRAST)
  })

  it("white text reads on every avatar and status fill", () => {
    const fg = token("avatar-fg")
    for (let i = 1; i <= 6; i++) expect(contrastRatio(token(`avatar-${i}`), fg), `avatar-${i}`).toBeGreaterThanOrEqual(MIN_CONTRAST)
    for (const s of ["pass", "fail", "na"]) expect(contrastRatio(token(`status-${s}`), fg), s).toBeGreaterThanOrEqual(MIN_CONTRAST)
  })
})
