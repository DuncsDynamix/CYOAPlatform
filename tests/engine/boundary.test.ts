import { describe, it, expect } from "vitest"
import { execSync } from "child_process"

const grep = (pattern: string, paths: string) => {
  try {
    return execSync(`grep -rlE '${pattern}' ${paths}`, { encoding: "utf8" }).trim().split("\n").filter(Boolean)
  } catch {
    return []
  }
}

describe("engine boundary", () => {
  it("app code imports only the engine entry point (or the client-safe entry)", () => {
    // matches any deep engine import except "@/lib/engine/client"
    expect(grep('from "@/lib/engine/([abd-z]|c[^l]|cl[^i])', "app components lib/library lib/training lib/voice lib/authoring lib/api")).toEqual([])
  })
  it("the engine never imports app layers", () => {
    expect(grep('from "@/(lib/library|lib/training|components|app)/', "lib/engine")).toEqual([])
  })
})
