"use client"

import { useState, useEffect, useRef } from "react"
import { TrainingShell } from "./TrainingShell"
import { ScenarioPanel } from "./ScenarioPanel"
import { SituationText } from "./SituationText"
import { TrainingChoicePanel } from "./TrainingChoicePanel"
import { FeedbackPanel } from "./FeedbackPanel"
import { DebriefScreen } from "./DebriefScreen"
import { LoadingModule } from "./LoadingModule"
import type { DialogueTurn, CompetencyResult } from "@/types/session"
import type { AssessmentOutcome } from "@/lib/engine/client"
import { DEFAULT_BRAND, type BrandTheme } from "@/lib/branding"
import { CoverScreen } from "./CoverScreen"
import { SlideDeckPanel } from "@/components/traverse-training/SlideDeckPanel"
import { LayoutRenderer } from "@/components/traverse-training/LayoutRenderer"
import { useActorVoice } from "@/components/training-ui/useActorVoice"
import { DemoNodeBadge } from "./DemoNodeBadge"
import { isDemoMode } from "@/lib/demo"
import { useTrainingSession, buildCompetencyProfile } from "@/components/training-ui/useTrainingSession"

interface TrainingPlayerProps {
  experienceSlug: string
  brand?: BrandTheme
  /** Start-page metadata, fetched server-side. When present, the session
   * starts only after the learner clicks Begin. */
  cover?: {
    title: string
    description: string
    objectives: string[]
    steps: number
    personalised?: boolean
  }
}

export function TrainingPlayer({ experienceSlug, brand = DEFAULT_BRAND, cover }: TrainingPlayerProps) {
  const {
    started,
    begin,
    playerStatus,
    sessionId,
    moduleTitle,
    objectives,
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
  } = useTrainingSession({ experienceSlug, autoStart: !cover })

  // Demo-mode explainer badge for the node currently on screen (null when off)
  const demoBadge = isDemoMode() && currentNodeKey ? <DemoNodeBadge copyKey={currentNodeKey} /> : null

  // ─── Render ─────────────────────────────────────────────────

  if (!started && cover) {
    return (
      <div
        style={{
          "--t-accent": brand.accent,
          "--t-accent-hover": brand.accentHover,
          "--t-accent-light": brand.accentLight,
          "--c-accent": brand.accent,
          "--c-accent-hover": brand.accentHover,
          "--c-accent-lt": brand.accentLight,
        } as React.CSSProperties}
      >
        <CoverScreen
          title={cover.title}
          organisationName={brand.name}
          description={cover.description}
          objectives={cover.objectives}
          steps={cover.steps}
          personalised={cover.personalised}
          onBegin={() => begin()}
        />
      </div>
    )
  }

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
            <button className="t-btn-primary" onClick={() => startSession()}>
              Try again
            </button>
          )}
          <button
            className={retryable ? "t-btn-secondary" : "t-btn-primary"}
            onClick={() => startSession()}
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
          onReassess={reassessFromDebrief}
          onRestart={() => startSession()}
          onExit={() => { window.location.href = "/scenario" }}
          demoBadge={isDemoMode() ? <DemoNodeBadge copyKey="ENDPOINT" /> : undefined}
        />
      </div>
    )
  }

  if (playerStatus.status === "viewing_slides") {
    return (
      <TrainingShell
        brand={brand}
        moduleTitle={moduleTitle}
        totalSteps={totalSteps}
        currentStep={currentStep}
        objectives={objectives}
        courseNotes={courseNotes}
        notesEnabled
      >
        {demoBadge}
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
        brand={brand}
        moduleTitle={moduleTitle}
        totalSteps={totalSteps}
        currentStep={currentStep}
        objectives={objectives}
      >
        {demoBadge}
        <EvaluativeResultPanel
          sessionId={sessionId}
          outcome={playerStatus.outcome}
          results={playerStatus.results}
          feedback={playerStatus.feedback}
          onReassessed={replaceResultsForNodes}
          onContinue={() => handleEvaluativeContinue(playerStatus.nextNodeId)}
        />
      </TrainingShell>
    )
  }

  const isAdvancing = playerStatus.status === "advancing"
  const isReviewing = playerStatus.status === "reviewing_decision"
  // Closed-book rule: notes are reference material for reading and
  // conversations, never for decision, feedback, or assessment screens.
  const notesEnabled =
    playerStatus.status === "reading_scenario" ||
    playerStatus.status === "in_dialogue" ||
    playerStatus.status === "observing_dialogue"

  return (
    <TrainingShell
      brand={brand}
      moduleTitle={moduleTitle}
      totalSteps={totalSteps}
      currentStep={currentStep}
      objectives={objectives}
      courseNotes={courseNotes}
      notesEnabled={notesEnabled}
    >
      {!isAdvancing && demoBadge}
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
          onConclude={handleConcludeDialogue}
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
  onConclude,
}: {
  sessionId: string | null
  actorName: string
  actorRole: string
  history: DialogueTurn[]
  turnCount: number
  maxTurns: number
  onSubmit: (text: string) => void
  onConclude: () => void
}) {
  const [draft, setDraft] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [concluding, setConcluding] = useState(false)
  const { voiceOn, available, speaking, toggle, speak } = useActorVoice(sessionId)

  // Keep the newest turn in view — without this the box sits scrolled to the
  // top and a new reply below the fold looks like nothing happened
  const historyRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = historyRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [history, submitting])

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
        <span className="t-dialogue-actor">
          {actorName}
          {speaking && <span className="t-dialogue-speaking" aria-hidden="true" />}
        </span>
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
      <div className="t-dialogue-history" ref={historyRef}>
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
      {turnCount >= 1 && (
        <div className="t-dialogue-conclude-row">
          <button
            type="button"
            className="t-dialogue-conclude"
            onClick={() => {
              setConcluding(true)
              onConclude()
            }}
            disabled={submitting || concluding}
          >
            {concluding ? "Finishing…" : "I've said what I need to. Finish the conversation"}
          </button>
        </div>
      )}
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

