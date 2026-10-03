"use client"

import type { LearningObjective } from "@/types/engine"
import { toDisplayText } from "@/lib/training/display"
import { OBJECTIVES_EMPTY } from "@/lib/training/copy"
import { CheckIcon } from "../icons"
import { Drawer } from "./Drawer"

export function ObjectivesDrawer({ objectives, onClose }: { objectives: LearningObjective[]; onClose: () => void }) {
  return (
    <Drawer title="Learning objectives" closeLabel="Close objectives" onClose={onClose}>
      {objectives.length === 0 ? (
        <p className="tg-drawer-empty">{OBJECTIVES_EMPTY}</p>
      ) : (
        <ul className="tg-checklist">
          {objectives.map((o) => (
            <li key={o.id} className={o.completed ? "tg-checklist-item tg-checklist-item--done" : "tg-checklist-item"}>
              <span className="tg-checklist-box" aria-hidden="true">{o.completed && <CheckIcon />}</span>
              <span>
                {o.completed && <span className="tg-sr-only">Completed: </span>}
                {toDisplayText(o.label)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Drawer>
  )
}
