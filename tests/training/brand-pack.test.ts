import { describe, it, expect, vi } from "vitest"
import {
  BrandPackSchema, brandPackIssues, brandTokens, contrastRatio, defaultBrandPack, deriveInk,
  MIN_CONTRAST, NEUTRALS, resolveBrandPack, type BrandPack,
} from "@/lib/training/brand-pack"

const goldTap: BrandPack = {
  displayName: "Gold Tap Training",
  logo: { onLight: "/brands/gold-tap-training/logo-on-light.png", onDark: "/brands/gold-tap-training/logo-on-dark.png", mark: "/brands/gold-tap-training/mark.png" },
  colours: { brand: "#C09F51", onBrand: "#1F2124", header: "dark", surfaceTone: "warm" },
  fonts: { heading: "montserrat", body: "open-sans" },
  recordPrefix: "GT",
}

describe("contrastRatio", () => {
  it("matches WCAG reference values", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 0)
    expect(contrastRatio("#FFFFFF", "#FFFFFF")).toBeCloseTo(1, 5)
  })
})

describe("deriveInk", () => {
  it("darkens a pale brand until it is readable on the surface", () => {
    const ink = deriveInk("#C09F51", NEUTRALS.warm.surface)
    expect(contrastRatio(ink, NEUTRALS.warm.surface)).toBeGreaterThanOrEqual(MIN_CONTRAST)
    expect(ink).not.toBe("#C09F51")
  })
  it("returns an already-readable colour unchanged", () => {
    expect(deriveInk("#1F2124", "#FFFFFF")).toBe("#1F2124")
  })
})

describe("resolveBrandPack", () => {
  it("returns the neutral default named after the org when there is no pack", () => {
    const pack = resolveBrandPack({ name: "Acme Water", brandPack: null })
    expect(pack.isDefault).toBe(true)
    expect(pack.displayName).toBe("Acme Water")
    expect(brandPackIssues(pack)).toEqual([])
  })

  it("resolves a valid pack and derives brand ink", () => {
    const pack = resolveBrandPack({ name: "Gold Tap", brandPack: goldTap })
    expect(pack.isDefault).toBe(false)
    expect(pack.displayName).toBe("Gold Tap Training")
    expect(contrastRatio(pack.colours.brandInk, NEUTRALS.warm.surface)).toBeGreaterThanOrEqual(MIN_CONTRAST)
  })

  it("falls back wholesale on a malformed pack, with a warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const pack = resolveBrandPack({ name: "Acme", brandPack: { colours: "gold" } })
    expect(pack.isDefault).toBe(true)
    expect(warn).toHaveBeenCalled()
  })

  it("replaces an unreadable brand/onBrand pair with the default pair", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {})
    const bad = { ...goldTap, colours: { ...goldTap.colours, onBrand: "#D0B070" } }
    const pack = resolveBrandPack({ name: "Gold Tap", brandPack: bad })
    expect(contrastRatio(pack.colours.onBrand, pack.colours.brand)).toBeGreaterThanOrEqual(MIN_CONTRAST)
    expect(pack.displayName).toBe("Gold Tap Training")
  })

  it("re-derives a supplied brand ink that fails contrast", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {})
    const bad = { ...goldTap, colours: { ...goldTap.colours, brandInk: "#E0D0A0" } }
    const pack = resolveBrandPack({ name: "Gold Tap", brandPack: bad })
    expect(contrastRatio(pack.colours.brandInk, NEUTRALS.warm.surface)).toBeGreaterThanOrEqual(MIN_CONTRAST)
  })
})

describe("BrandPackSchema", () => {
  it("rejects unknown fonts and bad hex", () => {
    expect(BrandPackSchema.safeParse({ ...goldTap, fonts: { heading: "comic-sans", body: "inter" } }).success).toBe(false)
    expect(BrandPackSchema.safeParse({ ...goldTap, colours: { ...goldTap.colours, brand: "gold" } }).success).toBe(false)
  })
})

describe("brandTokens", () => {
  it("emits the full token set with font variables", () => {
    const tokens = brandTokens(resolveBrandPack({ name: "Gold Tap", brandPack: goldTap }))
    expect(Object.keys(tokens).sort()).toEqual([
      "--tg-border", "--tg-brand", "--tg-brand-ink", "--tg-font-body", "--tg-font-heading",
      "--tg-header-bg", "--tg-header-control", "--tg-header-fg", "--tg-header-muted",
      "--tg-on-brand", "--tg-surface", "--tg-surface-raised", "--tg-text", "--tg-text-muted",
    ])
    expect(tokens["--tg-brand"]).toBe("#C09F51")
    expect(tokens["--tg-font-heading"]).toBe("var(--tg-ff-montserrat), system-ui, sans-serif")
    expect(tokens["--tg-surface"]).toBe(NEUTRALS.warm.surface)
  })

  it("gives two different packs different brand tokens", () => {
    const a = brandTokens(resolveBrandPack({ name: "Gold Tap", brandPack: goldTap }))
    const b = brandTokens(defaultBrandPack("Fernbrook"))
    expect(a["--tg-brand"]).not.toBe(b["--tg-brand"])
  })
})
