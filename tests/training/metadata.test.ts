import { describe, it, expect } from "vitest"
import { trainingMetadata } from "@/lib/training/metadata"
import { resolveBrandPack } from "@/lib/training/brand-pack"

describe("trainingMetadata", () => {
  it("titles the page with the pack's name and uses its mark as the favicon", () => {
    const pack = resolveBrandPack({
      name: "Gold Tap Training",
      brandPack: {
        displayName: "Gold Tap Training",
        logo: { onLight: "/b/l.png", onDark: "/b/d.png", mark: "/b/mark.png" },
        colours: { brand: "#C09F51", onBrand: "#1F2124", header: "dark", surfaceTone: "warm" },
        fonts: { heading: "montserrat", body: "open-sans" },
      },
    })
    expect(trainingMetadata(pack, "The Doorstep")).toEqual({ title: "The Doorstep | Gold Tap Training", icons: { icon: "/b/mark.png" } })
    expect(trainingMetadata(pack)).toEqual({ title: "Gold Tap Training", icons: { icon: "/b/mark.png" } })
  })

  it("omits the favicon without a logo", () => {
    expect(trainingMetadata(resolveBrandPack({ name: "Plain", brandPack: null }))).toEqual({ title: "Plain" })
  })
})
