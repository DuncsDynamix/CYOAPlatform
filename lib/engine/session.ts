import { db } from "@/lib/db/prisma"
import type { ExperienceSession, SessionState, NarrativeHistoryEntry, ChoiceHistoryEntry } from "@/types/session"

const DEFAULT_STATE: SessionState = {
  flags: {},
  currentPath: "",
  choicesMade: 0,
  nodesVisited: [],
  depthPercentage: 0,
  distanceToNearestEndpoint: 0,
  pacingInstruction: "",
  generationTimings: {},
}

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
  return session as unknown as ExperienceSession
}

export async function getSession(sessionId: string): Promise<ExperienceSession | null> {
  const session = await db.experienceSession.findUnique({
    where: { id: sessionId },
  })
  return session as unknown as ExperienceSession | null
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
  const session = await db.experienceSession.findUnique({
    where: { id: sessionId },
    select: { state: true },
  })
  if (!session) return

  const currentState = session.state as unknown as SessionState

  await db.experienceSession.update({
    where: { id: sessionId },
    data: {
      currentNodeId: updates.currentNodeId,
      lastActiveAt: new Date(),
      state: {
        ...currentState,
        ...(updates.nodesVisited ? { nodesVisited: updates.nodesVisited } : {}),
        ...(updates.depthPercentage !== undefined ? { depthPercentage: updates.depthPercentage } : {}),
        ...(updates.pacingInstruction ? { pacingInstruction: updates.pacingInstruction } : {}),
      } as object,
    },
  })
}

export async function applyStateChanges(
  sessionId: string,
  stateChanges?: Record<string, number | string | boolean>
): Promise<void> {
  if (!stateChanges || Object.keys(stateChanges).length === 0) return

  const session = await db.experienceSession.findUnique({
    where: { id: sessionId },
    select: { state: true },
  })
  if (!session) return

  const currentState = session.state as unknown as SessionState

  await db.experienceSession.update({
    where: { id: sessionId },
    data: {
      state: {
        ...currentState,
        flags: { ...currentState.flags, ...stateChanges },
      } as object,
    },
  })
}

export async function incrementChoiceCount(sessionId: string): Promise<void> {
  const session = await db.experienceSession.findUnique({
    where: { id: sessionId },
    select: { state: true, choiceCount: true },
  })
  if (!session) return

  const currentState = session.state as unknown as SessionState

  await db.experienceSession.update({
    where: { id: sessionId },
    data: {
      choiceCount: { increment: 1 },
      state: {
        ...currentState,
        choicesMade: (currentState.choicesMade ?? 0) + 1,
      } as object,
    },
  })
}

export async function appendChoiceHistory(
  sessionId: string,
  entry: ChoiceHistoryEntry
): Promise<void> {
  const session = await db.experienceSession.findUnique({
    where: { id: sessionId },
    select: { choiceHistory: true },
  })
  if (!session) return

  const history = (session.choiceHistory as unknown as ChoiceHistoryEntry[]) ?? []

  await db.experienceSession.update({
    where: { id: sessionId },
    data: {
      choiceHistory: [...history, entry] as object[],
    },
  })
}

export async function appendNarrativeHistory(
  sessionId: string,
  entry: NarrativeHistoryEntry
): Promise<void> {
  const session = await db.experienceSession.findUnique({
    where: { id: sessionId },
    select: { narrativeHistory: true },
  })
  if (!session) return

  const history = (session.narrativeHistory as unknown as NarrativeHistoryEntry[]) ?? []

  await db.experienceSession.update({
    where: { id: sessionId },
    data: {
      narrativeHistory: [...history, entry] as object[],
    },
  })
}

export async function markSessionComplete(
  sessionId: string,
  endpointId: string
): Promise<void> {
  await db.experienceSession.update({
    where: { id: sessionId },
    data: {
      status: "completed",
      endpointReached: endpointId,
      completedAt: new Date(),
    },
  })
}
