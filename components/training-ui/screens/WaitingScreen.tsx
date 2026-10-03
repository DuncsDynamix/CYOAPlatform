import type { WaitKind, WaitTarget } from "@/lib/training/views"
import { waitLine } from "@/lib/training/copy"
import { toDisplayText } from "@/lib/training/display"
import { Screen, ScreenBody } from "../Screen"

/** While the engine prepares the next screen: what is coming, where, and a skeleton of its shape. No streaming. */
export function WaitingScreen({ target, stageLabel }: { target: WaitTarget | null; stageLabel: string | null }) {
  return (
    <Screen busy>
      <ScreenBody>
        <p className="tg-kicker" role="status">
          {waitLine(target, stageLabel)}
        </p>
        {target?.label && <h1 className="tg-wait-title">{toDisplayText(target.label)}</h1>}
        <Skeleton kind={target?.kind ?? "opening"} criteria={target?.criteria} />
      </ScreenBody>
    </Screen>
  )
}

function Skeleton({ kind, criteria }: { kind: WaitKind; criteria?: number }) {
  switch (kind) {
    case "decision":
      return (
        <div aria-hidden="true">
          <span className="tg-skel tg-skel--heading" />
          <span className="tg-skel tg-skel--option" />
          <span className="tg-skel tg-skel--option" />
          <span className="tg-skel tg-skel--option" />
        </div>
      )
    case "conversation":
      return (
        <div aria-hidden="true">
          <div className="tg-skel-persona">
            <span className="tg-skel tg-skel--avatar" />
            <span className="tg-skel tg-skel--line tg-skel--w40" />
          </div>
          <span className="tg-skel tg-skel--bubble" />
          <span className="tg-skel tg-skel--bubble tg-skel--bubble-mine" />
          <span className="tg-skel tg-skel--bubble" />
        </div>
      )
    case "assessment":
      return (
        <div aria-hidden="true">
          {Array.from({ length: Math.min(Math.max(criteria ?? 3, 1), 6) }, (_, i) => (
            <span key={i} className="tg-skel tg-skel--row" />
          ))}
        </div>
      )
    case "debrief":
      return (
        <div aria-hidden="true">
          <span className="tg-skel tg-skel--hero" />
          <span className="tg-skel tg-skel--row" />
          <span className="tg-skel tg-skel--line" />
          <span className="tg-skel tg-skel--line tg-skel--w85" />
        </div>
      )
    default:
      return (
        <div className="tg-paper" aria-hidden="true">
          <span className="tg-skel tg-skel--heading" />
          <span className="tg-skel tg-skel--line" />
          <span className="tg-skel tg-skel--line" />
          <span className="tg-skel tg-skel--line tg-skel--w85" />
          <span className="tg-skel tg-skel--line" />
          <span className="tg-skel tg-skel--line tg-skel--w60" />
        </div>
      )
  }
}
