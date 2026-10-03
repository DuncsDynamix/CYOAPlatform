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

  it("prose and summary think at low effort, with room for thinking tokens (A3)", () => {
    expect(MODEL_MAP.prose).toMatchObject({ model: "claude-sonnet-5-5", thinking: { type: "adaptive" }, effort: "low", maxTokens: 2000 })
    expect(MODEL_MAP.summary).toMatchObject({ model: "claude-sonnet-5-5", thinking: { type: "adaptive" }, effort: "low", maxTokens: 1500 })
  })

  it("latency-sensitive kinds stay thinking-off via between_tools", () => {
    for (const kind of ["dialogue_opener", "dialogue_response", "observed_dialogue", "router", "bindery_json", "bindery_sample"] as const) {
      expect(MODEL_MAP[kind].thinking).toEqual({ type: "between_tools" })
    }
  })

  it("scaffold extraction has room to finish (A4)", () => {
    expect(MODEL_MAP.scaffold.maxTokens).toBe(800)
  })

  it("no engine file names a model outside models.ts", () => {
    const dir = "lib/engine"
    const offenders = readdirSync(dir)
      .filter((f) => f.endsWith(".ts") && f !== "models.ts")
      .filter((f) => /["']claude-[a-z0-9-]+["']/.test(readFileSync(join(dir, f), "utf8")))
    expect(offenders).toEqual([])
  })
})
