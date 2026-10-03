import type { StageProgress } from "@/lib/training/stages"

/** Earlier stages filled, the current one half-filled, later ones empty. No finer measure within a stage. */
export function StageBar({ stage }: { stage: StageProgress }) {
  return (
    <div
      className="tg-stagebar"
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={stage.total}
      aria-valuenow={stage.index + 1}
      aria-label={`Stage ${stage.index + 1} of ${stage.total}: ${stage.label}`}
    >
      {Array.from({ length: stage.total }, (_, i) => (
        <span
          key={i}
          className={`tg-stagebar-seg tg-stagebar-seg--${i < stage.index ? "done" : i === stage.index ? "current" : "todo"}`}
        />
      ))}
    </div>
  )
}