const OUTCOME_HEADING: Record<AssessmentOutcome, { text: string; modifier: string }> = {
  passed: { text: "✓ Assessment complete", modifier: "pass" },
  not_passed: { text: "↑ Areas for development", modifier: "develop" },
  incomplete: { text: "Assessment incomplete", modifier: "develop" },
}

const CRITERION_MODIFIER: Record<CompetencyResult["status"], string> = {
  passed: "pass",
  not_passed: "fail",
  not_assessed: "pending",
}

export function EvaluativeResultPanel({
  sessionId,
  outcome: initialOutcome,
  results: initialResults,
  feedback: initialFeedback,
  onReassessed,
  onContinue,
}: {
  sessionId: string | null
  outcome: AssessmentOutcome
  results: CompetencyResult[]
  feedback: string
  onReassessed: (results: CompetencyResult[]) => void
  onContinue: () => void
}) {
  const [outcome, setOutcome] = useState(initialOutcome)
  const [results, setResults] = useState(initialResults)
  const [feedback, setFeedback] = useState(initialFeedback)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canReassess = !!sessionId && results.length > 0 && results.some((r) => r.status === "not_assessed")

  async function reassess() {
    if (!sessionId) return
    setPending(true)
    setError(null)
    try {
      const res = await fetch("/api/v1/engine/reassess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, nodeId: results[0].nodeId }),
      })
      if (!res.ok) throw new Error(`Reassess failed (${res.status})`)
      const data = (await res.json()) as { results: CompetencyResult[]; feedback: string; outcome: AssessmentOutcome }
      setResults(data.results)
      setFeedback(data.feedback)
      setOutcome(data.outcome)
      onReassessed(data.results)
    } catch {
      setError("The assessment could not be re-run. Try again shortly.")
    } finally {
      setPending(false)
    }
  }

  const heading = OUTCOME_HEADING[outcome]
  return (
    <div className="t-evaluative-panel">
      <div className={`t-evaluative-outcome t-evaluative-outcome--${heading.modifier}`}>{heading.text}</div>
      <p className="t-evaluative-feedback">{feedback}</p>
      <div className="t-evaluative-criteria">
        {results.map((r) => (
          <div key={r.rubricCriterionId} className={`t-evaluative-criterion t-evaluative-criterion--${CRITERION_MODIFIER[r.status]}`}>
            <span className="t-evaluative-criterion-label">{r.criterionLabel}</span>
            <span className="t-evaluative-criterion-weight">{r.weight}</span>
            <p className="t-evaluative-criterion-evidence">{r.evidence}</p>
          </div>
        ))}
      </div>
      {canReassess && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem", paddingTop: "1rem" }}>
          <button className="t-btn-secondary" onClick={reassess} disabled={pending}>
            {pending ? "Re-running..." : "Re-run assessment"}
          </button>
          {error && <p className="t-evaluative-feedback" role="alert">{error}</p>}
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "center", paddingTop: "1.5rem" }}>
        <button className="t-btn-primary" onClick={onContinue}>Continue →</button>
      </div>
    </div>
  )
}
