/**
 * Platform-wide demo mode. Build-time by design: NEXT_PUBLIC_ vars are inlined
 * into the client bundle, so switching the flag means redeploying — which is
 * exactly the weight a temporary sales-demo affordance should have. No DB
 * state, no per-request cost, deleting the env var turns it all off.
 */
export function isDemoMode(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_MODE === "1" || process.env.NEXT_PUBLIC_DEMO_MODE === "true"
}
