/**
 * Deterministic prose sanitizer for model-generated text.
 *
 * Split out of generator.ts (already large and crowded with per-node-type
 * generation calls) since this is a pure, independently-testable transform.
 *
 * Em-dashes are one of the more obvious "AI wrote this" tells. This strips
 * them (and a spaced en-dash used the same way, as a clause break) in favour
 * of a comma, which keeps sentence structure intact without a rewrite.
 *
 * Applied only to text extracted directly from a model response — never to
 * author-written FIXED content, which is left exactly as authored.
 */
export function stripEmDashes(text: string): string {
  // Spaced-dash patterns match only horizontal whitespace ([ \t]) so a dash
  // sitting against a newline can never swallow a paragraph break.
  return text
    .replace(/[ \t]+—[ \t]+/g, ", ") // spaced em-dash
    .replace(/—/g, ", ") // tight em-dash
    .replace(/[ \t]+–[ \t]+/g, ", ") // spaced en-dash used as a clause break (tight en-dashes, e.g. "10–20", are left alone)
    .replace(/[ \t]+--[ \t]+/g, ", ") // spaced double-hyphen clause break
    .replace(/(\w)--(?=\w)/g, "$1, ") // tight double-hyphen clause break between words
    .replace(/ {2,}/g, " ") // collapse any double spaces the substitutions above introduced
    .replace(/,[ \t]*,/g, ",") // collapse any double commas
    .replace(/ ,/g, ",") // a comma left with a stray leading space
    .replace(/,[ \t]*\./g, ".") // a comma (however spaced) immediately before a full stop
    .replace(/[ \t]+\n/g, "\n") // trailing spaces a dash-before-newline substitution left behind
}

/**
 * Strips a wrapping markdown code fence from a model response before
 * JSON.parse. Haiku (and occasionally Sonnet) wraps structured-output
 * responses in ```json ... ``` (or a bare ``` ... ```) despite explicit
 * "no markdown fences" instructions in the system prompt. Every JSON.parse
 * of a raw model response in the engine should go through this first.
 *
 * Only strips a fence that wraps the *entire* response (leading fence at the
 * very start, matching closing fence at the very end) — it does not attempt
 * to extract a fenced block from surrounding prose.
 */
export function stripJsonFence(text: string): string {
  return text
    .trim()
    .replace(/^```[a-zA-Z]*\n?/, "")
    .replace(/\n?```$/, "")
    .trim()
}
