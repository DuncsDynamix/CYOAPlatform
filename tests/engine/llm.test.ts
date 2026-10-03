import { describe, it, expect, vi, beforeEach } from "vitest"

const { create, ctor } = vi.hoisted(() => {
  const create = vi.fn()
  const ctor = vi.fn().mockImplementation(() => ({ messages: { create }, beta: { messages: { create } } }))
  return { create, ctor }
})
vi.mock("@anthropic-ai/sdk", () => ({ default: ctor }))
vi.mock("@/lib/engine/queue", () => ({ generationQueue: { add: (fn: () => unknown) => fn() } }))
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn() }))

const { callModel, ModelCallError } = await import("@/lib/engine/llm")

const base = { kind: "prose" as const, system: "sys", messages: [{ role: "user" as const, content: "hi" }] }

beforeEach(() => vi.clearAllMocks())

describe("callModel", () => {
  it("returns the first text block even when a thinking block comes first", async () => {
    create.mockResolvedValue({
      content: [{ type: "thinking", thinking: "" }, { type: "text", text: "Hello" }],
      stop_reason: "end_turn",
      usage: { input_tokens: 1, output_tokens: 2 },
    })
    const r = await callModel(base)
    expect(r.text).toBe("Hello")
  })

  it("throws ModelCallError(no_text) when there is no text block", async () => {
    create.mockResolvedValue({ content: [], stop_reason: "end_turn", usage: { input_tokens: 1, output_tokens: 0 } })
    await expect(callModel(base)).rejects.toMatchObject({ reason: "no_text" })
  })

  it("throws ModelCallError(refusal) on a refusal stop", async () => {
    create.mockResolvedValue({ content: [{ type: "text", text: "" }], stop_reason: "refusal", usage: { input_tokens: 1, output_tokens: 0 } })
    await expect(callModel(base)).rejects.toBeInstanceOf(ModelCallError)
    await expect(callModel(base)).rejects.toMatchObject({ reason: "refusal" })
  })

  it("throws ModelCallError(max_tokens) on truncation", async () => {
    create.mockResolvedValue({ content: [{ type: "text", text: "{\"a\":" }], stop_reason: "max_tokens", usage: { input_tokens: 1, output_tokens: 9 } })
    await expect(callModel(base)).rejects.toMatchObject({ reason: "max_tokens" })
  })

  it("sends the model map's settings and never disabled thinking", async () => {
    create.mockResolvedValue({ content: [{ type: "text", text: "x" }], stop_reason: "end_turn", usage: { input_tokens: 1, output_tokens: 1 } })
    await callModel(base)
    const params = create.mock.calls[0][0]
    expect(params.model).toBe("claude-sonnet-5-5")
    expect(params.max_tokens).toBe(800)
    expect(params.thinking).toEqual({ type: "between_tools" })
    expect(params.fallbacks).toBe("default")
    expect(params.betas).toContain("server-side-fallback-2026-07-01")
  })

  it("passes an output schema as structured output and honours a maxTokens override", async () => {
    create.mockResolvedValue({ content: [{ type: "text", text: "{}" }], stop_reason: "end_turn", usage: { input_tokens: 1, output_tokens: 1 } })
    const schema = { type: "object", properties: {}, additionalProperties: false }
    await callModel({ ...base, kind: "evaluative", outputSchema: schema, maxTokens: 1234 })
    const params = create.mock.calls[0][0]
    expect(params.output_config).toEqual({ effort: "medium", format: { type: "json_schema", schema } })
    expect(params.max_tokens).toBe(1234)
  })

  it("does not send thinking or fallbacks for Haiku calls", async () => {
    create.mockResolvedValue({ content: [{ type: "text", text: "{}" }], stop_reason: "end_turn", usage: { input_tokens: 1, output_tokens: 1 } })
    await callModel({ ...base, kind: "scaffold" })
    const params = create.mock.calls[0][0]
    expect(params.model).toBe("claude-haiku-4-5")
    expect(params.thinking).toBeUndefined()
    expect(params.fallbacks).toBeUndefined()
  })
})
