"use client"

import { useState, useEffect, useCallback } from "react"
import { TrainingShell } from "./TrainingShell"
import { ScenarioPanel } from "./ScenarioPanel"
import { SituationText } from "./SituationText"
import { TrainingChoicePanel } from "./TrainingChoicePanel"
import { FeedbackPanel } from "./FeedbackPanel"
import { DebriefScreen } from "./DebriefScreen"
import { LoadingModule } from "./LoadingModule"
import type { TrainingPlayerStatus, LearningObjective, DecisionReview, CompetencyProfile } from "@/types/engine"
import type { ChoiceOption, ExperienceContextPack } from "@/types/experience"
import type { ResolvedContent } from "@/types/engine"
import type { Node } from "@/types/experience"
import type { DialogueTurn, CompetencyResult } from "@/types/session"

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

  const startSession = useCallback(async () => {
    setPlayerStatus({ status: "loading_module" })
    setDecisionHistory([])
    setCurrentStep(0)
    setFeedbackVisible(false)
    setDialogueHistory([])

    try {
      const res = await fetch("/api/v1/engine/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ experienceSlug }),
      })
      if (!res.ok) {
        const err = await res.json()
        setPlayerStatus({ status: "error", message: err.error ?? "Could not start module" })
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
    } catch {
      setPlayerStatus({ status: "error", message: "Network error — please try again" })
    }
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
        outcomeLabel: node.type === "ENDPOINT" ? (node as { outcomeLabel: string }).outcomeLabel : "",
        closingLine: content.closingLine,
        aiSummary: content.summary,
        decisionHistory,
      })
      return
    }

    if (content.type === "choice") {
      const choiceNode = node as Extract<Node, { type: "CHOICE" }>
      setPlayerStatus({
        status: "at_decision",
        options: choiceNode.options ?? [],
        responseType: choiceNode.responseType,
        openPrompt: choiceNode.openPrompt,
      })
      return
    }

    if (content.type === "prose") {
      setPlayerStatus({
        status: "reading_scenario",
        content: content.content,
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

    if (content.type === "evaluative") {
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
      const res = await fetch(`/api/v1/engine/node?sessionId=${sid}`)
      if (!res.ok) {
        setPlayerStatus({ status: "error", message: "Could not advance module" })
        return
      }
      const data = await res.json() as { node: Node; content: ResolvedContent }
      arriveAtNode(sid, data.node, data.content)
    } catch {
      setPlayerStatus({ status: "error", message: "Network error" })
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

    try {
      const res = await fetch("/api/v1/engine/dialogue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, participantText }),
      })
      if (!res.ok) {
        setPlayerStatus({ status: "error", message: "Could not submit dialogue turn" })
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
        arriveAtNode(sessionId, data.nextNode, data.nextContent)
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
    } catch {
      setPlayerStatus({ status: "error", message: "Network error" })
    }
  }

  async function handleEvaluativeContinue(nextNodeId: string) {
    if (!sessionId) return
    setPlayerStatus({ status: "advancing" })
    try {
      const res = await fetch("/api/v1/engine/node?sessionId=" + sessionId)
      if (!res.ok) {
        setPlayerStatus({ status: "error", message: "Could not advance" })
        return
      }
      const data = await res.json() as { node: Node; content: ResolvedContent }
      arriveAtNode(sessionId, data.node, data.content)
    } catch {
      setPlayerStatus({ status: "error", message: "Network error" })
    }
  }

  async function submitChoice(choiceId: string) {
    if (!sessionId) return
    setPlayerStatus({ status: "advancing" })
    try {
      const res = await fetch("/api/v1/engine/choose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, choiceId }),
      })
      if (!res.ok) {
        setPlayerStatus({ status: "error", message: "Could not submit response" })
        return
      }
      const data = await res.json() as { node: Node; content: ResolvedContent }
      arriveAtNode(sessionId, data.node, data.content)
    } catch {
      setPlayerStatus({ status: "error", message: "Network error" })
    }
  }

  // ─── Render ─────────────────────────────────────────────────

  if (playerStatus.status === "loading_module") {
    return <LoadingModule />
  }

  if (playerStatus.status === "error") {
    return (
      <div className="t-loading">
        <p className="t-loading-text">{playerStatus.message}</p>
        <button className="t-btn-primary" onClick={startSession} style={{ marginTop: "1rem" }}>
          Try again
        </button>
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
          onRestart={startSession}
          onExit={() => { window.location.href = "/" }}
        />
      </div>
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
        <SituationText
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
          actorName={playerStatus.actorName}
          actorRole={playerStatus.actorRole}
          history={playerStatus.dialogueHistory}
          turnCount={playerStatus.turnCount}
          maxTurns={playerStatus.maxTurns}
          onSubmit={handleDialogueTurn}
        />
      )}
    </TrainingShell>
  )
}

// ─── INLINE SUB-COMPONENTS ────────────────────────────────────

function DialoguePanel({
  actorName,
  actorRole,
  history,
  turnCount,
  maxTurns,
  onSubmit,
}: {
  actorName: string
  actorRole: string
  history: DialogueTurn[]
  turnCount: number
  maxTurns: number
  onSubmit: (text: string) => void
}) {
  const [draft, setDraft] = useState("")
  const [submitting, setSubmitting] = useState(false)

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
