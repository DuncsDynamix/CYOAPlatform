import { NextRequest, NextResponse } from "next/server"
import { createCheckoutSession } from "@/lib/stripe"
import { requireAuth } from "@/lib/auth"
import { z } from "zod"

const Schema = z.object({
  priceId: z.string().min(1),
  returnUrl: z.string().url(),
})

export async function POST(req: NextRequest) {
  const user = await requireAuth(req)
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const parsed = Schema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 })
  }

  const url = await createCheckoutSession(user.id, parsed.data.priceId, parsed.data.returnUrl)
  return NextResponse.json({ url })
}
