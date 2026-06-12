import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { getOrgUsage } from "@/lib/analytics/queries"

// GET /api/v1/org/analytics?from=2026-01-01&to=2026-12-31
// Org-scoped usage and generation costs. Org owners only — aggregates, not
// per-learner results (per-learner reporting is a separate privacy decision).
export async function GET(req: NextRequest) {
  const user = await requireAuth(req)
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!user.orgId || user.orgRole !== "owner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const from = searchParams.get("from")
  const to = searchParams.get("to")

  const dateFrom = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const dateTo = to ? new Date(to) : new Date()

  if (isNaN(dateFrom.getTime()) || isNaN(dateTo.getTime())) {
    return NextResponse.json({ error: "Invalid date range" }, { status: 400 })
  }

  const usage = await getOrgUsage(user.orgId, dateFrom, dateTo)
  return NextResponse.json(usage)
}
