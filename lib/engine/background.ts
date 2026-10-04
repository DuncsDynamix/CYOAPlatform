import { after } from "next/server"

/**
 * Keeps fire-and-forget work alive after the response. Serverless hosts
 * (Vercel) freeze a function once it has responded, so a bare promise stalls
 * mid-flight and fails on the next request; after() tells the host to wait.
 * Outside a request (tests, scripts) after() throws and the work just runs.
 */
export function keepAlive(task: Promise<unknown>): void {
  try {
    after(() => task)
  } catch {
    // No request scope: nothing to keep alive.
  }
}
