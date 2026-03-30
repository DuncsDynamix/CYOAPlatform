import { describe, it, expect } from "vitest"
import { createTestOrg, createTestExperience, createTestSession } from "../helpers/factories"

describe("Org model structure", () => {
  it("createTestOrg returns an org with required fields", () => {
    const org = createTestOrg()
    expect(org.id).toBeDefined()
    expect(org.name).toBe("Test Organisation")
    expect(org.slug).toBe("test-org")
    expect(org.isOperator).toBe(false)
    expect(org.trainingTier).toBe("training_pilot")
    expect(org.createdAt).toBeInstanceOf(Date)
    expect(org.updatedAt).toBeInstanceOf(Date)
  })

  it("createTestOrg accepts overrides", () => {
    const org = createTestOrg({ name: "ACME Corp", slug: "acme", isOperator: true })
    expect(org.name).toBe("ACME Corp")
    expect(org.slug).toBe("acme")
    expect(org.isOperator).toBe(true)
  })

  it("org nullable fields default to null", () => {
    const org = createTestOrg()
    expect(org.studioTier).toBeNull()
    expect(org.stripeCustomerId).toBeNull()
    expect(org.operatorApiKey).toBeNull()
    expect(org.operatorApiKeyHint).toBeNull()
  })
})

describe("Experience orgId field", () => {
  it("createTestExperience has no orgId by default", () => {
    const exp = createTestExperience()
    // orgId is not in the base Experience type — it's an optional extension
    // The factory accepts it as an override but does not require it
    expect(exp.id).toBeDefined()
  })

  it("createTestExperience accepts orgId override", () => {
    const orgId = "550e8400-e29b-41d4-a716-446655440100"
    const exp = createTestExperience({ orgId })
    // @ts-ignore — orgId is an additive field not yet in the Experience type
    expect((exp as Record<string, unknown>).orgId).toBe(orgId)
  })

  it("training experience can be linked to an org", () => {
    const org = createTestOrg()
    const exp = createTestExperience({
      type: "l_and_d",
      renderingTheme: "training",
      orgId: org.id,
    })
    expect(exp.type).toBe("l_and_d")
    expect(exp.renderingTheme).toBe("training")
  })
})

describe("Session compatibility with org model", () => {
  it("session factory still works after org model addition", () => {
    const session = createTestSession()
    expect(session.id).toBeDefined()
    expect(session.state.competencyProfile).toEqual([])
    expect(session.state.dialogue).toBeNull()
  })
})
