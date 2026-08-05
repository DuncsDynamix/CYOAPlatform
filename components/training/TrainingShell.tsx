"use client"

import { useState } from "react"
import type { LearningObjective, CourseNote } from "@/types/engine"
import type { BrandTheme } from "@/lib/branding"
import { ObjectivesDrawer } from "./ObjectivesDrawer"
import { CourseNotesDrawer } from "./CourseNotesDrawer"

interface TrainingShellProps {
  moduleTitle: string
  organisationName?: string
  brand?: BrandTheme
  totalSteps: number
  currentStep: number
  objectives: LearningObjective[]
  courseNotes?: CourseNote[]
  /** Closed-book rule: the player enables notes only outside assessment screens. */
  notesEnabled?: boolean
  children: React.ReactNode
}

export function TrainingShell({ moduleTitle, organisationName, brand, totalSteps, currentStep, objectives, courseNotes, notesEnabled, children }: TrainingShellProps) {
  const [objectivesOpen, setObjectivesOpen] = useState(false)
  const [notesOpen, setNotesOpen] = useState(false)
  const pct = totalSteps > 0 ? Math.min(100, Math.round((currentStep / totalSteps) * 100)) : 0
  const brandStyle = brand
    ? ({
        "--t-accent": brand.accent,
        "--t-accent-hover": brand.accentHover,
        "--t-accent-light": brand.accentLight,
        // The tt- components (SlideDeckPanel, LayoutRenderer) read the --c-
        // token family; without these the brand override never reaches them.
        "--c-accent": brand.accent,
        "--c-accent-hover": brand.accentHover,
        "--c-accent-lt": brand.accentLight,
      } as React.CSSProperties)
    : undefined
  const orgName = brand?.name ?? organisationName

  return (
    <div className="t-shell" style={brandStyle}>
      {/* Header */}
      <header className="t-shell-header">
        {orgName && (
          <span className="t-shell-org">{orgName}</span>
        )}
        <span className="t-shell-title">{moduleTitle}</span>
        {notesEnabled && courseNotes && (
          <button
            className="t-shell-obj-btn"
            onClick={() => setNotesOpen(true)}
            aria-label="View course notes"
          >
            Notes
          </button>
        )}
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
      {notesEnabled && courseNotes && (
        <CourseNotesDrawer
          notes={courseNotes}
          isOpen={notesOpen}
          onClose={() => setNotesOpen(false)}
        />
      )}
    </div>
  )
}
