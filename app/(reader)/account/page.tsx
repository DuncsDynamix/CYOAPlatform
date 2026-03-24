"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

const MONTHLY_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID ?? ""
const ANNUAL_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_ANNUAL_PRICE_ID ?? ""

interface AccountData {
  email: string
  subscriptionStatus: string | null
  subscriptionTier: string | null
  currentPeriodEnd: string | null
}

export default function AccountPage() {
  const router = useRouter()
  const [account, setAccount] = useState<AccountData | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push("/login")
        return
      }

      // Fetch subscription status from our DB via a simple user endpoint
      const res = await fetch("/api/account")
      if (res.ok) {
        setAccount(await res.json())
      } else {
        setAccount({
          email: user.email ?? "",
          subscriptionStatus: null,
          subscriptionTier: null,
          currentPeriodEnd: null,
        })
      }

      setLoading(false)
    }
    load()
  }, [router])

  async function handleSubscribe(priceId: string) {
    setActionLoading(true)
    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priceId, returnUrl: window.location.href }),
    })
    const data = await res.json()
    if (data.url) window.location.href = data.url
    setActionLoading(false)
  }

  async function handleManage() {
    setActionLoading(true)
    const res = await fetch("/api/stripe/portal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ returnUrl: window.location.href }),
    })
    const data = await res.json()
    if (data.url) window.location.href = data.url
    setActionLoading(false)
  }

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/")
    router.refresh()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-page flex items-center justify-center">
        <p className="font-body text-gray-500">Loading...</p>
      </div>
    )
  }

  const isSubscribed =
    account?.subscriptionStatus === "active" ||
    account?.subscriptionStatus === "trialing"

  return (
    <div className="min-h-screen bg-page py-12 px-4">
      <div className="max-w-lg mx-auto">
        <h1 className="font-display text-3xl text-gray-900 mb-8">Your Account</h1>

        {/* Account details */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="font-display text-lg text-gray-900 mb-3">Account details</h2>
          <p className="text-sm text-gray-500">Email</p>
          <p className="font-medium text-gray-900">{account?.email}</p>
        </div>

        {/* Subscription */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="font-display text-lg text-gray-900 mb-4">Subscription</h2>

          {isSubscribed ? (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="inline-block px-2 py-0.5 bg-green-100 text-green-800 text-xs font-medium rounded">
                  Active
                </span>
                <span className="text-sm text-gray-600">Subscriber</span>
              </div>
              {account?.currentPeriodEnd && (
                <p className="text-sm text-gray-500 mb-4">
                  Renews {new Date(account.currentPeriodEnd).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              )}
              <button
                onClick={handleManage}
                disabled={actionLoading}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {actionLoading ? "Loading..." : "Manage subscription"}
              </button>
            </div>
          ) : (
            <div>
              <p className="text-sm text-gray-600 mb-4">
                Subscribe to unlock all stories.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => handleSubscribe(MONTHLY_PRICE_ID)}
                  disabled={actionLoading || !MONTHLY_PRICE_ID}
                  className="flex-1 py-2 px-4 bg-choice-bg text-choice-text rounded-md text-sm font-medium hover:bg-choice-hover disabled:opacity-50 transition-colors"
                >
                  £6.99 / month
                </button>
                <button
                  onClick={() => handleSubscribe(ANNUAL_PRICE_ID)}
                  disabled={actionLoading || !ANNUAL_PRICE_ID}
                  className="flex-1 py-2 px-4 bg-accent text-white rounded-md text-sm font-medium hover:bg-accent-dark disabled:opacity-50 transition-colors"
                >
                  £59.99 / year
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Sign out */}
        <button
          onClick={handleSignOut}
          className="text-sm text-gray-500 hover:text-gray-700 underline"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
