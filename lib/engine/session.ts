import { z } from "zod"
import { db } from "@/lib/db/prisma"
import type { ExperienceSession, SessionState, NarrativeHistoryEntry, ChoiceHistoryEntry, DialogueTurn, DialogueSessionState, CompetencyResult } from "@/types/session"

const DEFAULT_STATE: SessionState = {
  flags: {},
  counters: {},
  returnStack: [],
  choicesMade: 0,
  nodesVisited: [],
  depthPercentage: 0,
  pacingInstruction: "",
  dialogue: null,
  competencyProfile: [],
}

/** Narrative history is capped so long sessions can't grow the row unboundedly. */
export const NARRATIVE_HISTORY_CAP = 100

// ─── SESSION STATE PARSING ────────────────────────────────────
// Prisma returns the state column as Json (unknown). Every field falls back
// to its DEFAULT_STATE value independently, so one corrupt field never
// poisons the rest of the blob.

const DialogueTurnSchema = z.object({
  role: z.enum(["participant", "character"]),
  content: z.string(),
  timestamp: z.string(),
})

const DialogueStateSchema = z.object({
  nodeId: z.string(),
  actorName: z.string(),
  turns: z.array(DialogueTurnSchema),
  breakthroughAchieved: z.boolean(),
  turnCount: z.number(),
})

const CompetencyResultSchema = z.object({
  nodeId: z.string(),
  rubricCriterionId: z.string(),
  criterionLabel: z.string(),
  passed: z.boolean(),
  evidence: z.string(),
  weight: z.enum(["critical", "major", "minor"]),
})

const SessionStateSchema = z.object({
  flags: z.record(z.union([z.string(), z.boolean()])).catch({}),
  counters: z.record(z.number()).catch({}),
  returnStack: z.array(z.string()).catch([]),
  choicesMade: z.number().catch(0),
  nodesVisited: z.array(z.string()).catch([]),
  depthPercentage: z.number().catch(0),
  pacingInstruction: z.string().catch(""),
  dialogue: DialogueStateSchema.nullable().catch(null),
  competencyProfile: z.array(CompetencyResultSchema).catch([]),
})

export function parseSessionState(raw: unknown): SessionState {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return structuredClone(DEFAULT_STATE)
  }
  return SessionStateSchema.parse(raw)
}

// ─── PURE STATE TRANSFORMS ────────────────────────────────────

/**
 * Applies authored state changes to a state object.
 * Numeric values are accumulated into `counters`; string/boolean values are
 * written to `flags`. Throws if a key already exists under the other type.
 */
export function applyStateChangesToState(
  state: SessionState,
  stateChanges?: Record<string, number | string | boolean>
): SessionState {
  if (!stateChanges || Object.keys(stateChanges).length === 0) return state

  const newFlags = { ...state.flags }
  const newCounters = { ...state.counters }

  for (const [key, value] of Object.entries(stateChanges)) {
    if (typeof value === "number") {
      if (key in newFlags) throw new Error(`State key "${key}" already exists as a flag; cannot write as counter`)
      newCounters[key] = (newCounters[key] ?? 0) + value
    } else {
      if (key in newCounters) throw new Error(`State key "${key}" already exists as a counter; cannot write as flag`)
      newFlags[key] = value
    }
  }

  return { ...state, flags: newFlags, counters: newCounters }
}

/**
 * Back-fills scaffold.choiceMade on the most recent narrative history entry
 * so generation context for the next node includes what the reader chose.
 */
export function backfillLastScaffoldChoice(
  history: NarrativeHistoryEntry[],
  choiceMade: { label: string; consequence: string }
): void {
  if (history.length === 0) return
  const last = { ...history[history.length - 1] }
  last.scaffold = { ...last.scaffold, choiceMade }
  history[history.length - 1] = last
}

