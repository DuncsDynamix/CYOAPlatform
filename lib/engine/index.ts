// Public entry point of the Traverse engine. Server-side app code imports from
// "@/lib/engine"; "use client" code imports from "@/lib/engine/client".

export {
  arriveAtNode,
  findNode,
  reassessNode,
  findFirstNodeId,
  getAllNodes,
  getReachableGeneratedChildren,
  selectFirstUnvisitedMandatory,
  selectOutcomeVariant,
} from "./executor"

export {
  createSession,
  getSession,
  updateSessionState,
  applyStateChanges,
  applyStateChangesToState,
  backfillLastScaffoldChoice,
  incrementChoiceCount,
  appendChoiceHistory,
  appendNarrativeEntry,
  appendNarrativeHistory,
  markSessionComplete,
  initDialogueState,
  appendDialogueTurn,
  setDialogueBreakthrough,
  clearDialogueState,
  appendCompetencyResult,
  replaceCompetencyResults,
  updateLastScaffoldChoice,
  parseSessionState,
  commitSessionMutation,
  NARRATIVE_HISTORY_CAP,
} from "./session"
export type { SessionDraft } from "./session"

export {
  generateNode,
  generateScaffold,
  generateEndpointSummary,
  generateDialogueOpener,
  generateDialogueResponse,
  assessDialogueBreakthrough,
  generateObservedDialogue,
  generateEvaluativeAssessment,
  NOT_ASSESSED_EVIDENCE,
  sanitizeAssessment,
  trackGeneration,
} from "./generator"

export { assessmentOutcome } from "./assessment-outcome"
export type { AssessmentOutcome } from "./assessment-outcome"
export { resolveOpenChoiceRouting } from "./router"
export {
  getFromCache,
  writeToCache,
  getScaffoldFromCache,
  writeScaffoldToCache,
  clearSessionCache,
} from "./cache"
export { applyDisplayConditions, evaluateCondition } from "./conditions"
export { USE_CASE_PACKS } from "./usecases"
export { buildArcAwareness } from "./arc"
export * from "./contract"
export { getChildLinks, validateExperienceGraph } from "./graph"
export { validateExperience } from "./validate"
export type { ValidationIssue } from "./validate"
export { getAdvanceTarget, resolveCheckpointTarget } from "./navigation"
export type { ChildLink, GraphIssue, GraphValidationResult } from "./graph"
export { callModel, ModelCallError, getAnthropicClient } from "./llm"
export { MODEL_MAP } from "./models"
export type { CallKind } from "./models"
export { generationQueue } from "./queue"
export { stripEmDashes, stripJsonFence } from "./style"
export { WRITING_STYLE_RULES, FICTION_CRAFT_RULES } from "./prompts"
