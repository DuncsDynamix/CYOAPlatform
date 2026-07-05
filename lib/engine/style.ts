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
  return text
    .replace(/\s+—\s+/g, ", ") // spaced em-dash
    .replace(/—/g, ", ") // tight em-dash
    .replace(/\s+–\s+/g, ", ") // spaced en-dash used as a clause break (tight en-dashes, e.g. "10–20", are left alone)
    .replace(/ {2,}/g, " ") // collapse any double spaces the substitutions above introduced
    .replace(/,\s*,/g, ",") // collapse any double commas
    .replace(/ ,/g, ",") // a comma left with a stray leading space
    .replace(/,\./g, ".") // a comma immediately before a full stop
}
