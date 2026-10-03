import { stripEmDashes } from "@/lib/engine/client"

/**
 * Author-supplied text shown to learners (node labels, stage labels, course
 * titles). House style forbids em-dashes in learner copy: the first spaced
 * dash reads as a title separator and becomes ": "; any others become commas.
 */
export function toDisplayText(text: string): string {
  return stripEmDashes(text.replace(/[ \t]+[—–][ \t]+/, ": "))
}
