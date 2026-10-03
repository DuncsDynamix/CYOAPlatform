/**
 * Display reference for an evidence record: {prefix}-XXXX-XXXX from the
 * first 8 hex characters of the session id. Not a lookup key. Pure, so the
 * debrief (client) and the record page (server) print the same reference.
 */
export function recordReference(sessionId: string, prefix = "TR"): string {
  const hex = sessionId.replace(/-/g, "").slice(0, 8).toUpperCase()
  return `${prefix}-${hex.slice(0, 4)}-${hex.slice(4, 8)}`
}