/** Appends a narrative entry, dropping the oldest entries beyond the cap. */
export function appendNarrativeEntry(
  history: NarrativeHistoryEntry[],
  entry: NarrativeHistoryEntry
): void {
  history.push(entry)
  if (history.length > NARRATIVE_HISTORY_CAP) {
    history.splice(0, history.length - NARRATIVE_HISTORY_CAP)
  }
}

// ─── SESSION MUTATION ─────────────────────────────────────────
// All session writes flow through here: one transactional read-mutate-write
// per request, so concurrent requests (double-click, client retry) can't
// interleave partial updates across multiple round-trips.

export interface SessionDraft {
  state: SessionState
  currentNodeId: string | null
  choiceCount: number
  status: string
  endpointReached: string | null
  completedAt: Date | null
  narrativeHistory: NarrativeHistoryEntry[]
  choiceHistory: ChoiceHistoryEntry[]
}

export async function commitSessionMutation(
  sessionId: string,
  mutate: (draft: SessionDraft) => void
): Promise<ExperienceSession | null> {
  return db.$transaction(async (tx) => {
    const row = await tx.experienceSession.findUnique({ where: { id: sessionId } })
    if (!row) return null

    const draft: SessionDraft = {
      state: parseSessionState(row.state),
      currentNodeId: row.currentNodeId,
      choiceCount: row.choiceCount,
      status: row.status,
      endpointReached: row.endpointReached,
      completedAt: row.completedAt,
      narrativeHistory: Array.isArray(row.narrativeHistory)
        ? (row.narrativeHistory as unknown as NarrativeHistoryEntry[])
        : [],
      choiceHistory: Array.isArray(row.choiceHistory)
        ? (row.choiceHistory as unknown as ChoiceHistoryEntry[])
        : [],
    }

    mutate(draft)

    const updated = await tx.experienceSession.update({
      where: { id: sessionId },
      data: {
        state: draft.state as object,
        currentNodeId: draft.currentNodeId,
        choiceCount: draft.choiceCount,
        status: draft.status,
        endpointReached: draft.endpointReached,
        completedAt: draft.completedAt,
        narrativeHistory: draft.narrativeHistory as unknown as object[],
        choiceHistory: draft.choiceHistory as unknown as object[],
        lastActiveAt: new Date(),
      },
    })

    return {
      ...updated,
      state: draft.state,
      narrativeHistory: draft.narrativeHistory,
      choiceHistory: draft.choiceHistory,
    } as ExperienceSession
  })
}

// ─── SESSION CRUD ─────────────────────────────────────────────

export async function createSession({
  experienceId,
  userId,
}: {
  experienceId: string
  userId?: string | null
}): Promise<ExperienceSession> {
  const session = await db.experienceSession.create({
    data: {
      experienceId,
      userId: userId ?? null,
      status: "active",
      state: DEFAULT_STATE as object,
      narrativeHistory: [],
      choiceHistory: [],
      choiceCount: 0,
    },
  })
  return { ...session, state: parseSessionState(session.state) } as unknown as ExperienceSession
}

export async function getSession(sessionId: string): Promise<ExperienceSession | null> {
  const session = await db.experienceSession.findUnique({
    where: { id: sessionId },
  })
  if (!session) return null
  return { ...session, state: parseSessionState(session.state) } as unknown as ExperienceSession
}

export async function updateSessionState(
  sessionId: string,
  updates: Partial<{
    currentNodeId: string
    nodesVisited: string[]
    depthPercentage: number
    pacingInstruction: string
  }>
): Promise<void> {
  await commitSessionMutation(sessionId, (draft) => {
    if (updates.currentNodeId !== undefined) draft.currentNodeId = updates.currentNodeId
    if (updates.nodesVisited) draft.state.nodesVisited = updates.nodesVisited
    if (updates.depthPercentage !== undefined) draft.state.depthPercentage = updates.depthPercentage
    if (updates.pacingInstruction) draft.state.pacingInstruction = updates.pacingInstruction
  })
}

