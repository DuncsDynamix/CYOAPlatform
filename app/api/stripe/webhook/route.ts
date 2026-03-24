import { NextRequest, NextResponse } from "next/server"
import { stripe, syncSubscription, cancelSubscription } from "@/lib/stripe"
import { db } from "@/lib/db/prisma"
import { trackEvent } from "@/lib/analytics"
import type Stripe from "stripe"

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get("stripe-signature")

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  // Idempotency — skip if already processed
  const existing = await db.stripeEvent.findUnique({ where: { id: event.id } })
  if (existing?.processed) return NextResponse.json({ ok: true })

  await db.stripeEvent.upsert({
    where: { id: event.id },
    create: { id: event.id, type: event.type, payload: event as object },
    update: {},
  })

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await syncSubscription(event.data.object as Stripe.Subscription)
        trackEvent("subscription_started", {
          stripeSubscriptionId: (event.data.object as Stripe.Subscription).id,
        })
        break

      case "customer.subscription.deleted":
        await cancelSubscription(event.data.object as Stripe.Subscription)
        trackEvent("subscription_cancelled", {
          stripeSubscriptionId: (event.data.object as Stripe.Subscription).id,
        })
        break

      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.metadata?.userId && session.customer) {
          await db.user.update({
            where: { id: session.metadata.userId },
            data: { stripeCustomerId: session.customer as string },
          })
        }
        break
      }
    }

    await db.stripeEvent.update({
      where: { id: event.id },
      data: { processed: true },
    })
  } catch (err) {
    console.error("[stripe webhook] handler failed:", err)
    return NextResponse.json({ error: "Handler failed" }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
