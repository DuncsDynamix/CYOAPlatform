import { describe, it, expect } from "vitest"
import { hasTrainingAccess, TRAINING_PATHS, PUBLIC_PATHS, AUTHED_PATHS } from "../../middleware"

describe("hasTrainingAccess — pure access control logic", () => {
  it("denies access when profile is null", () => {
    expect(hasTrainingAccess(null)).toBe(false)
  })

  it("denies access when isOperator is false and orgId is null", () => {
    expect(hasTrainingAccess({ isOperator: false, orgId: null })).toBe(false)
  })

  it("allows access when isOperator is true", () => {
    expect(hasTrainingAccess({ isOperator: true, orgId: null })).toBe(true)
  })

  it("allows access when orgId is set (non-operator org member)", () => {
    expect(hasTrainingAccess({ isOperator: false, orgId: "org-abc-123" })).toBe(true)
  })

  it("allows access when both isOperator and orgId are set", () => {
    expect(hasTrainingAccess({ isOperator: true, orgId: "org-abc-123" })).toBe(true)
  })

  it("denies access when isOperator is null and orgId is null", () => {
    expect(hasTrainingAccess({ isOperator: null, orgId: null })).toBe(false)
  })
})

describe("TRAINING_PATHS constant", () => {
  it("includes /scenario", () => {
    expect(TRAINING_PATHS).toContain("/scenario")
  })

  it("does not include public paths that should remain open", () => {
    for (const path of PUBLIC_PATHS) {
      expect(TRAINING_PATHS).not.toContain(path)
    }
  })

  it("does not overlap with AUTHED_PATHS", () => {
    for (const path of AUTHED_PATHS) {
      expect(TRAINING_PATHS).not.toContain(path)
    }
  })
})

describe("PUBLIC_PATHS constant", () => {
  it("includes /login", () => {
    expect(PUBLIC_PATHS).toContain("/login")
  })

  it("includes /api/v1/engine/stream (versioned path)", () => {
    expect(PUBLIC_PATHS).toContain("/api/v1/engine/stream")
  })

  it("does not include the old unversioned engine stream path", () => {
    expect(PUBLIC_PATHS).not.toContain("/api/engine/stream")
  })
})