export async function applyStateChanges(
  sessionId: string,
  stateChanges?: Record<string, number | string | boolean>
): Promise<void> {
  if (!stateChanges || Object.keys(stateChanges).length === 0) return
  await commitSessionMutation(sessionId, (draft) => {
    draft.state = applyStateChangesToState(draft.state, stateChanges)
  })
}

export async function incrementChoiceCount(sessionId: string): Promise<void> {
  await commitSessionMutation(sessionId, (draft) => {
    draft.choiceCount += 1
    draft.state.choicesMade += 1
  })
}

export async function appendChoiceHistory(
  sessionId: string,
  entry: ChoiceHistoryEntry
): Promise<void> {
  await commitSessionMutation(sessionId, (draft) => {
    draft.choiceHistory.push(entry)
  })
}

export async function appendNarrativeHistory(
  sessionId: string,
  entry: NarrativeHistoryEntry
): Promise<void> {
  await commitSessionMutation(sessionId, (draft) => {
    // Idempotent: a node can reach history via more than one path (e.g. the
    // choose route's requiresFresh generation appends before arrival, then
    // arrival cache-hits the same node and would otherwise append again).
    // Skip rather than dedupe-after-the-fact so callers can append freely.
    if (draft.narrativeHistory.some((h) => h.nodeId === entry.nodeId)) return
    appendNarrativeEntry(draft.narrativeHistory, entry)
  })
}

export async function markSessionComplete(
  sessionId: string,
  endpointId: string
): Promise<void> {
  await commitSessionMutation(sessionId, (draft) => {
    draft.status = "completed"
    draft.endpointReached = endpointId
    draft.completedAt = new Date()
  })
}

// ─── DIALOGUE HELPERS ─────────────────────────────────────────

export async function initDialogueState(
  sessionId: string,
  nodeId: string,
  actorName: string,
  openingLine: string
): Promise<void> {
  const openingTurn: DialogueTurn = {
    role: "character",
    content: openingLine,
    timestamp: new Date().toISOString(),
  }
  await commitSessionMutation(sessionId, (draft) => {
    draft.state.dialogue = {
      nodeId,
      actorName,
      turns: [openingTurn],
      breakthroughAchieved: false,
      turnCount: 0,
    }
  })
}

export async function appendDialogueTurn(
  sessionId: string,
  turn: DialogueTurn
): Promise<DialogueSessionState | null> {
  let result: DialogueSessionState | null = null
  await commitSessionMutation(sessionId, (draft) => {
    if (!draft.state.dialogue) return
    draft.state.dialogue = {
      ...draft.state.dialogue,
      turns: [...draft.state.dialogue.turns, turn],
      turnCount: turn.role === "participant"
        ? draft.state.dialogue.turnCount + 1
        : draft.state.dialogue.turnCount,
    }
    result = draft.state.dialogue
  })
  return result
}

export async function setDialogueBreakthrough(sessionId: string): Promise<void> {
  await commitSessionMutation(sessionId, (draft) => {
    if (!draft.state.dialogue) return
    draft.state.dialogue = { ...draft.state.dialogue, breakthroughAchieved: true }
  })
}

export async function clearDialogueState(sessionId: string): Promise<void> {
  await commitSessionMutation(sessionId, (draft) => {
    draft.state.dialogue = null
  })
}

// ─── COMPETENCY HELPERS ───────────────────────────────────────

export async function appendCompetencyResult(
  sessionId: string,
  results: CompetencyResult[]
): Promise<void> {
  if (results.length === 0) return
  await commitSessionMutation(sessionId, (draft) => {
    draft.state.competencyProfile = [...draft.state.competencyProfile, ...results]
  })
}

export async function updateLastScaffoldChoice(
  sessionId: string,
  choiceMade: { label: string; consequence: string }
): Promise<void> {
  await commitSessionMutation(sessionId, (draft) => {
    backfillLastScaffoldChoice(draft.narrativeHistory, choiceMade)
  })
}
