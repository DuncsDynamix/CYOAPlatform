interface CompetencyBadgeProps {
  label: string
  status?: "demonstrated" | "developmental" | "assessed"
}

export function CompetencyBadge({ label, status = "assessed" }: CompetencyBadgeProps) {
  const prefix = status === "demonstrated" ? "✓ " : status === "developmental" ? "→ " : ""
  return (
    <span className={`t-competency t-competency--${status}`} aria-label={`Competency: ${label}`}>
      {prefix}{label}
    </span>
  )
}
