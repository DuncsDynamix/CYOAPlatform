"use client"

import type { CourseNote } from "@/types/engine"
import { toDisplayText } from "@/lib/training/display"
import { NOTES_EMPTY } from "@/lib/training/copy"
import { Prose } from "../Prose"
import { Drawer } from "./Drawer"

/** Open-book reference: every content block seen so far this session. The player decides when it is available. */
export function NotesDrawer({ notes, onClose }: { notes: CourseNote[]; onClose: () => void }) {
  return (
    <Drawer title="Course notes" closeLabel="Close course notes" onClose={onClose}>
      {notes.length === 0 ? (
        <p className="tg-drawer-empty">{NOTES_EMPTY}</p>
      ) : (
        notes.map((n) => (
          <section key={n.nodeId} className="tg-note">
            <h3 className="tg-note-label">{toDisplayText(n.label)}</h3>
            {n.kind === "prose" && <Prose text={n.content} />}
            {n.kind === "slides" &&
              n.slides.map((s) => (
                <div key={s.id} className="tg-note-slide">
                  {s.title && <h4 className="tg-note-slide-title">{s.title}</h4>}
                  {s.body && <Prose text={s.body} />}
                </div>
              ))}
            {n.kind === "observed" &&
              n.exchanges.map((x, i) => (
                <p key={i} className="tg-note-line">
                  <strong>{toDisplayText(x.speaker)}:</strong> {x.line}
                </p>
              ))}
          </section>
        ))
      )}
    </Drawer>
  )
}
