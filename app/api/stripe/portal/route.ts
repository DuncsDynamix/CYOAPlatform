import { NextRequest, NextResponse } from "next/server"
import { createPortalSession } from "@/lib/stripe"
import { requireAuth } from "@/lib/auth"

export async function POST(req: NextRequest) {
  const user = await requireAuth(req)
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { returnUrl } = await req.json()
  if (!returnUrl) {
    return NextResponse.json({ error: "returnUrl required" }, { status: 400 })
  }

  try {
    const url = await createPortalSession(user.id, returnUrl)
    return NextResponse.json({ url })
  } catch {
    return NextResponse.json({ error: "No subscription found" }, { status: 400 })
  }
}
