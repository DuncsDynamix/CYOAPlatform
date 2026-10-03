"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import type { TrainingPlayerStatus, LearningObjective, DecisionReview, CompetencyProfile, CourseNote, ResolvedContent } from "@/types/engine"
import type { ChoiceOption, FixedNode, GeneratedNode, Node } from "@/types/experience"
import type { DialogueTurn, CompetencyResult } from "@/types/session"
import { buildEvidenceRecord } from "@/lib/training/evidence"
import { shuffleWith } from "@/lib/training/shuffle"
import type { ResumeSnapshot } from "@/lib/training/resume"

export function buildCompetencyProfile(history: DecisionReview[]): CompetencyProfile[] {
  const map = new Map<string, CompetencyProfile>()
  for (const d of history) {
    if (!d.competencySignal) continue
    const existing = map.get(d.competencySignal) ?? {
      name: d.competencySignal,
      demonstratedCount: 0,
      developmentalCount: 0,
      totalSignals: 0,
    }
    existing.totalSignals++
    if (d.feedbackTone === "positive") existing.demonstratedCount++
    if (d.feedbackTone === "developmental") existing.developmentalCount++
    map.set(d.competencySignal, existing)
  }
  return Array.from(map.values())
}

/** Reads the engine's { error, retryable } envelope off a failed response. */
async function readFailure(res: Response, fallback: string): Promise<{ message: string; retryable: boolean }> {
  try {
    const body = (await res.json()) as { error?: string; retryable?: boolean }
    return { message: body.error ?? fallback, retryable: body.retryable ?? false }
  } catch {
    return { message: fallback, retryable: false }
  }
}

export interface UseTrainingSessionOptions {
  experienceSlug: string
  /** True when there is no cover: the session starts on mount. */
  autoStart: boolean
  /** The learner's unfinished session for this course, offered as Resume on the cover. */
  resumeSessionId?: string
}

type BeginMode = "new" | "resume" | "restart"

