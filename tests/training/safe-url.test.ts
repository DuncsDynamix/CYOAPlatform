import { describe, it, expect } from "vitest"
import { AssetPath, LinkUrl } from "@/lib/training/safe-url"
import { BrandPackSchema } from "@/lib/training/brand-pack"
import { AccreditationSchema } from "@/lib/training/accreditations"
import { parsePresentation } from "@/lib/training/presentation"
import { BRAND_PACKS, ORG_ACCREDITATIONS, COURSE_PRESENTATION } from "../../prisma/seed-data/brand-packs"

const hostile = ["javascript:alert(1)", "data:image/svg+xml;base64,PHN2Zz4=", "//evil.com/x.png", "/a.png) ; background:url(x", "/a\\b.png", "/a\".png", "http://cdn.example.com/x.png"]

describe("AssetPath", () => {
  it.each(hostile)("rejects %s", (v) => {
    expect(AssetPath.safeParse(v).success).toBe(false)
  })
  it.each(["/brands/gold-tap-training/logo-on-light.png", "https://cdn.example.com/x.png"])("accepts %s", (v) => {
    expect(AssetPath.safeParse(v).success).toBe(true)
  })
})

describe("LinkUrl", () => {
  it.each(["javascript:alert(1)", "data:text/html,hi", "/relative", "ftp://x.example/f"])("rejects %s", (v) => {
    expect(LinkUrl.safeParse(v).success).toBe(false)
  })
  it.each(["https://www.eusr.co.uk/", "http://example.com/a"])("accepts %s", (v) => {
    expect(LinkUrl.safeParse(v).success).toBe(true)
  })
})

describe("schemas that carry URLs", () => {
  const pack = BRAND_PACKS["00000000-0000-0000-0000-000000000051"]

  it("brand pack logo and imagery must be safe asset paths", () => {
    expect(BrandPackSchema.safeParse({ ...pack, logo: { ...pack.logo!, mark: "javascript:alert(1)" } }).success).toBe(false)
    expect(BrandPackSchema.safeParse({ ...pack, imagery: { hero: "/a.png) ; background:url(x" } }).success).toBe(false)
  })

  it("accreditation badge is an asset path and url a web link", () => {
    const base = { id: "a", name: "A", awardingBody: "B", badge: "/b.png" }
    expect(AccreditationSchema.safeParse(base).success).toBe(true)
    expect(AccreditationSchema.safeParse({ ...base, badge: "data:image/png;base64,AAAA" }).success).toBe(false)
    expect(AccreditationSchema.safeParse({ ...base, url: "javascript:alert(1)" }).success).toBe(false)
  })

  it("course image must be a safe asset path", () => {
    expect(parsePresentation({ image: "//evil.com/x.png" }).image).toBeUndefined()
    expect(parsePresentation({ image: "/brands/x.jpg" }).image).toBe("/brands/x.jpg")
  })

  it("the demo seed data still validates", () => {
    for (const p of Object.values(BRAND_PACKS)) expect(BrandPackSchema.safeParse(p).success).toBe(true)
    for (const list of Object.values(ORG_ACCREDITATIONS)) for (const a of list) expect(AccreditationSchema.safeParse(a).success).toBe(true)
    for (const c of Object.values(COURSE_PRESENTATION)) if (c.image) expect(parsePresentation({ image: c.image }).image).toBe(c.image)
  })
})
