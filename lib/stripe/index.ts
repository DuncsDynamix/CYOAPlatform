import Stripe from "stripe"
import { db } from "@/lib/db/prisma"

// Lazy: constructing the client at module load crashes the whole build/boot
// when STRIPE_SECRET_KEY is absent (it's optional until billing goes live).
let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) throw new Error("STRIPE_SECRET_KEY is not configured")
    _stripe = new Stripe(key, {
      apiVersion: "2025-02-24.acacia",
      typescript: true,
    })
  }
  return _stripe
}

export async function createCheckoutSession(
  userId: string,
  priceId: string,
  returnUrl: string
): Promise<string> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { stripeCustomerId: true, email: true },
  })
  if (!user) throw new Error("User not found")

  const session = await getStripe().checkout.sessions.create({
    customer: user.stripeCustomerId ?? undefined,
    customer_email: user.stripeCustomerId ? undefined : user.email,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${returnUrl}?success=true`,
    cancel_url: `${returnUrl}?cancelled=true`,
    metadata: { userId },
  })

  return session.url!
}

export async function createPortalSession(
  userId: string,
  returnUrl: string
): Promise<string> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { stripeCustomerId: true },
  })
  if (!user?.stripeCustomerId) throw new Error("No Stripe customer for this user")

  const session = await getStripe().billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: returnUrl,
  })

  return session.url
}

export async function syncSubscription(subscription: Stripe.Subscription): Promise<void> {
  const customerId = subscription.customer as string

  const user = await db.user.findUnique({
    where: { stripeCustomerId: customerId },
    select: { id: true },
  })
  if (!user) return

  await db.user.update({
    where: { id: user.id },
    data: {
      subscriptionId: subscription.id,
      subscriptionStatus: subscription.status,
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    },
  })
}

export async function cancelSubscription(subscription: Stripe.Subscription): Promise<void> {
  const customerId = subscription.customer as string

  const user = await db.user.findUnique({
    where: { stripeCustomerId: customerId },
    select: { id: true },
  })
  if (!user) return

  await db.user.update({
    where: { id: user.id },
    data: {
      subscriptionStatus: "canceled",
      subscriptionId: null,
      currentPeriodEnd: null,
    },
  })
}
