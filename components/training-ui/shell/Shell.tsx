"use client"

import { useEffect, useState, type ReactNode } from "react"
import Link from "next/link"
import type { LearningObjective, CourseNote } from "@/types/engine"
import type { StageProgress } from "@/lib/training/stages"
import type { PlayerBrand } from "@/lib/training/views"
import { CLOSED_BOOK_NOTE } from "@/lib/training/copy"
import { toDisplayText } from "@/lib/training/display"
import { BrandMark } from "../BrandMark"
import { CloseIcon, ListIcon, NotesIcon } from "../icons"
import { StageBar } from "./StageBar"
import { NotesDrawer } from "./NotesDrawer"
import { ObjectivesDrawer } from "./ObjectivesDrawer"

export interface ShellTools {
  objectives: LearningObjective[]
  notes: CourseNote[]
  /** Closed-book rule: false on decision, feedback, assessment, waiting and error screens. */
  open: boolean
}

/**
 * The in-course frame (shell option B): brand, course title small, stage
 * line large, segmented stage bar on the header's bottom edge. The main
 * area is the page's only scroll container. Without `tools` (cover,
 * debrief) the header offers a close link back to the library instead.
 */
export function Shell({
  brand,
  title,
  stage = null,
  tools,
  closeHref = "/scenario",
  children,
}: {
  brand: PlayerBrand
  title: string
  stage?: StageProgress | null
  tools?: ShellTools
  closeHref?: string
  children: ReactNode
}) {
  const [drawer, setDrawer] = useState<"notes" | "objectives" | null>(null)
  const open = tools?.open ?? false

  // A screen turning closed-book shuts any open drawer.
  useEffect(() => {
    if (!open) setDrawer(null)
  }, [open])

  // A single stage is no progress: the header then shows the course title only.
  const shown = stage !== null && stage.total > 1 ? stage : null
  const closedTitle = tools && !open ? CLOSED_BOOK_NOTE : undefined

  return (
    <div className="tg-shell">
      <header className="tg-header">
        <div className="tg-header-row">
          <BrandMark brand={brand} />
          <div className="tg-header-titles">
            {shown ? (
              <>
                <span className="tg-header-course">{toDisplayText(title)}</span>
                <span className="tg-header-stage">
                  {toDisplayText(shown.label)} · {shown.index + 1} of {shown.total}
                </span>
              </>
            ) : (
              <span className="tg-header-stage">{toDisplayText(title)}</span>
            )}
          </div>
          {tools ? (
            <>
              <button
                type="button"
                className="tg-header-btn"
                aria-label="View learning objectives"
                title={closedTitle}
                disabled={!open}
                onClick={() => setDrawer("objectives")}
              >
                <ListIcon />
              </button>
              <button
                type="button"
                className="tg-header-btn"
                aria-label="View course notes"
                title={closedTitle}
                disabled={!open}
                onClick={() => setDrawer("notes")}
              >
                <NotesIcon />
              </button>
            </>
          ) : (
            <Link className="tg-header-btn" href={closeHref} aria-label="Back to library">
              <CloseIcon />
            </Link>
          )}
        </div>
        {shown && <StageBar stage={shown} />}
      </header>
      <main className="tg-main">{children}</main>
      {tools && open && drawer === "objectives" && <ObjectivesDrawer objectives={tools.objectives} onClose={() => setDrawer(null)} />}
      {tools && open && drawer === "notes" && <NotesDrawer notes={tools.notes} onClose={() => setDrawer(null)} />}
    </div>
  )
}
