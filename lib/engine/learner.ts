import type { SessionContext } from "./contract"

/**
 * Guidance derived from the learner's profile and history. Phrased as
 * direction to the writer, never as facts to recite to the learner.
 * NEVER passed to the assessor: the route adapts, the verdict does not.
 */
export function buildLearnerBlock(context: SessionContext | undefined, audience: "scenes" | "characters" | "summary"): string {
  if (!context) return ""
  const developing = (context.profile ?? []).filter((p) => p.status === "developing")
  const strengths = (context.profile ?? []).filter((p) => p.status === "strength")
  const lines: string[] = []

  if (audience === "scenes" && (developing.length || strengths.length)) {
    if (developing.length) lines.push(`Give this learner a real, unforced opportunity to demonstrate: ${developing.map((p) => p.label).join(", ")}.`)
    if (strengths.length) lines.push(`They are already confident in: ${strengths.map((p) => p.label).join(", ")}. Do not over-explain these.`)
  }
  if (audience === "characters" && developing.length) {
    lines.push(`Where it fits your character, press the participant on: ${developing.map((p) => p.label).join(", ")}. Do not accept a vague answer on these.`)
  }
  if (audience === "summary" && (context.history?.length || developing.length || strengths.length)) {
    if (context.history?.length) lines.push(`Previous sessions:\n${context.history.map((h) => `- ${h.experienceTitle} (${h.completedAt.slice(0, 10)}): ${h.summary}`).join("\n")}`)
    lines.push("Where this session shows change since then, name it specifically.")
  }
  if (context.learner?.role && audience !== "summary") lines.push(`The learner's real job role: ${context.learner.role}.`)
  if (!lines.length) return ""
  return `ABOUT THIS LEARNER (guidance for you only. Do not mention that you know this):\n${lines.join("\n")}`
}
