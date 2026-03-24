interface ProgressBarProps {
  choicesMade: number
  estimatedTotal?: number
}

export function ProgressBar({ choicesMade, estimatedTotal = 9 }: ProgressBarProps) {
  const pct = Math.min(Math.round((choicesMade / estimatedTotal) * 100), 100)

  return (
    <div className="progress-bar-wrapper">
      <span className="progress-bar-label">Depth</span>
      <div className="progress-bar-track">
        <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="progress-bar-label">{choicesMade}</span>
    </div>
  )
}
