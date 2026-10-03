import { CRITERION_STATUS_LABEL } from "@/lib/training/copy"
import type { CompetencyResult } from "@/types/session"

const TONE: Record<CompetencyResult["status"], "pass" | "fail" | "na"> = {
  passed: "pass",
  not_passed: "fail",
  not_assessed: "na",
}

/** A criterion's status in words, in the fixed status colours. Not assessed is never a fail. */
export function StatusChip({ status, label }: { status: CompetencyResult["status"]; label?: string }) {
  return <span className={`tg-chip tg-chip--${TONE[status]}`}>{label ?? CRITERION_STATUS_LABEL[status]}</span>
}
