import type { AssessmentOutcome } from "@/lib/engine/client"
import { AlertIcon, CheckIcon } from "./icons"

const VERDICT_TONE: Record<AssessmentOutcome, "pass" | "notyet" | "incomplete"> = {
  passed: "pass",
  not_passed: "notyet",
  incomplete: "incomplete",
}

/** The competence verdict, its count and the pass rule, as given by the caller (the record passes its document's own words). Shared by the debrief and the record page. */
export function VerdictPanel({ outcome, label, summary, rule }: { outcome: AssessmentOutcome; label: string; summary: string; rule: string }) {
  return (
    <div className={`tg-verdict tg-verdict--${VERDICT_TONE[outcome]}`} role="status">
      <span className="tg-verdict-icon">{outcome === "passed" ? <CheckIcon /> : <AlertIcon />}</span>
      <div>
        <p className="tg-verdict-label">{label}</p>
        <p className="tg-verdict-summary">{summary}</p>
        <p className="tg-verdict-rule">{rule}</p>
      </div>
    </div>
  )
}
