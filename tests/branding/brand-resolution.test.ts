import { describe, it, expect } from "vitest"

const { resolveBrand, DEFAULT_BRAND } = await import("@/lib/branding")

describe("resolveBrand", () => {
  it("returns the configured brand for a known org slug", () => {
    const brand = resolveBrand("gold-tap")
    expect(brand.name).toBe("Gold Tap Training")
    expect(brand.accent).toMatch(/^#/)
  })

  it("falls back to the default brand for unknown slugs", () => {
    expect(resolveBrand("nobody")).toEqual(DEFAULT_BRAND)
  })

  it("falls back to the default brand for null/undefined", () => {
    expect(resolveBrand(null)).toEqual(DEFAULT_BRAND)
    expect(resolveBrand(undefined)).toEqual(DEFAULT_BRAND)
  })
})
