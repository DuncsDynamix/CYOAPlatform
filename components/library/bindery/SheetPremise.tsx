"use client"

import type { ExperienceContextPack } from "@/types/experience"

// Plain-language questions → contextPack fields (Milestone 4 Task 9). No
// jargon reaches the page: authors never see "world", "protagonist", or
// "style" as JSON keys — only these questions.
export function SheetPremise({
  contextPack,
  onChange,
}: {
  contextPack: ExperienceContextPack
  onChange: (pack: ExperienceContextPack) => void
}) {
  function commit(next: ExperienceContextPack) {
    // Perspective has no question of its own on this sheet — it defaults
    // silently to "second" whenever it's empty, rather than asking the
    // author to think about narrative person.
    const perspective = next.protagonist.perspective?.trim() || "second"
    onChange({ ...next, protagonist: { ...next.protagonist, perspective } })
  }

  return (
    <div className="lib-sheet lib-sheet-premise">
      <div className="lib-field">
        <label htmlFor="bindery-world-description">Where does this happen? What is this world?</label>
        <textarea
          id="bindery-world-description"
          value={contextPack.world.description}
          onChange={(e) =>
            commit({ ...contextPack, world: { ...contextPack.world, description: e.target.value } })
          }
        />
        <p className="lib-field-hint">Setting, era, place. As much or as little as you like.</p>
      </div>

      <div className="lib-field">
        <label htmlFor="bindery-world-rules">What are the unbreakable rules of this world?</label>
        <textarea
          id="bindery-world-rules"
          value={contextPack.world.rules}
          onChange={(e) => commit({ ...contextPack, world: { ...contextPack.world, rules: e.target.value } })}
        />
        <p className="lib-field-hint">Magic systems, physics, taboos. The things that never bend.</p>
      </div>

      <div className="lib-field">
        <label htmlFor="bindery-world-atmosphere">What does it feel like to be there?</label>
        <textarea
          id="bindery-world-atmosphere"
          value={contextPack.world.atmosphere}
          onChange={(e) =>
            commit({ ...contextPack, world: { ...contextPack.world, atmosphere: e.target.value } })
          }
        />
        <p className="lib-field-hint">Mood and sensory detail. The air in the room.</p>
      </div>

      <div className="lib-field">
        <label htmlFor="bindery-protagonist-role">Who is the reader in this story?</label>
        <textarea
          id="bindery-protagonist-role"
          value={contextPack.protagonist.role}
          onChange={(e) =>
            commit({ ...contextPack, protagonist: { ...contextPack.protagonist, role: e.target.value } })
          }
        />
        <p className="lib-field-hint">Their name, station, or role in the tale.</p>
      </div>

      <div className="lib-field">
        <label htmlFor="bindery-protagonist-goal">What do they want?</label>
        <textarea
          id="bindery-protagonist-goal"
          value={contextPack.protagonist.goal}
          onChange={(e) =>
            commit({ ...contextPack, protagonist: { ...contextPack.protagonist, goal: e.target.value } })
          }
        />
        <p className="lib-field-hint">The want that pulls them through the chapters.</p>
      </div>

      <div className="lib-field">
        <label htmlFor="bindery-style-tone">How should the telling sound?</label>
        <textarea
          id="bindery-style-tone"
          value={contextPack.style.tone}
          onChange={(e) => commit({ ...contextPack, style: { ...contextPack.style, tone: e.target.value } })}
        />
        <p className="lib-field-hint">Wry, solemn, breathless, plain. The voice of the telling.</p>
      </div>

      <div className="lib-field">
        <label htmlFor="bindery-style-notes">Any notes for the teller?</label>
        <textarea
          id="bindery-style-notes"
          value={contextPack.style.styleNotes}
          onChange={(e) =>
            commit({ ...contextPack, style: { ...contextPack.style, styleNotes: e.target.value } })
          }
        />
        <p className="lib-field-hint">Anything else worth knowing before the first page is written.</p>
      </div>
    </div>
  )
}
