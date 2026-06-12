import { NextRequest, NextResponse } from "next/server"
import { getGenerationCosts } from "@/lib/analytics/queries"
import { requireAuth } from "@/lib/auth"

// GET /api/analytics?from=2024-01-01&to=2024-12-31
// Returns platform-level cost summary (operator/admin use)
export async function GET(req: NextRequest) {
  const user = await requireAuth(req)
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Platform-wide cost data is operator-only — org owners get their own
  // scoped view elsewhere.
  if (!user.isOperator) {
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

  const costs = await getGenerationCosts(dateFrom, dateTo)
  return NextResponse.json(costs)
}
