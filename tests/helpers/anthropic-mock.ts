import { vi } from "vitest"

/**
 * One create() mock reachable from both client.messages.create and
 * client.beta.messages.create: callModel uses the beta surface, older code
 * paths may still use the plain one.
 */
export function makeAnthropicMock() {
  const create = vi.fn()
  const ctor = vi.fn().mockImplementation(() => ({
    messages: { create },
    beta: { messages: { create } },
  }))
  return { create, ctor }
}

export function textResponse(text: string, extra: Record<string, unknown> = {}) {
  return {
    content: [{ type: "text", text }],
    stop_reason: "end_turn",
    usage: { input_tokens: 10, output_tokens: 10 },
    ...extra,
  }
}
