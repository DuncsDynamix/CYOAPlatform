import { describe, it, expect } from "vitest"
import { resolveNextPath } from "../../lib/auth/next-path"

describe("resolveNextPath — post-login destination from untrusted ?next=", () => {
  it("returns the path when it is a safe internal path", () => {
    expect(resolveNextPath("/scenario")).toBe("/scenario")
  })

  it("preserves deeper paths and query strings", () => {
    expect(resolveNextPath("/scenario/abc?foo=1")).toBe("/scenario/abc?foo=1")
  })

  it("falls back to / when next is missing", () => {
    expect(resolveNextPath(null)).toBe("/")
    expect(resolveNextPath("")).toBe("/")
  })

  it("rejects absolute URLs (open redirect)", () => {
    expect(resolveNextPath("https://evil.example")).toBe("/")
    expect(resolveNextPath("http://evil.example/scenario")).toBe("/")
  })

  it("rejects protocol-relative URLs (open redirect)", () => {
    expect(resolveNextPath("//evil.example")).toBe("/")
  })

  it("rejects backslash-based redirect tricks", () => {
    expect(resolveNextPath("/\\evil.example")).toBe("/")
  })
})
