"use client"

import type { ReactNode } from "react"
import { useTrainingSession } from "./useTrainingSession"
import { Shell } from "./shell/Shell"
import { DemoBadge } from "./DemoBadge"
import { CoverScreen } from "./screens/CoverScreen"
import { SceneScreen } from "./screens/SceneScreen"
import { SlideDeckScreen } from "./screens/SlideDeckScreen"
import { WaitingScreen } from "./screens/WaitingScreen"
import { ErrorScreen } from "./screens/ErrorScreen"
import { DecisionScreen } from "./screens/DecisionScreen"
import { FeedbackScreen } from "./screens/FeedbackScreen"
import { ConversationScreen } from "./screens/ConversationScreen"
import { ObservedScreen } from "./screens/ObservedScreen"
import { AssessmentScreen } from "./screens/AssessmentScreen"
import { DebriefScreen } from "./screens/DebriefScreen"
import { isDemoMode } from "@/lib/demo"
import { stageProgress } from "@/lib/training/stages"
import { toDisplayText } from "@/lib/training/display"
import { recordReference } from "@/lib/training/reference"
import type { Stage } from "@/lib/training/presentation"
import type { CoverView, FeedbackStyle, PlayerBrand, WaitPlan } from "@/lib/training/views"

const LIBRARY_HREF = "/scenario"

export interface TrainingPlayerProps {
  experienceSlug: string
  brand: PlayerBrand
  /** The start page. Without one, the session starts on mount. */
  cover?: CoverView
  stages?: Stage[]
  waitPlan?: WaitPlan
  feedbackStyle?: FeedbackStyle
  learnerName?: string | null
  /** The learner's unfinished session for this course: the cover offers Resume. */
  resumeSessionId?: string
  /** Resume it straight away (the library hero's Resume link). */
  autoResume?: boolean
}

/** The learner's course player: useTrainingSession for state, one screen per player status. */
export function TrainingPlayer({
  experienceSlug,
  brand,
  cover,
  stages = [],
  waitPlan = {},
  feedbackStyle = "scenario",
  learnerName = null,
  resumeSessionId,
  autoResume = false,
}: TrainingPlayerProps) {
  const s = useTrainingSession({ experienceSlug, autoStart: !cover, resumeSessionId, autoResume })
  const status = s.playerStatus
  const title = toDisplayText(s.moduleTitle || cover?.title || "")
  const stage = stageProgress(stages, s.visitedNodeIds)

  if (!s.started && cover) {
    return (
      <Shell brand={brand} title={brand.displayName}>
        <CoverScreen
          cover={cover}
          canResume={Boolean(resumeSessionId)}
          onStart={() => s.begin("new")}
          onResume={() => s.begin("resume")}
          onStartAgain={() => s.begin("restart")}
        />
      </Shell>
    )
  }

  if (status.status === "debrief") {
    return (
      <Shell brand={brand} title={title}>
        {isDemoMode() && <DemoBadge copyKey="ENDPOINT" />}
        <DebriefScreen
          outcomeLabel={status.outcomeLabel}
          learnerName={learnerName}
          aiSummary={status.aiSummary}
          decisionHistory={status.decisionHistory}
          feedbackStyle={feedbackStyle}
          score={status.score}
          evidence={status.evidence}
          record={
            s.sessionId
              ? { href: `/scenario/${experienceSlug}/record/${s.sessionId}`, reference: recordReference(s.sessionId, brand.recordPrefix) }
              : null
          }
          libraryHref={LIBRARY_HREF}
          onReassess={s.reassessFromDebrief}
        />
      </Shell>
    )
  }

  // Closed-book rule: notes and objectives are reference for reading and
  // conversations, never for decision, feedback or assessment screens.
  const open =
    status.status === "reading_scenario" ||
    status.status === "viewing_slides" ||
    status.status === "in_dialogue" ||
    status.status === "observing_dialogue"
  const waiting = status.status === "loading_module" || status.status === "advancing"
  const nodeKey = s.currentNode?.id
  const nodeTitle = s.currentNode ? toDisplayText(s.currentNode.label) : undefined

  function screen(): ReactNode {
    switch (status.status) {
      case "loading_module":
        return <WaitingScreen key={nodeKey} target={null} stageLabel={null} />
      case "advancing": {
        const target = s.pendingNodeId ? waitPlan[s.pendingNodeId] ?? null : null
        const upcoming = target?.nodeId ? stageProgress(stages, [...s.visitedNodeIds, target.nodeId]) : stage
        return <WaitingScreen key={nodeKey} target={target} stageLabel={upcoming?.label ?? null} />
      }
      case "error":
        return (
          <ErrorScreen
            key={nodeKey}
            message={status.message}
            retryable={Boolean(status.retryable)}
            onRetry={status.retry ?? (() => s.startSession())}
            onRestart={() => s.startSession()}
          />
        )
      case "reading_scenario":
        return (
          <SceneScreen
            key={nodeKey}
            title={nodeTitle}
            content={status.content}
            layout={status.layout}
            onContinue={() => {
              if (s.sessionId) s.advanceToNextNode(s.sessionId)
            }}
          />
        )
      case "viewing_slides":
        return <SlideDeckScreen key={nodeKey} slides={status.slides} onContinue={status.onContinue} />
      case "at_decision":
        return (
          <DecisionScreen
            key={nodeKey}
            prompt={status.prompt}
            options={status.options}
            responseType={status.responseType}
            openPrompt={status.openPrompt}
            onChoose={s.handleChoice}
          />
        )
      case "reviewing_decision":
        return (
          <FeedbackScreen
            key={nodeKey}
            choiceLabel={status.choiceLabel}
            feedback={status.feedback}
            tone={status.feedbackTone}
            competencySignal={status.competencySignal}
            style={feedbackStyle}
            visible={s.feedbackVisible}
            onContinue={status.onContinue}
          />
        )
      case "in_dialogue":
        return (
          <ConversationScreen
            key={nodeKey}
            sessionId={s.sessionId}
            actorName={status.actorName}
            actorRole={status.actorRole}
            history={status.dialogueHistory}
            turnCount={status.turnCount}
            maxTurns={status.maxTurns}
            onSubmit={s.handleDialogueTurn}
            onConclude={s.handleConcludeDialogue}
          />
        )
      case "observing_dialogue":
        return <ObservedScreen key={nodeKey} exchanges={status.exchanges} openingContext={status.openingContext} onContinue={status.onContinue} />
      case "evaluative_result":
        return (
          <AssessmentScreen
            key={nodeKey}
            sessionId={s.sessionId}
            title={nodeTitle}
            results={status.results}
            feedback={status.feedback}
            onReassessed={s.replaceResultsForNodes}
            onContinue={() => s.handleEvaluativeContinue(status.nextNodeId)}
          />
        )
      default:
        return null
    }
  }

  return (
    <Shell brand={brand} title={title} stage={stage} tools={{ objectives: s.objectives, notes: s.courseNotes, open }}>
      {!waiting && isDemoMode() && s.currentNodeKey && <DemoBadge copyKey={s.currentNodeKey} />}
      {screen()}
    </Shell>
  )
}
