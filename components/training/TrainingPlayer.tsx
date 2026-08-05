"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { TrainingShell } from "./TrainingShell"
import { ScenarioPanel } from "./ScenarioPanel"
import { SituationText } from "./SituationText"
import { TrainingChoicePanel } from "./TrainingChoicePanel"
import { FeedbackPanel } from "./FeedbackPanel"
import { DebriefScreen } from "./DebriefScreen"
import { LoadingModule } from "./LoadingModule"
import type { TrainingPlayerStatus, LearningObjective, DecisionReview, CompetencyProfile } from "@/types/engine"
import type { ChoiceOption, ExperienceContextPack, FixedNode, GeneratedNode } from "@/types/experience"
import type { ResolvedContent } from "@/types/engine"
import type { Node } from "@/types/experience"
import type { DialogueTurn, CompetencyResult } from "@/types/session"
import { buildEvidenceRecord } from "@/lib/training/evidence"
import { SlideDeckPanel } from "@/components/traverse-training/SlideDeckPanel"
import { LayoutRenderer } from "@/components/traverse-training/LayoutRenderer"
import { useActorVoice } from "./useActorVoice"

interface TrainingPlayerProps {
  experienceSlug: string
}

function buildCompetencyProfile(history: DecisionReview[]): CompetencyProfile[] {
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

export function TrainingPlayer({ experienceSlug }: TrainingPlayerProps) {
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

  // Abort in-flight requests on unmount so late responses can't set state
  const abortRef = useRef<AbortController | null>(null)
  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  function nextSignal(): AbortSignal {
    abortRef.current?.abort()
    abortRef.current = new AbortController()
    return abortRef.current.signal
  }

  function isAbort(err: unknown): boolean {
    return err instanceof DOMException && err.name === "AbortError"
  }

  const startSession = useCallback(async () => {
    setPlayerStatus({ status: "loading_module" })
    setDecisionHistory([])
    setCurrentStep(0)
    setFeedbackVisible(false)
    setDialogueHistory([])
    setCompetencyResults([])

    try {
      const res = await fetch("/api/v1/engine/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ experienceSlug }),
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
        contextPack?: ExperienceContextPack
        shape?: { totalDepthMax?: number }
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
      setTotalSteps(data.shape?.totalDepthMax ?? 0)

      arriveAtNode(data.sessionId, data.node, data.content)
    } catch (err) {
      if (isAbort(err)) return
      setPlayerStatus({ status: "error", message: "Network error — please try again", retryable: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [experienceSlug])

  useEffect(() => {
    startSession()
  }, [startSession])

  function arriveAtNode(sid: string, node: Node, content: ResolvedContent) {
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

    if (content.type === "endpoint") {
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
          results: competencyResults,
          decisions: decisionHistory,
        }),
      })
      return
    }

    if (content.type === "choice") {
      const choiceNode = node as Extract<Node, { type: "CHOICE" }>
      setPlayerStatus({
        status: "at_decision",
        options: choiceNode.options ?? [],
        responseType: choiceNode.responseType,
        prompt: content.prompt,
        openPrompt: choiceNode.openPrompt,
      })
      return
    }

    if (content.type === "prose") {
      const layout = (node as FixedNode | GeneratedNode).layout
      setPlayerStatus({
        status: "reading_scenario",
        content: content.content,
        layout,
      })
      return
    }

    if (content.type === "slide_deck") {
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
      setPlayerStatus({
        status: "observing_dialogue",
        exchanges: content.exchanges,
        openingContext: content.openingContext,
        onContinue: () => advanceToNextNode(sid),
      })
      return
    }

    if (content.type === "evaluative") {
      setCompetencyResults((prev) => [...prev, ...content.results])
      setPlayerStatus({
        status: "evaluative_result",
        passed: content.passed,
        results: content.results,
        feedback: content.feedback,
        nextNodeId: content.nextNodeId,
      })
      return
    }
  }

  const advanceToNextNode = useCallback(async (sid: string) => {
    setPlayerStatus({ status: "advancing" })
    try {
      const res = await fetch(`/api/v1/engine/node?sessionId=${sid}`, { signal: nextSignal() })
      if (!res.ok) {
        const failure = await readFailure(res, "Could not advance module")
        setPlayerStatus({ status: "error", ...failure, retry: () => advanceToNextNode(sid) })
        return
      }
      const data = await res.json() as { node: Node; content: ResolvedContent }
      arriveAtNode(sid, data.node, data.content)
    } catch (err) {
      if (isAbort(err)) return
      setPlayerStatus({ status: "error", message: "Network error", retryable: true, retry: () => advanceToNextNode(sid) })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleChoice(choiceId: string, choiceLabel: string, option: ChoiceOption) {
    if (!sessionId) return

    // Show feedback panel if this option has training feedback
    if (option.trainingFeedback) {
      const decisionStep = currentStep + 1
      const review: DecisionReview = {
        nodeId: option.id,
        sceneLabel: `Decision ${decisionStep}`,
        choiceLabel,
        feedbackTone: option.feedbackTone,
        competencySignal: option.competencySignal,
      }
      setDecisionHistory((prev) => [...prev, review])
      setCurrentStep((s) => s + 1)

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
      setCurrentStep((s) => s + 1)
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
        arriveAtNode(sessionId!, data.nextNode, data.nextContent)
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
      arriveAtNode(sessionId, data.node, data.content)
    } catch (err) {
      if (isAbort(err)) return
      setPlayerStatus({ status: "error", message: "Network error", retryable: true, retry: () => submitChoice(choiceId) })
    }
  }

  // ─── Render ─────────────────────────────────────────────────

  if (playerStatus.status === "loading_module") {
    return <LoadingModule />
  }

  if (playerStatus.status === "error") {
    const { retryable, retry, message } = playerStatus
    return (
      <div className="t-loading">
        <p className="t-loading-text">{message}</p>
        <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
          {retryable && retry && (
            <button className="t-btn-primary" onClick={retry}>
              Try again
            </button>
          )}
          {retryable && !retry && (
            <button className="t-btn-primary" onClick={startSession}>
              Try again
            </button>
          )}
          <button
            className={retryable ? "t-btn-secondary" : "t-btn-primary"}
            onClick={startSession}
          >
            Restart scenario
          </button>
        </div>
      </div>
    )
  }

  if (playerStatus.status === "debrief") {
    return (
      <div className="training-theme">
        <DebriefScreen
          outcomeLabel={playerStatus.outcomeLabel}
          closingLine={playerStatus.closingLine}
          aiSummary={playerStatus.aiSummary}
          decisionHistory={playerStatus.decisionHistory}
          competencies={buildCompetencyProfile(playerStatus.decisionHistory)}
          moduleTitle={moduleTitle}
          score={playerStatus.score}
          evidence={playerStatus.evidence}
          onRestart={startSession}
          onExit={() => { window.location.href = "/" }}
        />
      </div>
    )
  }

  if (playerStatus.status === "viewing_slides") {
    return (
      <TrainingShell
        moduleTitle={moduleTitle}
        totalSteps={totalSteps}
        currentStep={currentStep}
        objectives={objectives}
      >
        <SlideDeckPanel
          slides={playerStatus.slides}
          onContinue={playerStatus.onContinue}
        />
      </TrainingShell>
    )
  }

  if (playerStatus.status === "evaluative_result") {
    return (
      <TrainingShell
        moduleTitle={moduleTitle}
        totalSteps={totalSteps}
        currentStep={currentStep}
        objectives={objectives}
      >
        <EvaluativeResultPanel
          passed={playerStatus.passed}
          results={playerStatus.results}
          feedback={playerStatus.feedback}
          onContinue={() => handleEvaluativeContinue(playerStatus.nextNodeId)}
        />
      </TrainingShell>
    )
  }

  const isAdvancing = playerStatus.status === "advancing"
  const isReviewing = playerStatus.status === "reviewing_decision"

  return (
    <TrainingShell
      moduleTitle={moduleTitle}
      totalSteps={totalSteps}
      currentStep={currentStep}
      objectives={objectives}
    >
      {/* Prose / advancing state */}
      {(playerStatus.status === "reading_scenario" || isAdvancing) && (
        playerStatus.status === "reading_scenario" && playerStatus.layout && playerStatus.layout.template !== "text-only"
          ? <LayoutRenderer layout={playerStatus.layout} fallbackContent={playerStatus.content} />
          : <SituationText
              content={playerStatus.status === "reading_scenario" ? playerStatus.content : ""}
              isGenerating={isAdvancing}
            />
      )}

      {/* Scene context (if available) */}
      {(playerStatus.status === "reading_scenario" || playerStatus.status === "at_decision") &&
        "sceneContext" in playerStatus &&
        playerStatus.sceneContext && (
          <ScenarioPanel context={playerStatus.sceneContext} />
        )}

      {/* Continue button after prose */}
      {playerStatus.status === "reading_scenario" && (
        <div style={{ display: "flex", justifyContent: "center", paddingTop: "1rem" }}>
          <button
            className="t-btn-primary"
            onClick={() => sessionId && advanceToNextNode(sessionId)}
          >
            Continue →
          </button>
        </div>
      )}

      {/* Choice panel */}
      {playerStatus.status === "at_decision" && (
        <TrainingChoicePanel
          options={playerStatus.options}
          onChoose={handleChoice}
          responseType={playerStatus.responseType}
          prompt={playerStatus.prompt}
          openPrompt={playerStatus.openPrompt}
          isSubmitting={false}
        />
      )}

      {/* Feedback panel (slide-up overlay) */}
      {isReviewing && (
        <FeedbackPanel
          feedback={playerStatus.feedback}
          feedbackTone={playerStatus.feedbackTone}
          competencySignal={playerStatus.competencySignal}
          choiceLabel={playerStatus.choiceLabel}
          onContinue={playerStatus.onContinue}
          isVisible={feedbackVisible}
        />
      )}

      {/* Dialogue panel */}
      {playerStatus.status === "in_dialogue" && (
        <DialoguePanel
          sessionId={sessionId}
          actorName={playerStatus.actorName}
          actorRole={playerStatus.actorRole}
          history={playerStatus.dialogueHistory}
          turnCount={playerStatus.turnCount}
          maxTurns={playerStatus.maxTurns}
          onSubmit={handleDialogueTurn}
        />
      )}

      {/* Observed dialogue panel */}
      {playerStatus.status === "observing_dialogue" && (
        <ObservedDialoguePanel
          exchanges={playerStatus.exchanges}
          openingContext={playerStatus.openingContext}
          onContinue={playerStatus.onContinue}
        />
      )}
    </TrainingShell>
  )
}

// ─── INLINE SUB-COMPONENTS ────────────────────────────────────

function DialoguePanel({
  sessionId,
  actorName,
  actorRole,
  history,
  turnCount,
  maxTurns,
  onSubmit,
}: {
  sessionId: string | null
  actorName: string
  actorRole: string
  history: DialogueTurn[]
  turnCount: number
  maxTurns: number
  onSubmit: (text: string) => void
}) {
  const [draft, setDraft] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const { voiceOn, available, toggle, speak } = useActorVoice(sessionId)

  // Speak each character turn once as it arrives (including the opening line)
  const spokenCountRef = useRef(0)
  useEffect(() => {
    if (history.length <= spokenCountRef.current) {
      spokenCountRef.current = history.length
      return
    }
    const latest = history[history.length - 1]
    spokenCountRef.current = history.length
    if (latest.role === "character") {
      speak(actorName, latest.content)
    }
  }, [history, actorName, speak])

  async function submit() {
    const text = draft.trim()
    if (!text || submitting) return
    setDraft("")
    setSubmitting(true)
    await onSubmit(text)
    setSubmitting(false)
  }

  return (
    <div className="t-dialogue-panel">
      <div className="t-dialogue-header">
        <span className="t-dialogue-actor">{actorName}</span>
        <span className="t-dialogue-role">{actorRole}</span>
        <span className="t-dialogue-turns">{turnCount}/{maxTurns} turns</span>
        {available && (
          <button
            type="button"
            className="t-dialogue-voice-toggle"
            onClick={toggle}
            aria-pressed={voiceOn}
            aria-label={voiceOn ? "Mute actor voice" : "Unmute actor voice"}
            title={voiceOn ? "Mute actor voice" : "Unmute actor voice"}
          >
            {voiceOn ? "🔊" : "🔇"}
          </button>
        )}
      </div>
      <div className="t-dialogue-history">
        {history.map((turn, i) => (
          <div key={i} className={`t-dialogue-turn t-dialogue-turn--${turn.role}`}>
            <span className="t-dialogue-turn-label">
              {turn.role === "character" ? actorName : "You"}
            </span>
            <p className="t-dialogue-turn-text">{turn.content}</p>
          </div>
        ))}
        {submitting && (
          <div className="t-dialogue-turn t-dialogue-turn--character">
            <span className="t-dialogue-turn-label">{actorName}</span>
            <p className="t-dialogue-turn-text t-loading-dots">...</p>
          </div>
        )}
      </div>
      <div className="t-dialogue-input-row">
        <textarea
          className="t-dialogue-input"
          rows={3}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              submit()
            }
          }}
          placeholder="Type your response… (Enter to send)"
          disabled={submitting}
        />
        <button
          className="t-btn-primary"
          onClick={submit}
          disabled={!draft.trim() || submitting}
        >
          Send
        </button>
      </div>
    </div>
  )
}

function ObservedDialoguePanel({
  exchanges,
  openingContext,
  onContinue,
}: {
  exchanges: { speaker: string; line: string }[]
  openingContext?: string
  onContinue: () => void
}) {
  const [revealed, setRevealed] = useState(1)
  const isComplete = revealed >= exchanges.length

  // Determine the two speakers in order of first appearance
  const speakerA = exchanges[0]?.speaker ?? ""
  const initials = (name: string) => name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase()

  return (
    <div className="t-observed-dialogue">
      <div className="t-observed-dialogue-label">Observe</div>
      <div className="t-observed-dialogue-scene">
        {openingContext && (
          <p className="t-observed-dialogue-context">{openingContext}</p>
        )}
        <div className="t-observed-dialogue-exchanges">
          {exchanges.slice(0, revealed).map((ex, i) => {
            const isB = ex.speaker !== speakerA
            return (
              <div key={i} className={`t-observed-dialogue-exchange${isB ? " t-observed-dialogue-exchange--b" : ""}`}>
                <div className="t-observed-dialogue-avatar">{initials(ex.speaker)}</div>
                <div className="t-observed-dialogue-bubble">
                  <span className="t-observed-dialogue-speaker">{ex.speaker}</span>
                  <p className="t-observed-dialogue-line">{ex.line}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
      <div className="t-observed-dialogue-footer">
        {isComplete ? (
          <button className="t-btn-primary" onClick={onContinue}>
            Continue →
          </button>
        ) : (
          <button className="t-btn-secondary" onClick={() => setRevealed((r) => r + 1)}>
            Next →
          </button>
        )}
      </div>
    </div>
  )
}

function EvaluativeResultPanel({
  passed,
  results,
  feedback,
  onContinue,
}: {
  passed: boolean
  results: CompetencyResult[]
  feedback: string
  onContinue: () => void
}) {
  return (
    <div className="t-evaluative-panel">
      <div className={`t-evaluative-outcome t-evaluative-outcome--${passed ? "pass" : "develop"}`}>
        {passed ? "✓ Assessment Complete" : "↑ Areas for Development"}
      </div>
      <p className="t-evaluative-feedback">{feedback}</p>
      <div className="t-evaluative-criteria">
        {results.map((r) => (
          <div key={r.rubricCriterionId} className={`t-evaluative-criterion t-evaluative-criterion--${r.passed ? "pass" : "fail"}`}>
            <span className="t-evaluative-criterion-label">{r.criterionLabel}</span>
            <span className="t-evaluative-criterion-weight">{r.weight}</span>
            <p className="t-evaluative-criterion-evidence">{r.evidence}</p>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "center", paddingTop: "1.5rem" }}>
        <button className="t-btn-primary" onClick={onContinue}>Continue →</button>
      </div>
    </div>
  )
}
