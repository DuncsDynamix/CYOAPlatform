import { describe, it, expect } from "vitest"
import { canEditExperience, canDeleteExperience, canAccessExperience, isOrgMember, type AuthUser } from "@/lib/auth"

const ORG_A = "org-aaaa"
const ORG_B = "org-bbbb"

function user(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: "user-1",
    email: "u@example.com",
    isOperator: false,
    orgId: null,
    orgRole: null,
    ...overrides,
  }
}

const orgExperience = { authorId: "author-1", orgId: ORG_A, status: "published" }
const orgDraft = { authorId: "author-1", orgId: ORG_A, status: "draft" }
const publicExperience = { authorId: "author-1", orgId: null, status: "published" }
const privateDraft = { authorId: "author-1", orgId: null, status: "draft" }

describe("isOrgMember", () => {
  it("is true only when both sides have the same org", () => {
    expect(isOrgMember(user({ orgId: ORG_A }), ORG_A)).toBe(true)
    expect(isOrgMember(user({ orgId: ORG_B }), ORG_A)).toBe(false)
    expect(isOrgMember(user(), ORG_A)).toBe(false)
    expect(isOrgMember(null, ORG_A)).toBe(false)
    expect(isOrgMember(user({ orgId: ORG_A }), null)).toBe(false)
  })
})

describe("canEditExperience", () => {
  it("allows the original author", async () => {
    expect(await canEditExperience(user({ id: "author-1" }), orgExperience)).toBe(true)
    expect(await canEditExperience(user({ id: "author-1" }), privateDraft)).toBe(true)
  })

  it("allows org owners and authors to edit org-mates' org experiences", async () => {
    expect(await canEditExperience(user({ orgId: ORG_A, orgRole: "owner" }), orgExperience)).toBe(true)
    expect(await canEditExperience(user({ orgId: ORG_A, orgRole: "author" }), orgExperience)).toBe(true)
  })

  it("denies org learners, cross-org users, and anonymous", async () => {
    expect(await canEditExperience(user({ orgId: ORG_A, orgRole: "learner" }), orgExperience)).toBe(false)
    expect(await canEditExperience(user({ orgId: ORG_B, orgRole: "owner" }), orgExperience)).toBe(false)
    expect(await canEditExperience(null, orgExperience)).toBe(false)
  })

  it("denies non-authors on non-org experiences", async () => {
    expect(await canEditExperience(user({ id: "someone-else" }), publicExperience)).toBe(false)
  })
})

describe("canDeleteExperience", () => {
  it("allows the original author and org owners only", async () => {
    expect(await canDeleteExperience(user({ id: "author-1" }), orgExperience)).toBe(true)
    expect(await canDeleteExperience(user({ orgId: ORG_A, orgRole: "owner" }), orgExperience)).toBe(true)
    expect(await canDeleteExperience(user({ orgId: ORG_A, orgRole: "author" }), orgExperience)).toBe(false)
    expect(await canDeleteExperience(user({ orgId: ORG_A, orgRole: "learner" }), orgExperience)).toBe(false)
  })
})

describe("canAccessExperience (playing)", () => {
  it("keeps non-org published experiences public (B2C unchanged)", async () => {
    expect(await canAccessExperience(null, publicExperience)).toBe(true)
    expect(await canAccessExperience(user(), publicExperience)).toBe(true)
  })

  it("keeps non-org drafts author-only", async () => {
    expect(await canAccessExperience(user({ id: "author-1" }), privateDraft)).toBe(true)
    expect(await canAccessExperience(user({ id: "someone-else" }), privateDraft)).toBe(false)
    expect(await canAccessExperience(null, privateDraft)).toBe(false)
  })

  it("restricts published org experiences to org members of any role", async () => {
    expect(await canAccessExperience(user({ orgId: ORG_A, orgRole: "learner" }), orgExperience)).toBe(true)
    expect(await canAccessExperience(user({ orgId: ORG_A, orgRole: "owner" }), orgExperience)).toBe(true)
    expect(await canAccessExperience(user({ orgId: ORG_B, orgRole: "owner" }), orgExperience)).toBe(false)
    expect(await canAccessExperience(user(), orgExperience)).toBe(false)
  })

  it("denies anonymous users on org experiences", async () => {
    expect(await canAccessExperience(null, orgExperience)).toBe(false)
  })

  it("lets org owners and authors test-play org drafts, but not learners", async () => {
    expect(await canAccessExperience(user({ orgId: ORG_A, orgRole: "author" }), orgDraft)).toBe(true)
    expect(await canAccessExperience(user({ orgId: ORG_A, orgRole: "owner" }), orgDraft)).toBe(true)
    expect(await canAccessExperience(user({ orgId: ORG_A, orgRole: "learner" }), orgDraft)).toBe(false)
  })

  it("lets operators access org experiences", async () => {
    expect(await canAccessExperience(user({ isOperator: true }), orgExperience)).toBe(true)
  })
})
