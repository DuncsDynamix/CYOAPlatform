import { describe, it, expect } from "vitest"
import { classifyEngineError } from "@/lib/api/errors"

function apiError(status: number, message = "api error"): Error {
  const err = new Error(message)
  Object.assign(err, { status })
  return err
}

describe("classifyEngineError", () => {
  it("maps provider rate limits to 429 retryable", () => {
    const result = classifyEngineError(apiError(429, "rate limited"))
    expect(result.status).toBe(429)
    expect(result.body.retryable).toBe(true)
  })

  it("maps provider 5xx to 502 retryable", () => {
    for (const status of [500, 529]) {
      const result = classifyEngineError(apiError(status))
      expect(result.status).toBe(502)
      expect(result.body.retryable).toBe(true)
    }
  })

  it("maps timeouts and connection failures to 503 retryable", () => {
    const timeout = new Error("Request timed out.")
    timeout.name = "APIConnectionTimeoutError"
    expect(classifyEngineError(timeout)).toMatchObject({
      status: 503,
      body: { retryable: true },
    })

    const conn = new Error("Connection error.")
    conn.name = "APIConnectionError"
    expect(classifyEngineError(conn)).toMatchObject({
      status: 503,
      body: { retryable: true },
    })
  })

  it("maps provider 4xx (bad key, bad request) to 502 non-retryable", () => {
    const result = classifyEngineError(apiError(401, "invalid x-api-key"))
    expect(result.status).toBe(502)
    expect(result.body.retryable).toBe(false)
  })

  it("maps unknown errors to 500 non-retryable", () => {
    const result = classifyEngineError(new Error("boom"))
    expect(result.status).toBe(500)
    expect(result.body.retryable).toBe(false)
  })

  it("never leaks internal error details in the body", () => {
    const result = classifyEngineError(new Error("connection string postgres://secret"))
    expect(JSON.stringify(result.body)).not.toContain("postgres://secret")
    expect(typeof result.body.error).toBe("string")
    expect(result.body.error.length).toBeGreaterThan(0)
  })
})
