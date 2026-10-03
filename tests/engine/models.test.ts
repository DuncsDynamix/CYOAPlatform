import { describe, it, expect } from "vitest"
import { readFileSync, readdirSync } from "fs"
import { join } from "path"
import { MODEL_MAP } from "@/lib/engine/models"

describe("MODEL_MAP", () => {
  it("uses only current model IDs", () => {
    const allowed = new Set(["claude-sonnet-5-5", "claude-haiku-4-5", "claude-opus-5-5"])
    for (const spec of Object.values(MODEL_MAP)) expect(allowed.has(spec.model)).toBe(true)
  })

  it("never sends disabled thinking to a Sonnet 5.5 call", () => {
    for (const spec of Object.values(MODEL_MAP)) {
      expect((spec.thinking as { type: string } | undefined)?.type).not.toBe("disabled")
    }
  })

  it("assessment uses Sonnet 5.5 with adaptive thinking and a large budget", () => {
    expect(MODEL_MAP.evaluative).toMatchObject({ model: "claude-sonnet-5-5", thinking: { type: "adaptive" }, effort: "medium" })
    expect(MODEL_MAP.evaluative.maxTokens).toBeGreaterThanOrEqual(8000)
  })

  it("no engine file names a model outside models.ts", () => {
    const dir = "lib/engine"
    const offenders = readdirSync(dir)
      .filter((f) => f.endsWith(".ts") && f !== "models.ts")
      .filter((f) => /["']claude-[a-z0-9-]+["']/.test(readFileSync(join(dir, f), "utf8")))
    expect(offenders).toEqual([])
  })
})
