/**
 * Resolves the post-login destination from an untrusted ?next= value.
 * Only same-origin paths are honoured — absolute, protocol-relative and
 * backslash-mangled values fall back to "/" to prevent open redirects.
 */
export function resolveNextPath(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) {
    return "/"
  }
  return next
}
