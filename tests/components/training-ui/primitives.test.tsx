import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { BrandScope } from "@/components/training-ui/BrandScope"
import { Prose } from "@/components/training-ui/Prose"
import { StatusChip } from "@/components/training-ui/StatusChip"
import { Avatar, avatarTone, initials } from "@/components/training-ui/Avatar"
import { Footer, Screen, ScreenBody } from "@/components/training-ui/Screen"
import { resolveBrandPack } from "@/lib/training/brand-pack"

const goldTap = resolveBrandPack({
  name: "Gold Tap Training",
  brandPack: {
    displayName: "Gold Tap Training",
    colours: { brand: "#C09F51", onBrand: "#1F2124", header: "dark", surfaceTone: "warm" },
    fonts: { heading: "montserrat", body: "open-sans" },
  },
})

describe("BrandScope", () => {
  it("applies the pack as --tg-* properties", () => {
    const { container } = render(<BrandScope pack={goldTap}><p>x</p></BrandScope>)
    const scope = container.firstElementChild as HTMLElement
    expect(scope).toHaveClass("tg-scope")
    expect(scope.dataset.header).toBe("dark")
    expect(scope.style.getPropertyValue("--tg-brand")).toBe("#C09F51")
    expect(scope.style.getPropertyValue("--tg-font-heading")).toContain("var(--tg-ff-montserrat)")
  })
})

describe("Prose", () => {
  it("renders GFM tables as real tables", () => {
    const { container } = render(<Prose text={"| Item | Rule |\n|------|------|\n| Pipes | Capped |\n"} />)
    expect(container.querySelector("table")).not.toBeNull()
    expect(container.textContent).not.toContain("|------")
  })
})

describe("StatusChip", () => {
  it("labels every status in text, and never styles not assessed as a fail", () => {
    render(
      <>
        <StatusChip status="passed" />
        <StatusChip status="not_passed" />
        <StatusChip status="not_assessed" />
      </>
    )
    expect(screen.getByText("Demonstrated")).toHaveClass("tg-chip--pass")
    expect(screen.getByText("Not yet demonstrated")).toHaveClass("tg-chip--fail")
    const na = screen.getByText("Not assessed")
    expect(na).toHaveClass("tg-chip--na")
    expect(na.className).not.toMatch(/fail/)
  })
})

describe("Avatar", () => {
  it("shows initials on a stable tone", () => {
    expect(initials("Margaret Hale")).toBe("MH")
    expect(initials("dean")).toBe("D")
    const tone = avatarTone("Margaret Hale")
    expect(tone).toBeGreaterThanOrEqual(1)
    expect(tone).toBeLessThanOrEqual(6)
    expect(avatarTone("Margaret Hale")).toBe(tone)
    const { container } = render(<Avatar name="Margaret Hale" />)
    expect(container.firstElementChild).toHaveClass(`tg-avatar--${tone}`)
    expect(container.textContent).toBe("MH")
  })
})

describe("Screen", () => {
  it("puts actions in a footer after the body", () => {
    const { container } = render(
      <Screen>
        <ScreenBody><p>Body</p></ScreenBody>
        <Footer><button>Continue</button></Footer>
      </Screen>
    )
    expect(container.querySelector(".tg-screen-body.tg-read")).not.toBeNull()
    expect(container.querySelector(".tg-footer button")).toHaveTextContent("Continue")
  })
})
