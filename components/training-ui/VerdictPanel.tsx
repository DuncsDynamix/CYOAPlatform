import type { AssessmentOutcome } from "@/lib/engine/client"
import { VERDICT_LABEL, VERDICT_PASS_RULE } from "@/lib/training/copy"
import { AlertIcon, CheckIcon } from "./icons"

const VERDICT_TONE: Record<AssessmentOutcome, "pass" | "notyet" | "incomplete"> = {
  passed: "pass",
  not_passed: "notyet",
  incomplete: "incomplete",
}

/** The competence verdict, its count and the engine's pass rule. Shared by the debrief and the record page. */
export function VerdictPanel({ outcome, summary }: { outcome: AssessmentOutcome; summary: string }) {
  return (
    <div className={`tg-verdict tg-verdict--${VERDICT_TONE[outcome]}`} role="status">
      <span className="tg-verdict-icon">{outcome === "passed" ? <CheckIcon /> : <AlertIcon />}</span>
      <div>
        <p className="tg-verdict-label">{VERDICT_LABEL[outcome]}</p>
        <p className="tg-verdict-summary">{summary}</p>
        <p className="tg-verdict-rule">{VERDICT_PASS_RULE}</p>
      </div>
    </div>
  )
}
