"use client"

import { useState } from "react"
import type { LearningObjective } from "@/types/engine"
import { ObjectivesDrawer } from "./ObjectivesDrawer"

interface TrainingShellProps {
  moduleTitle: string
  organisationName?: string
  totalSteps: number
  currentStep: number
  objectives: LearningObjective[]
  children: React.ReactNode
}

export function TrainingShell({ moduleTitle, organisationName, totalSteps, currentStep, objectives, children }: TrainingShellProps) {
  const [objectivesOpen, setObjectivesOpen] = useState(false)
  const pct = totalSteps > 0 ? Math.min(100, Math.round((currentStep / totalSteps) * 100)) : 0

  return (
    <div className="t-shell">
      {/* Header */}
      <header className="t-shell-header">
        {organisationName && (
          <span className="t-shell-org">{organisationName}</span>
        )}
        <span className="t-shell-title">{moduleTitle}</span>
        <button
          className="t-shell-obj-btn"
          onClick={() => setObjectivesOpen(true)}
          aria-label="View learning objectives"
        >
          Objectives
        </button>
      </header>

      {/* Progress bar */}
      <div
        role="progressbar"
        aria-valuenow={currentStep}
        aria-valuemin={0}
        aria-valuemax={totalSteps}
        aria-label={`Step ${currentStep} of ${totalSteps}`}
      >
        <div className="t-progress-bar-wrap">
          <div className="t-progress-bar-fill" style={{ width: `${pct}%` }} />
        </div>
        {totalSteps > 0 && (
          <div className="t-progress-label">
            Step {currentStep} of {totalSteps}
          </div>
        )}
      </div>

      {/* Content */}
      <main className="t-shell-main">
        {children}
      </main>

      <ObjectivesDrawer
        objectives={objectives}
        isOpen={objectivesOpen}
        onClose={() => setObjectivesOpen(false)}
      />
    </div>
  )
}
