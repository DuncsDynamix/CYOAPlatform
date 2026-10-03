import { describe, it, expect } from "vitest"
import { formatDay, formatRecordDate } from "@/lib/training/dates"

describe("record dates", () => {
  it("formats in Europe/London, summer and winter", () => {
    expect(formatRecordDate("2026-10-03T13:22:00.000Z")).toBe("3 October 2026, 14:22")
    expect(formatRecordDate("2026-12-01T09:05:00.000Z")).toBe("1 December 2026, 09:05")
  })
  it("formats a day", () => {
    expect(formatDay("2026-10-03T23:30:00.000Z")).toBe("4 October 2026")
  })
})
