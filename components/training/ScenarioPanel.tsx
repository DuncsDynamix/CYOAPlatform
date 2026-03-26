import type { SceneContext } from "@/types/engine"

interface ScenarioPanelProps {
  context: SceneContext
}

export function ScenarioPanel({ context }: ScenarioPanelProps) {
  const hasMeta = context.location || context.timeContext
  return (
    <div className="t-scenario">
      {hasMeta && (
        <div className="t-scenario-meta">
          {context.location && <span>📍 {context.location}</span>}
          {context.location && context.timeContext && <span className="t-scenario-sep">•</span>}
          {context.timeContext && <span>{context.timeContext}</span>}
        </div>
      )}
      {context.characters.length > 0 && (
        <div className="t-scenario-chars">
          {context.characters.map((char, i) => (
            <span
              key={i}
              className={`t-char-chip ${char.speaking ? "t-char-chip--speaking" : ""}`}
            >
              {char.speaking ? "💬 " : "👤 "}{char.name}
              {char.role ? ` — ${char.role}` : ""}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
