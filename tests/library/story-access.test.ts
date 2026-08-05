import { describe, it, expect } from "vitest"
import { canViewStory } from "@/lib/library/story-access"

const AUTHOR_ID = "author-1"
const ORG_ID = "org-1"

function experience(overrides: Partial<{ status: string; authorId: string; orgId: string | null }> = {}) {
  return { status: "draft", authorId: AUTHOR_ID, orgId: null, ...overrides }
}

describe("canViewStory — the story page's visibility rule", () => {
  it("published + anonymous -> true", () => {
    expect(canViewStory(null, experience({ status: "published" }))).toBe(true)
  })

  it("draft + anonymous -> false", () => {
    expect(canViewStory(null, experience({ status: "draft" }))).toBe(false)
  })

  it("preview + anonymous -> false (the leak this rule closes — canAccessExperience treats non-org preview as public)", () => {
    expect(canViewStory(null, experience({ status: "preview" }))).toBe(false)
  })

  it("preview + author -> true", () => {
    const viewer = { id: AUTHOR_ID, orgId: null, orgRole: null }
    expect(canViewStory(viewer, experience({ status: "preview" }))).toBe(true)
  })

  it("draft + org owner in the same org -> true", () => {
    const viewer = { id: "someone-else", orgId: ORG_ID, orgRole: "owner" }
    expect(canViewStory(viewer, experience({ status: "draft", orgId: ORG_ID }))).toBe(true)
  })

  it("draft + org learner in the same org -> false", () => {
    const viewer = { id: "someone-else", orgId: ORG_ID, orgRole: "learner" }
    expect(canViewStory(viewer, experience({ status: "draft", orgId: ORG_ID }))).toBe(false)
  })

  it("draft + unrelated user (no org) -> false", () => {
    const viewer = { id: "someone-else", orgId: null, orgRole: null }
    expect(canViewStory(viewer, experience({ status: "draft" }))).toBe(false)
  })
})
