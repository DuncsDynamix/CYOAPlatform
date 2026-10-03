"use client"

import type { ContextPack } from "@/lib/engine/client"

// Plain-language questions → contextPack fields (Milestone 4 Task 9). No
// jargon reaches the page: authors never see "world", "protagonist", or
// "style" as JSON keys — only these questions.
export function SheetPremise({
  contextPack,
  onChange,
}: {
  contextPack: ContextPack
  onChange: (pack: ContextPack) => void
}) {
  const core = contextPack.core
  const commit = onChange
  const setCore = <K extends keyof ContextPack["core"]>(key: K, patch: Partial<ContextPack["core"][K]>) =>
    commit({ ...contextPack, core: { ...core, [key]: { ...core[key], ...patch } } })
  const atmosphere = contextPack.extension.kind === "story" ? contextPack.extension.atmosphere : ""
  const setAtmosphere = (value: string) => {
    if (contextPack.extension.kind !== "story") return
    commit({ ...contextPack, extension: { ...contextPack.extension, atmosphere: value } })
  }

  return (
    <div className="lib-sheet lib-sheet-premise">
      <div className="lib-field">
        <label htmlFor="bindery-world-description">Where does this happen? What is this world?</label>
        <textarea
          id="bindery-world-description"
          value={core.setting.summary}
          onChange={(e) =>
            setCore("setting", { summary: e.target.value })
          }
        />
        <p className="lib-field-hint">Setting, era, place. As much or as little as you like.</p>
      </div>

      <div className="lib-field">
        <label htmlFor="bindery-world-rules">What are the unbreakable rules of this world?</label>
        <textarea
          id="bindery-world-rules"
          value={core.setting.details ?? ""}
          onChange={(e) => setCore("setting", { details: e.target.value })}
        />
        <p className="lib-field-hint">Magic systems, physics, taboos. The things that never bend.</p>
      </div>

      <div className="lib-field">
        <label htmlFor="bindery-world-atmosphere">What does it feel like to be there?</label>
        <textarea
          id="bindery-world-atmosphere"
          value={atmosphere}
          onChange={(e) =>
            setAtmosphere(e.target.value)
          }
        />
        <p className="lib-field-hint">Mood and sensory detail. The air in the room.</p>
      </div>

      <div className="lib-field">
        <label htmlFor="bindery-protagonist-role">Who is the reader in this story?</label>
        <textarea
          id="bindery-protagonist-role"
          value={core.participant.role}
          onChange={(e) =>
            setCore("participant", { role: e.target.value })
          }
        />
        <p className="lib-field-hint">Their name, station, or role in the tale.</p>
      </div>

      <div className="lib-field">
        <label htmlFor="bindery-protagonist-goal">What do they want?</label>
        <textarea
          id="bindery-protagonist-goal"
          value={core.participant.goal}
          onChange={(e) =>
            setCore("participant", { goal: e.target.value })
          }
        />
        <p className="lib-field-hint">The want that pulls them through the chapters.</p>
      </div>

      <div className="lib-field">
        <label htmlFor="bindery-style-tone">How should the telling sound?</label>
        <textarea
          id="bindery-style-tone"
          value={core.style.tone}
          onChange={(e) => setCore("style", { tone: e.target.value })}
        />
        <p className="lib-field-hint">Wry, solemn, breathless, plain. The voice of the telling.</p>
      </div>

      <div className="lib-field">
        <label htmlFor="bindery-style-notes">Any notes for the teller?</label>
        <textarea
          id="bindery-style-notes"
          value={core.style.notes}
          onChange={(e) =>
            setCore("style", { notes: e.target.value })
          }
        />
        <p className="lib-field-hint">Anything else worth knowing before the first page is written.</p>
      </div>
    </div>
  )
}
