import { CRITERION_STATUS_LABEL } from "@/lib/training/copy"
import type { CompetencyResult } from "@/types/session"

const TONE: Record<CompetencyResult["status"], "pass" | "fail" | "na"> = {
  passed: "pass",
  not_passed: "fail",
  not_assessed: "na",
}

/** A criterion's status in words, in the fixed status colours. Not assessed is never a fail. */
export function StatusChip({ status }: { status: CompetencyResult["status"] }) {
  return <span className={`tg-chip tg-chip--${TONE[status]}`}>{CRITERION_STATUS_LABEL[status]}</span>
}
