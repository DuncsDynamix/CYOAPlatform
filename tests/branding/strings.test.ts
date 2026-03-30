import { describe, it, expect } from "vitest"
import { readFileSync } from "fs"
import { join } from "path"

const OLD_BRANDS = ["Turn To Page", "TurnToPage", "PageEngine", "Authoring Tool"]

function readSource(relPath: string): string {
  return readFileSync(join(process.cwd(), relPath), "utf-8")
}

function assertNoBrandStrings(content: string, filePath: string) {
  for (const brand of OLD_BRANDS) {
    expect(content, `"${brand}" found in ${filePath}`).not.toContain(brand)
  }
}

describe("User-facing brand strings", () => {
  it("reader layout contains no old brand names", () => {
    assertNoBrandStrings(readSource("app/(reader)/layout.tsx"), "app/(reader)/layout.tsx")
  })

  it("authoring layout contains no old brand names", () => {
    assertNoBrandStrings(readSource("app/(authoring)/layout.tsx"), "app/(authoring)/layout.tsx")
  })

  it("root layout contains no old brand names", () => {
    assertNoBrandStrings(readSource("app/layout.tsx"), "app/layout.tsx")
  })

  it("login page contains no old brand names", () => {
    assertNoBrandStrings(readSource("app/(auth)/login/page.tsx"), "app/(auth)/login/page.tsx")
  })

  it("signup page contains no old brand names", () => {
    assertNoBrandStrings(readSource("app/(auth)/signup/page.tsx"), "app/(auth)/signup/page.tsx")
  })

  it("OutcomeCard contains no old brand names", () => {
    assertNoBrandStrings(
      readSource("components/reader/OutcomeCard.tsx"),
      "components/reader/OutcomeCard.tsx"
    )
  })

  it("ExperienceForm contains no old brand names", () => {
    assertNoBrandStrings(
      readSource("components/authoring/ExperienceForm.tsx"),
      "components/authoring/ExperienceForm.tsx"
    )
  })

  it("reader home page contains no old brand names", () => {
    assertNoBrandStrings(readSource("app/(reader)/page.tsx"), "app/(reader)/page.tsx")
  })
})
