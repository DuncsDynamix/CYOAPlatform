import type { ArcAwareness, ArcPhase } from "@/types/engine"
import type { GeneratedNode } from "@/types/experience"
import type { ExperienceSession } from "@/types/session"
import type { Experience } from "@/types/experience"
import type { ShapeDefinition } from "@/types/experience"

const pacingInstructions: Record<ArcPhase, string> = {
  opening: "Establish atmosphere and situation. Intrigue without overwhelming. Leave the reader curious.",
  rising: "Build tension and stakes. Deepen the world. The reader should feel invested.",
  midpoint: "A revelation or turn. Something the reader thought was true is complicated.",
  complication: "Raise the stakes. The situation becomes harder to navigate.",
  climax: "The consequences of earlier choices converge. Urgency and tension peak.",
  resolution: "Wind toward an ending. Actions have consequences. The world is changed.",
}

export function buildArcAwareness(
  node: GeneratedNode,
  session: ExperienceSession,
  experience: Experience
): ArcAwareness {
  const shape = experience.shape as ShapeDefinition
  const choicesMade = session.state.choicesMade
  const totalDepthMid = (shape.totalDepthMin + shape.totalDepthMax) / 2

  const depthPct = Math.round((choicesMade / totalDepthMid) * 100)
  const isLoadBearing = shape.loadBearingChoices.includes(choicesMade + 1)
  const isConvergence = shape.convergencePoints.includes(choicesMade + 1)

  let arcPhase: ArcPhase
  if (depthPct < 20) arcPhase = "opening"
  else if (depthPct < 40) arcPhase = "rising"
  else if (depthPct < 55) arcPhase = "midpoint"
  else if (depthPct < 75) arcPhase = "complication"
  else if (depthPct < 90) arcPhase = "climax"
  else arcPhase = "resolution"

  const lines = [
    `Arc phase: ${arcPhase}. ${pacingInstructions[arcPhase]}`,
    `Reader has made ${choicesMade} choice(s) so far.`,
    isLoadBearing
      ? "IMPORTANT: The next choice is load-bearing — write to a natural point of genuine decision."
      : "",
    isConvergence ? "IMPORTANT: This is a convergence point — multiple paths have led here." : "",
  ]
    .filter(Boolean)
    .join("\n")

  return {
    arcPhase,
    depthPercentage: depthPct,
    isApproachingLoadBearingChoice: isLoadBearing,
    isConvergencePoint: isConvergence,
    instruction: lines,
  }
}