export function useTrainingSession({ experienceSlug, autoStart, resumeSessionId }: UseTrainingSessionOptions) {
  const [startMode, setStartMode] = useState<BeginMode | null>(autoStart ? "new" : null)
  const started = startMode !== null
  const [visitedNodeIds, setVisitedNodeIds] = useState<string[]>([])
  const [playerStatus, setPlayerStatus] = useState<TrainingPlayerStatus>({ status: "loading_module" })
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [moduleTitle, setModuleTitle] = useState("")
  const [objectives, setObjectives] = useState<LearningObjective[]>([])
  const [decisionHistory, setDecisionHistory] = useState<DecisionReview[]>([])
  const [currentStep, setCurrentStep] = useState(0)
  const [totalSteps, setTotalSteps] = useState(0)
  const [feedbackVisible, setFeedbackVisible] = useState(false)
  const [dialogueHistory, setDialogueHistory] = useState<DialogueTurn[]>([])
  const [competencyResults, setCompetencyResults] = useState<CompetencyResult[]>([])
  const [courseNotes, setCourseNotes] = useState<CourseNote[]>([])
  const [currentNodeKey, setCurrentNodeKey] = useState<string | null>(null)

  const addCourseNote = (note: CourseNote) =>
    setCourseNotes((prev) => (prev.some((n) => n.nodeId === note.nodeId) ? prev : [...prev, note]))

  // Abort in-flight requests on unmount so late responses can't set state
  const abortRef = useRef<AbortController | null>(null)
  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  // Every response handler arrives through this ref, never through the
  // arriveAtNode captured by its own closure. advanceToNextNode is memoised
  // once and onContinue callbacks are stored in state, so a captured
  // arriveAtNode reads the state of the render that created it: that is how
  // the debrief evidence record was once built from an empty result list
  // ("Competence demonstrated" after two critical criteria failed).
  // (Kept current by the effect that follows arriveAtNode's declaration.)
  const arriveRef = useRef<((sid: string, node: Node, content: ResolvedContent) => void) | null>(null)

  function nextSignal(): AbortSignal {
    abortRef.current?.abort()
    abortRef.current = new AbortController()
    return abortRef.current.signal
  }

  function isAbort(err: unknown): boolean {
    return err instanceof DOMException && err.name === "AbortError"
  }

  const startSession = useCallback(async (restart = false) => {
    setPlayerStatus({ status: "loading_module" })
    setVisitedNodeIds([])
    setDecisionHistory([])
    setCurrentStep(0)
    setFeedbackVisible(false)
    setDialogueHistory([])
    setCompetencyResults([])
    setCourseNotes([])

    try {
      const res = await fetch("/api/v1/engine/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(restart ? { experienceSlug, restart: true } : { experienceSlug }),
        signal: nextSignal(),
      })
      if (!res.ok) {
        const failure = await readFailure(res, "Could not start module")
        setPlayerStatus({ status: "error", ...failure })
        return
      }
      const data = await res.json() as {
        sessionId: string
        node: Node
        content: ResolvedContent
        experienceTitle?: string
        contextPack?: { learningObjectives?: string[] }
        shape?: { totalDepthMax?: number; displaySteps?: number }
      }

      setSessionId(data.sessionId)
      setModuleTitle(data.experienceTitle ?? "Training Module")

      // Extract objectives from contextPack if included in start response
      const objectives = (data.contextPack?.learningObjectives ?? []).map((label, i) => ({
        id: `obj-${i}`,
        label,
        completed: false,
      }))
      setObjectives(objectives)
      setTotalSteps(data.shape?.displaySteps ?? data.shape?.totalDepthMax ?? 0)

      arriveRef.current?.(data.sessionId, data.node, data.content)
    } catch (err) {
      if (isAbort(err)) return
      setPlayerStatus({ status: "error", message: "Network error. Please try again.", retryable: true })
    }
  }, [experienceSlug])

  const resumeExisting = useCallback(async function resume(sid: string): Promise<void> {
    setPlayerStatus({ status: "loading_module" })
    try {
      const res = await fetch(`/api/v1/engine/resume?sessionId=${sid}`, { signal: nextSignal() })
      if (!res.ok) {
        // Finished or no longer ours: start fresh rather than strand the learner.
        await startSession()
        return
      }
      const data = (await res.json()) as { sessionId: string; node: Node; content: ResolvedContent; snapshot: ResumeSnapshot }
      const snap = data.snapshot
      setSessionId(data.sessionId)
      setModuleTitle(snap.moduleTitle)
      setObjectives(snap.objectives)
      setDecisionHistory(snap.decisionHistory)
      setCourseNotes(snap.courseNotes)
      setCompetencyResults(snap.competencyResults)
      setTotalSteps(snap.totalSteps)
      // arriveAtNode counts this arrival as a step and records the node as visited
      setCurrentStep(Math.max(0, snap.stepsCompleted - 1))
      setVisitedNodeIds(snap.visitedNodeIds.filter((id) => id !== data.node.id))
      arriveRef.current?.(data.sessionId, data.node, data.content)
      if (data.content.type === "dialogue" && snap.dialogueTurns.length > 0) {
        setDialogueHistory(snap.dialogueTurns)
        setPlayerStatus((prev) => (prev.status === "in_dialogue" ? { ...prev, dialogueHistory: snap.dialogueTurns } : prev))
      }
    } catch (err) {
      if (isAbort(err)) return
      setPlayerStatus({ status: "error", message: "Network error. Please try again.", retryable: true, retry: () => resume(sid) })
    }
  }, [startSession])

  useEffect(() => {
    if (startMode === null) return
    if (startMode === "resume" && resumeSessionId) resumeExisting(resumeSessionId)
    else startSession(startMode === "restart")
  }, [startMode, resumeSessionId, startSession, resumeExisting])

  /** Replaces (never appends) results for the nodes in `results`, so re-assessment cannot duplicate. */
  function replaceResultsForNodes(results: CompetencyResult[]) {
    const nodeIds = new Set(results.map((r) => r.nodeId))
    setCompetencyResults((prev) => [...prev.filter((r) => !nodeIds.has(r.nodeId)), ...results])
  }

  /** Debrief re-run: replaces the node's results and rebuilds the evidence record in place. */
  async function reassessFromDebrief(nodeId: string) {
    if (!sessionId) throw new Error("No session")
    const res = await fetch("/api/v1/engine/reassess", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, nodeId }),
    })
    if (!res.ok) throw new Error(`Reassess failed (${res.status})`)
    const data = (await res.json()) as { results: CompetencyResult[] }
    replaceResultsForNodes(data.results)
    setPlayerStatus((prev) => {
      if (prev.status !== "debrief" || !prev.evidence) return prev
      const merged = [...prev.evidence.criteria.filter((c) => c.nodeId !== nodeId), ...data.results]
      return {
        ...prev,
        evidence: buildEvidenceRecord({
          moduleTitle: prev.evidence.moduleTitle,
          outcomeLabel: prev.evidence.outcomeLabel,
          aiSummary: prev.evidence.aiSummary,
          completedAt: prev.evidence.completedAt,
          results: merged,
          decisions: prev.evidence.decisions,
          hasAssessment: true,
        }),
      }
    })
  }

  function arriveAtNode(sid: string, node: Node, content: ResolvedContent) {
    setVisitedNodeIds((prev) => [...prev, node.id])
    // Demo badge key: node type, with the open-choice variant distinguished.
    // Checkpoints are skipped so the previous screen's key survives auto-advance.
    if (node.type !== "CHECKPOINT") {
      setCurrentNodeKey(
        node.type === "CHOICE" && (node as Extract<Node, { type: "CHOICE" }>).responseType === "open"
          ? "CHOICE_OPEN"
          : node.type
      )
    }
    if (node.type === "CHECKPOINT") {
      // Mark objective complete then auto-advance
      const label = node.marksCompletionOf
      if (label) {
        setObjectives((prev) =>
          prev.map((o) =>
            o.label.toLowerCase() === label.toLowerCase() ? { ...o, completed: true } : o
          )
        )
      }
      advanceToNextNode(sid)
      return
    }

    // Progress: every content-bearing arrival is a step (checkpoints auto-advance
    // above; the endpoint is the destination, not a step)
    if (content.type !== "endpoint") {
      setCurrentStep((s) => s + 1)
    }

    if (content.type === "endpoint") {
      // The session's stored results (sent with the endpoint) are
      // authoritative. Client-accumulated results are only a fallback for an
      // older server; with neither, the scenario has no assessment and the
      // record carries no verdict.
      const results = content.assessment?.results ?? competencyResults
      setPlayerStatus({
        status: "debrief",
        outcomeLabel: content.outcomeCard.outcomeLabel,
        closingLine: content.closingLine,
        aiSummary: content.summary,
        decisionHistory,
        score: content.outcomeCard.score,
        evidence: buildEvidenceRecord({
          moduleTitle,
          outcomeLabel: content.outcomeCard.outcomeLabel,
          aiSummary: content.summary,
          completedAt: new Date().toISOString(),
          results,
          decisions: decisionHistory,
          hasAssessment: content.assessment !== undefined || results.length > 0,
        }),
      })
      return
    }

    if (content.type === "choice") {
      const choiceNode = node as Extract<Node, { type: "CHOICE" }>
      setPlayerStatus({
        status: "at_decision",
        // Shuffled per arrival so the load-bearing answer isn't always option A
        options: shuffleWith(choiceNode.options ?? [], Math.random),
        responseType: choiceNode.responseType,
        prompt: content.prompt,
        openPrompt: choiceNode.openPrompt,
      })
      return
    }

    if (content.type === "prose") {
      const layout = (node as FixedNode | GeneratedNode).layout
      addCourseNote({ nodeId: node.id, label: node.label, kind: "prose", content: content.content })
      setPlayerStatus({
        status: "reading_scenario",
        content: content.content,
        layout,
      })
      return
    }

    if (content.type === "slide_deck") {
      addCourseNote({ nodeId: node.id, label: node.label, kind: "slides", slides: content.slides })
      setPlayerStatus({
        status: "viewing_slides",
        slides: content.slides,
        onContinue: () => advanceToNextNode(sid),
      })
      return
    }

    if (content.type === "dialogue") {
      const charTurn: DialogueTurn = {
        role: "character",
        content: content.characterLine,
        timestamp: new Date().toISOString(),
      }
      setDialogueHistory([charTurn])
      setPlayerStatus({
        status: "in_dialogue",
        actorName: content.actorName,
        actorRole: content.actorRole,
        characterLine: content.characterLine,
        turnCount: content.turnCount,
        maxTurns: content.maxTurns,
        dialogueHistory: [charTurn],
      })
      return
    }

    if (content.type === "observed_dialogue") {
      addCourseNote({ nodeId: node.id, label: node.label, kind: "observed", exchanges: content.exchanges })
      setPlayerStatus({
        status: "observing_dialogue",
        exchanges: content.exchanges,
        openingContext: content.openingContext,
        onContinue: () => advanceToNextNode(sid),
      })
      return
    }

    if (content.type === "evaluative") {
      replaceResultsForNodes(content.results)
      setPlayerStatus({
        status: "evaluative_result",
        outcome: content.outcome,
        passed: content.passed,
        results: content.results,
        feedback: content.feedback,
        nextNodeId: content.nextNodeId,
      })
      return
    }
  }

  async function advanceToNextNode(sid: string) {
    setPlayerStatus({ status: "advancing" })
    try {
      const res = await fetch(`/api/v1/engine/node?sessionId=${sid}`, { signal: nextSignal() })
      if (!res.ok) {
        const failure = await readFailure(res, "Could not advance module")
        setPlayerStatus({ status: "error", ...failure, retry: () => advanceToNextNode(sid) })
        return
      }
      const data = await res.json() as { node: Node; content: ResolvedContent }
      arriveRef.current?.(sid, data.node, data.content)
    } catch (err) {
      if (isAbort(err)) return
      // Reached on a failed fetch OR an exception while handling a 200
      // response; log it so the two can be told apart.
      console.error("[player] advance failed:", err)
      setPlayerStatus({ status: "error", message: "Network error", retryable: true, retry: () => advanceToNextNode(sid) })
    }
  }

  async function handleChoice(choiceId: string, choiceLabel: string, option: ChoiceOption) {
    if (!sessionId) return

    // Show feedback panel if this option has training feedback
    if (option.trainingFeedback) {
      const review: DecisionReview = {
        nodeId: option.id,
        sceneLabel: `Decision ${decisionHistory.length + 1}`,
        choiceLabel,
        feedbackTone: option.feedbackTone,
        competencySignal: option.competencySignal,
      }
      setDecisionHistory((prev) => [...prev, review])

      setPlayerStatus({
        status: "reviewing_decision",
        feedback: option.trainingFeedback,
        feedbackTone: option.feedbackTone ?? "neutral",
        competencySignal: option.competencySignal,
        choiceLabel,
        onContinue: () => {
          setFeedbackVisible(false)
          setTimeout(() => submitChoice(choiceId), 350)
        },
      })
      // Trigger slide-in animation on next tick
      setTimeout(() => setFeedbackVisible(true), 20)
    } else {
      submitChoice(choiceId)
    }
  }

  async function handleDialogueTurn(participantText: string) {
    if (!sessionId) return
    setPlayerStatus((prev) => {
      if (prev.status !== "in_dialogue") return prev
      // Add participant turn to local history immediately for display
      const participantTurn: DialogueTurn = { role: "participant", content: participantText, timestamp: new Date().toISOString() }
      const updated = [...prev.dialogueHistory, participantTurn]
      setDialogueHistory(updated)
      return { ...prev, dialogueHistory: updated }
    })
    await submitDialogueTurn(participantText)
  }

  // Separated so a retry can re-send the same turn without re-appending it
  // to the local transcript. The server persists nothing on failure.
  async function submitDialogueTurn(participantText: string) {
    try {
      const res = await fetch("/api/v1/engine/dialogue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, participantText }),
        signal: nextSignal(),
      })
      if (!res.ok) {
        const failure = await readFailure(res, "Could not submit dialogue turn")
        setPlayerStatus({ status: "error", ...failure, retry: () => submitDialogueTurn(participantText) })
        return
      }
      const data = await res.json() as {
        characterLine: string
        turnCount: number
        maxTurns: number
        breakthroughAchieved: boolean
        dialogueComplete: boolean
        nextNode?: Node
        nextContent?: ResolvedContent
      }

      const charTurn: DialogueTurn = { role: "character", content: data.characterLine, timestamp: new Date().toISOString() }

      if (data.dialogueComplete && data.nextNode && data.nextContent) {
        // Dialogue over — advance
        setDialogueHistory([])
        arriveRef.current?.(sessionId!, data.nextNode, data.nextContent)
      } else {
        // Continue dialogue
        setDialogueHistory((prev) => [...prev, charTurn])
        setPlayerStatus((prev) => {
          if (prev.status !== "in_dialogue") return prev
          return {
            ...prev,
            characterLine: data.characterLine,
            turnCount: data.turnCount,
            dialogueHistory: [...prev.dialogueHistory, charTurn],
          }
        })
      }
    } catch (err) {
      if (isAbort(err)) return
      setPlayerStatus({ status: "error", message: "Network error", retryable: true, retry: () => submitDialogueTurn(participantText) })
    }
  }

  // Early wrap-up: participant declares the conversation done before max turns
  async function handleConcludeDialogue() {
    if (!sessionId) return
    try {
      const res = await fetch("/api/v1/engine/dialogue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, conclude: true }),
        signal: nextSignal(),
      })
      if (!res.ok) {
        const failure = await readFailure(res, "Could not finish the conversation")
        setPlayerStatus({ status: "error", ...failure, retry: handleConcludeDialogue })
        return
      }
      const data = await res.json() as { nextNode?: Node; nextContent?: ResolvedContent }
      if (data.nextNode && data.nextContent) {
        setDialogueHistory([])
        arriveRef.current?.(sessionId, data.nextNode, data.nextContent)
      }
    } catch (err) {
      if (isAbort(err)) return
      setPlayerStatus({ status: "error", message: "Network error", retryable: true, retry: handleConcludeDialogue })
    }
  }

  async function handleEvaluativeContinue(_nextNodeId: string) {
    if (!sessionId) return
    advanceToNextNode(sessionId)
  }

  async function submitChoice(choiceId: string) {
    if (!sessionId) return
    setPlayerStatus({ status: "advancing" })
    try {
      const res = await fetch("/api/v1/engine/choose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, choiceId }),
        signal: nextSignal(),
      })
      if (!res.ok) {
        const failure = await readFailure(res, "Could not submit response")
        setPlayerStatus({ status: "error", ...failure, retry: () => submitChoice(choiceId) })
        return
      }
      const data = await res.json() as { node: Node; content: ResolvedContent }
      arriveRef.current?.(sessionId, data.node, data.content)
    } catch (err) {
      if (isAbort(err)) return
      console.error("[player] choice failed:", err)
      setPlayerStatus({ status: "error", message: "Network error", retryable: true, retry: () => submitChoice(choiceId) })
    }
  }

  // Keep the ref pointing at this render's arriveAtNode (see arriveRef).
  useEffect(() => {
    arriveRef.current = arriveAtNode
  })

  return {
    started,
    begin: (mode: BeginMode = "new") => setStartMode(mode),
    visitedNodeIds,
    playerStatus,
    sessionId,
    moduleTitle,
    objectives,
    decisionHistory,
    currentStep,
    totalSteps,
    feedbackVisible,
    courseNotes,
    currentNodeKey,
    startSession,
    advanceToNextNode,
    handleChoice,
    handleDialogueTurn,
    handleConcludeDialogue,
    handleEvaluativeContinue,
    reassessFromDebrief,
    replaceResultsForNodes,
  }
}

export type TrainingSession = ReturnType<typeof useTrainingSession>
