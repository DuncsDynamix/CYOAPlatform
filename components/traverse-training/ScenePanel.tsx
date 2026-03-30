"use client"

interface ScenePanelProps {
  prose: string
  isLoading: boolean
  label?: string
}

export function ScenePanel({ prose, isLoading, label = "Scenario" }: ScenePanelProps) {
  if (isLoading) {
    return (
      <div className="tt-scene" aria-busy="true">
        <div className="tt-scene-label">{label}</div>
        <div className="tt-generating" style={{ padding: "32px 0" }}>
          <div className="tt-generating-spinner" role="status" aria-label="Loading scenario" />
          <span className="tt-generating-text">Preparing scenario…</span>
        </div>
      </div>
    )
  }

  return (
    <div className="tt-scene">
      <div className="tt-scene-label">{label}</div>
      <div className="tt-scene-prose">{prose}</div>
    </div>
  )
}
