import { z } from "zod"

/**
 * URL fields that org and course data put into href, <img src> and CSS
 * url(). Pure; no app or engine imports.
 */

// Characters that could break out of an attribute or a CSS url(...) value.
const UNSAFE_CHARS = /[\s"'()\\]/

function protocolOf(value: string): string | null {
  try {
    return new URL(value).protocol
  } catch {
    return null
  }
}

/** An image or other asset: a root-relative path ("/x.png", not "//host") or an https URL. */
export const AssetPath = z
  .string()
  .min(1)
  .refine(
    (v) => !UNSAFE_CHARS.test(v) && ((v.startsWith("/") && !v.startsWith("//")) || protocolOf(v) === "https:"),
    "must be a root-relative path or an https URL, with no spaces, quotes, parentheses or backslashes"
  )

/** A link a reader may follow: http or https only. */
export const LinkUrl = z
  .string()
  .min(1)
  .refine((v) => !/\s/.test(v) && (protocolOf(v) === "http:" || protocolOf(v) === "https:"), "must be an http or https URL")
