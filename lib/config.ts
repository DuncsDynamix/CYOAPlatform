// Boot-time configuration validation. In production a missing env var must
// fail loudly at startup — never silently degrade (the dev-user auth fallback
// and middleware pass-through would otherwise turn a typo into an open door).

const REQUIRED_IN_PRODUCTION = [
  "DATABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "ANTHROPIC_API_KEY",
] as const

// Optional everywhere until the corresponding feature goes live:
// STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET (billing), API_KEY_ENCRYPTION_KEY
// (operator BYOK), UPSTASH_REDIS_REST_URL / TOKEN (cache + rate limiting),
// RESEND_API_KEY (email). Their modules read lazily and throw on first use.

export function validateConfig(): void {
  if (process.env.NODE_ENV !== "production") return
  // `next build` runs with NODE_ENV=production on any machine — the guard is
  // for serving traffic, not compiling. Deployment env vars land at runtime.
  if (process.env.NEXT_PHASE === "phase-production-build") return

  const missing = REQUIRED_IN_PRODUCTION.filter((key) => !process.env[key])
  if (missing.length > 0) {
    throw new Error(
      `Refusing to start: missing required environment variables in production: ${missing.join(", ")}`
    )
  }
}
